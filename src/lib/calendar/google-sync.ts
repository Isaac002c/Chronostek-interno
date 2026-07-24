import {
  CalendarEventType,
  type CalendarIntegration,
  type CalendarSyncJob,
  type Prisma,
} from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  decryptCalendarSecret,
  encryptCalendarSecret,
  hashOpaqueToken,
} from "@/lib/calendar/crypto";
import {
  GoogleCalendarApiError,
  googleCalendarConfiguration,
  googleCalendarRequest,
} from "@/lib/calendar/google-client";
import {
  calendarEventInclude,
} from "@/lib/calendar/events";
import {
  calendarJobKey,
  enqueueCalendarJob,
  retryAt,
} from "@/lib/calendar/jobs";

type GoogleEventDate = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

type GoogleAttendee = {
  email: string;
  displayName?: string;
  responseStatus?: "needsAction" | "accepted" | "declined" | "tentative";
  self?: boolean;
};

type GoogleCalendarEvent = {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled";
  etag?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleEventDate;
  end?: GoogleEventDate;
  attendees?: GoogleAttendee[];
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{ method: string; minutes: number }>;
  };
  visibility?: "default" | "public" | "private" | "confidential";
  htmlLink?: string;
  hangoutLink?: string;
  iCalUID?: string;
  updated?: string;
  extendedProperties?: {
    private?: Record<string, string>;
  };
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
};

type GoogleEventsList = {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

type GoogleChannel = {
  id: string;
  resourceId: string;
  resourceUri?: string;
  expiration?: string;
};

const RESPONSE_TO_TELUN = {
  needsAction: "CONVIDADO",
  accepted: "ACEITO",
  declined: "RECUSADO",
  tentative: "TENTATIVO",
} as const;

function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function googleDateTime(
  value: GoogleEventDate | undefined,
  fallback: Date,
): Date {
  const raw = value?.dateTime ?? value?.date;
  if (!raw) return fallback;
  const normalized = value?.date ? `${value.date}T00:00:00.000Z` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function telunType(value: string | undefined) {
  return value && value in CalendarEventType
    ? (value as CalendarEventType)
    : "EVENTO";
}

function googleVisibility(
  privacy: string,
): "default" | "private" | "confidential" {
  if (privacy === "CONFIDENCIAL") return "confidential";
  if (privacy === "PRIVADO" || privacy === "PARTICIPANTES") return "private";
  return "default";
}

function telunPrivacy(visibility: GoogleCalendarEvent["visibility"]) {
  if (visibility === "confidential") return "CONFIDENCIAL" as const;
  if (visibility === "private") return "PRIVADO" as const;
  return "INTERNO" as const;
}

function allDayDate(date: Date, timeZone: string) {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return formatted;
}

async function eventToGoogle(eventId: string, createMeet: boolean) {
  const event = await prisma.calendarEvent.findUniqueOrThrow({
    where: { id: eventId },
    include: {
      participants: true,
      reminders: true,
    },
  });
  const start = event.allDay
    ? { date: allDayDate(event.startAt, event.timezone) }
    : { dateTime: event.startAt.toISOString(), timeZone: event.timezone };
  const end = event.allDay
    ? { date: allDayDate(event.endAt, event.timezone) }
    : { dateTime: event.endAt.toISOString(), timeZone: event.timezone };
  return {
    event,
    payload: {
      summary: event.title,
      description: event.description ?? undefined,
      location: event.location ?? undefined,
      start,
      end,
      visibility: googleVisibility(event.privacy),
      attendees: event.participants.flatMap((participant) =>
        participant.email
          ? [
              {
                email: participant.email,
                displayName: participant.name ?? undefined,
              },
            ]
          : [],
      ),
      reminders:
        event.reminders.length > 0
          ? {
              useDefault: false,
              overrides: event.reminders.map((reminder) => ({
                method: "popup",
                minutes: reminder.minutesBefore,
              })),
            }
          : { useDefault: true },
      extendedProperties: {
        private: {
          telunEventId: event.id,
          telunVersion: String(event.sourceVersion),
          telunType: event.type,
        },
      },
      ...(createMeet
        ? {
            conferenceData: {
              createRequest: {
                requestId: `telun-${event.id}-${event.sourceVersion}`,
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            },
          }
        : {}),
    },
  };
}

async function recordConflict(params: {
  integration: CalendarIntegration;
  eventId: string;
  externalEventId?: string;
  google: unknown;
}) {
  const event = await prisma.calendarEvent.findUniqueOrThrow({
    where: { id: params.eventId },
    include: calendarEventInclude,
  });
  return prisma.calendarSyncConflict.create({
    data: {
      integrationId: params.integration.id,
      eventId: params.eventId,
      externalEventId: params.externalEventId ?? null,
      telunSnapshot: safeJson(event),
      googleSnapshot: safeJson(params.google),
    },
  });
}

export async function pushEventToGoogle(
  integration: CalendarIntegration,
  eventId: string,
  createMeet = false,
) {
  const { event, payload } = await eventToGoogle(eventId, createMeet);
  const calendarId = integration.selectedCalendarId;
  if (!calendarId) throw new Error("Selecione um calendário do Google.");
  const mapping = await prisma.calendarExternalMapping.findUnique({
    where: {
      integrationId_eventId: { integrationId: integration.id, eventId },
    },
  });

  if (event.deletedAt || event.status === "CANCELADO") {
    if (mapping && !mapping.deletedExternally) {
      try {
        await googleCalendarRequest<Record<string, never>>(
          integration,
          `/calendars/${encodeURIComponent(mapping.externalCalendarId)}/events/${encodeURIComponent(mapping.externalEventId)}`,
          { method: "DELETE" },
        );
      } catch (error) {
        if (!(error instanceof GoogleCalendarApiError) || error.status !== 410) {
          throw error;
        }
      }
      await prisma.calendarExternalMapping.update({
        where: { id: mapping.id },
        data: { deletedExternally: true, lastSyncedAt: new Date() },
      });
    }
    await prisma.calendarEvent.update({
      where: { id: eventId },
      data: { syncPending: false },
    });
    return;
  }

  let googleEvent: GoogleCalendarEvent;
  try {
    if (mapping) {
      const query = createMeet ? "?conferenceDataVersion=1" : "";
      const response = await googleCalendarRequest<GoogleCalendarEvent>(
        integration,
        `/calendars/${encodeURIComponent(mapping.externalCalendarId)}/events/${encodeURIComponent(mapping.externalEventId)}${query}`,
        {
          method: "PATCH",
          headers: mapping.etag ? { "If-Match": mapping.etag } : undefined,
          body: JSON.stringify(payload),
        },
      );
      googleEvent = response.data;
    } else {
      const query = createMeet ? "?conferenceDataVersion=1&sendUpdates=all" : "?sendUpdates=all";
      const response = await googleCalendarRequest<GoogleCalendarEvent>(
        integration,
        `/calendars/${encodeURIComponent(calendarId)}/events${query}`,
        { method: "POST", body: JSON.stringify(payload) },
      );
      googleEvent = response.data;
    }
  } catch (error) {
    if (
      mapping &&
      error instanceof GoogleCalendarApiError &&
      (error.status === 409 || error.status === 412)
    ) {
      const current = await googleCalendarRequest<GoogleCalendarEvent>(
        integration,
        `/calendars/${encodeURIComponent(mapping.externalCalendarId)}/events/${encodeURIComponent(mapping.externalEventId)}`,
      );
      await recordConflict({
        integration,
        eventId,
        externalEventId: mapping.externalEventId,
        google: current.data,
      });
      return;
    }
    throw error;
  }

  const meetUrl =
    googleEvent.hangoutLink ??
    googleEvent.conferenceData?.entryPoints?.find(
      (item) => item.entryPointType === "video",
    )?.uri ??
    event.meetingUrl;
  await prisma.$transaction([
    prisma.calendarExternalMapping.upsert({
      where: {
        integrationId_eventId: { integrationId: integration.id, eventId },
      },
      update: {
        externalCalendarId: calendarId,
        externalEventId: googleEvent.id,
        etag: googleEvent.etag ?? null,
        iCalUid: googleEvent.iCalUID ?? null,
        htmlLink: googleEvent.htmlLink ?? null,
        googleUpdatedAt: googleEvent.updated
          ? new Date(googleEvent.updated)
          : null,
        lastSyncedAt: new Date(),
        lastTelunVersion: event.sourceVersion,
        deletedExternally: false,
      },
      create: {
        integrationId: integration.id,
        eventId,
        externalCalendarId: calendarId,
        externalEventId: googleEvent.id,
        etag: googleEvent.etag ?? null,
        iCalUid: googleEvent.iCalUID ?? null,
        htmlLink: googleEvent.htmlLink ?? null,
        googleUpdatedAt: googleEvent.updated
          ? new Date(googleEvent.updated)
          : null,
        lastSyncedAt: new Date(),
        lastTelunVersion: event.sourceVersion,
      },
    }),
    prisma.calendarEvent.update({
      where: { id: eventId },
      data: { meetingUrl: meetUrl ?? null, syncPending: false },
    }),
  ]);
}

async function pullGoogleEvent(
  integration: CalendarIntegration,
  calendarId: string,
  google: GoogleCalendarEvent,
) {
  if (!google.id) return;
  const mapping = await prisma.calendarExternalMapping.findUnique({
    where: {
      integrationId_externalCalendarId_externalEventId: {
        integrationId: integration.id,
        externalCalendarId: calendarId,
        externalEventId: google.id,
      },
    },
    include: { event: true },
  });
  if (google.status === "cancelled") {
    if (!mapping) return;
    if (mapping.event.sourceVersion > mapping.lastTelunVersion) {
      await recordConflict({
        integration,
        eventId: mapping.eventId,
        externalEventId: google.id,
        google,
      });
      return;
    }
    await prisma.$transaction([
      prisma.calendarEvent.update({
        where: { id: mapping.eventId },
        data: {
          deletedAt: new Date(),
          status: "CANCELADO",
          cancelledAt: new Date(),
          syncPending: false,
        },
      }),
      prisma.calendarExternalMapping.update({
        where: { id: mapping.id },
        data: { deletedExternally: true, lastSyncedAt: new Date() },
      }),
    ]);
    return;
  }

  const startAt = googleDateTime(google.start, new Date());
  const endAt = googleDateTime(
    google.end,
    new Date(startAt.getTime() + 60 * 60 * 1_000),
  );
  const googleUpdatedAt = google.updated ? new Date(google.updated) : null;
  if (
    mapping &&
    mapping.event.sourceVersion > mapping.lastTelunVersion &&
    google.etag !== mapping.etag
  ) {
    await recordConflict({
      integration,
      eventId: mapping.eventId,
      externalEventId: google.id,
      google,
    });
    return;
  }

  const participantCreates = (google.attendees ?? []).flatMap((attendee) =>
    attendee.self
      ? []
      : [{
          email: attendee.email.toLowerCase(),
          name: attendee.displayName ?? null,
          kind: "EXTERNO" as const,
          role: "PARTICIPANTE",
          status:
            RESPONSE_TO_TELUN[
              attendee.responseStatus ?? "needsAction"
            ],
        }],
  );
  const reminderCreates = (google.reminders?.overrides ?? [])
    .filter((reminder) => reminder.method === "popup")
    .map((reminder) => ({
      amount: reminder.minutes,
      unit: "MINUTOS" as const,
      minutesBefore: reminder.minutes,
    }));
  const common = {
    title: google.summary?.trim() || "Evento sem título",
    description: google.description ?? null,
    type: telunType(google.extendedProperties?.private?.telunType),
    status: "AGENDADO" as const,
    privacy: telunPrivacy(google.visibility),
    origin: "GOOGLE" as const,
    startAt,
    endAt,
    allDay: Boolean(google.start?.date),
    timezone:
      google.start?.timeZone ||
      google.end?.timeZone ||
      "America/Sao_Paulo",
    location: google.location ?? null,
    meetingUrl:
      google.hangoutLink ??
      google.conferenceData?.entryPoints?.find(
        (item) => item.entryPointType === "video",
      )?.uri ??
      null,
    responsibleId: integration.userId,
    updatedById: integration.userId,
    syncPending: false,
  };

  if (mapping) {
    const event = await prisma.$transaction(async (tx) => {
      await tx.calendarEventParticipant.deleteMany({
        where: { eventId: mapping.eventId },
      });
      await tx.calendarEventReminder.deleteMany({
        where: { eventId: mapping.eventId },
      });
      const updated = await tx.calendarEvent.update({
        where: { id: mapping.eventId },
        data: common,
      });
      if (participantCreates.length > 0) {
        await tx.calendarEventParticipant.createMany({
          data: participantCreates.map((participant) => ({
            ...participant,
            eventId: mapping.eventId,
          })),
        });
      }
      if (reminderCreates.length > 0) {
        await tx.calendarEventReminder.createMany({
          data: reminderCreates.map((reminder) => ({
            ...reminder,
            eventId: mapping.eventId,
          })),
        });
      }
      await tx.calendarEventHistory.create({
        data: {
          eventId: mapping.eventId,
          userId: integration.userId,
          action: "sync_from_google",
          origin: "GOOGLE",
          after: safeJson(google),
        },
      });
      await tx.calendarExternalMapping.update({
        where: { id: mapping.id },
        data: {
          etag: google.etag ?? null,
          iCalUid: google.iCalUID ?? null,
          htmlLink: google.htmlLink ?? null,
          googleUpdatedAt,
          lastSyncedAt: new Date(),
          lastTelunVersion: updated.sourceVersion,
          deletedExternally: false,
        },
      });
      return updated;
    });
    return event;
  }

  const telunEventId = google.extendedProperties?.private?.telunEventId;
  const linked =
    telunEventId &&
    (await prisma.calendarEvent.findFirst({
      where: { id: telunEventId, deletedAt: null },
    }));
  return prisma.$transaction(async (tx) => {
    let event;
    if (linked) {
      await tx.calendarEventParticipant.deleteMany({
        where: { eventId: linked.id },
      });
      await tx.calendarEventReminder.deleteMany({
        where: { eventId: linked.id },
      });
      event = await tx.calendarEvent.update({
        where: { id: linked.id },
        data: common,
      });
    } else {
      event = await tx.calendarEvent.create({
        data: {
          ...common,
          tenantId: integration.tenantId,
          priority: "MEDIA",
          createdById: integration.userId,
        },
      });
    }
    if (participantCreates.length > 0) {
      await tx.calendarEventParticipant.createMany({
        data: participantCreates.map((participant) => ({
          ...participant,
          eventId: event.id,
        })),
      });
    }
    if (reminderCreates.length > 0) {
      await tx.calendarEventReminder.createMany({
        data: reminderCreates.map((reminder) => ({
          ...reminder,
          eventId: event.id,
        })),
      });
    }
    await tx.calendarEventHistory.create({
      data: {
        eventId: event.id,
        userId: integration.userId,
        action: linked ? "sync_from_google" : "import_from_google",
        origin: "GOOGLE",
        after: safeJson(google),
      },
    });
    await tx.calendarExternalMapping.upsert({
      where: {
        integrationId_eventId: {
          integrationId: integration.id,
          eventId: event.id,
        },
      },
      update: {
        externalCalendarId: calendarId,
        externalEventId: google.id,
        etag: google.etag ?? null,
        iCalUid: google.iCalUID ?? null,
        htmlLink: google.htmlLink ?? null,
        googleUpdatedAt,
        lastSyncedAt: new Date(),
        lastTelunVersion: event.sourceVersion,
        deletedExternally: false,
      },
      create: {
        integrationId: integration.id,
        eventId: event.id,
        externalCalendarId: calendarId,
        externalEventId: google.id,
        etag: google.etag ?? null,
        iCalUid: google.iCalUID ?? null,
        htmlLink: google.htmlLink ?? null,
        googleUpdatedAt,
        lastSyncedAt: new Date(),
        lastTelunVersion: event.sourceVersion,
      },
    });
    return event;
  });
}

export async function syncGoogleCalendar(
  integration: CalendarIntegration,
  forceFull = false,
) {
  const calendarId = integration.selectedCalendarId;
  if (!calendarId) throw new Error("Selecione um calendário do Google.");
  const syncToken =
    !forceFull && integration.syncTokenEncrypted
      ? decryptCalendarSecret(
          integration.syncTokenEncrypted,
          `sync-token:${integration.userId}`,
        )
      : null;
  let pageToken: string | null = null;
  let nextSyncToken: string | null = null;
  let imported = 0;
  try {
    do {
      const search = new URLSearchParams({
        maxResults: "2500",
        showDeleted: "true",
        singleEvents: "true",
      });
      if (syncToken) search.set("syncToken", syncToken);
      if (pageToken) search.set("pageToken", pageToken);
      const response = await googleCalendarRequest<GoogleEventsList>(
        integration,
        `/calendars/${encodeURIComponent(calendarId)}/events?${search}`,
      );
      for (const item of response.data.items ?? []) {
        await pullGoogleEvent(integration, calendarId, item);
        imported += 1;
      }
      pageToken = response.data.nextPageToken ?? null;
      nextSyncToken = response.data.nextSyncToken ?? nextSyncToken;
    } while (pageToken);
  } catch (error) {
    if (
      syncToken &&
      error instanceof GoogleCalendarApiError &&
      error.status === 410
    ) {
      await prisma.calendarIntegration.update({
        where: { id: integration.id },
        data: { syncTokenEncrypted: null },
      });
      return syncGoogleCalendar(
        { ...integration, syncTokenEncrypted: null },
        true,
      );
    }
    throw error;
  }
  await prisma.calendarIntegration.update({
    where: { id: integration.id },
    data: {
      syncTokenEncrypted: nextSyncToken
        ? encryptCalendarSecret(
            nextSyncToken,
            `sync-token:${integration.userId}`,
          )
        : integration.syncTokenEncrypted,
      lastSyncAt: new Date(),
      lastSuccessfulSyncAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
      consecutiveFailures: 0,
      status: "CONECTADO",
    },
  });
  return { imported, incremental: Boolean(syncToken) };
}

export async function renewNotificationChannel(
  integration: CalendarIntegration,
) {
  const config = googleCalendarConfiguration();
  if (!config.webhookUrl) {
    throw new Error("A URL HTTPS do webhook Google não está configurada.");
  }
  if (!integration.selectedCalendarId) {
    throw new Error("Selecione um calendário do Google.");
  }
  const channelId = randomUUID();
  const channelToken = randomBytes(32).toString("base64url");
  const requestedExpiration = Date.now() + 6 * 24 * 60 * 60 * 1_000;
  const response = await googleCalendarRequest<GoogleChannel>(
    integration,
    `/calendars/${encodeURIComponent(integration.selectedCalendarId)}/events/watch`,
    {
      method: "POST",
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: config.webhookUrl,
        token: channelToken,
        expiration: String(requestedExpiration),
      }),
    },
  );
  const expiration = new Date(
    Number(response.data.expiration ?? requestedExpiration),
  );
  await prisma.$transaction([
    prisma.calendarNotificationChannel.updateMany({
      where: { integrationId: integration.id, status: "ATIVO" },
      data: { status: "SUBSTITUIDO" },
    }),
    prisma.calendarNotificationChannel.create({
      data: {
        integrationId: integration.id,
        channelId,
        channelTokenHash: hashOpaqueToken(channelToken),
        resourceId: response.data.resourceId,
        resourceUri: response.data.resourceUri ?? null,
        expiration,
      },
    }),
  ]);
  return { channelId, expiration };
}

export async function processCalendarSyncJob(job: CalendarSyncJob) {
  const integration = job.integrationId
    ? await prisma.calendarIntegration.findUnique({
        where: { id: job.integrationId },
      })
    : null;
  try {
    if (!integration) throw new Error("Integração do job não encontrada.");
    if (integration.status !== "CONECTADO") {
      throw new Error("Integração Google desconectada.");
    }
    const payload = (job.payload ?? {}) as Record<string, unknown>;
    switch (job.type) {
      case "FULL_SYNC":
        await syncGoogleCalendar(integration, true);
        break;
      case "INCREMENTAL_SYNC":
        await syncGoogleCalendar(integration, false);
        break;
      case "PUSH_EVENT":
        if (typeof payload.eventId !== "string") {
          throw new Error("Job sem eventId.");
        }
        await pushEventToGoogle(
          integration,
          payload.eventId,
          payload.createGoogleMeet === true,
        );
        break;
      case "DELETE_EVENT":
        if (typeof payload.eventId !== "string") {
          throw new Error("Job sem eventId.");
        }
        await pushEventToGoogle(integration, payload.eventId, false);
        break;
      case "RENEW_CHANNEL":
        await renewNotificationChannel(integration);
        break;
    }
    await prisma.calendarSyncJob.update({
      where: { id: job.id },
      data: {
        status: "CONCLUIDO",
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
  } catch (error) {
    const finalAttempt = job.attempts >= job.maxAttempts;
    const code =
      error instanceof GoogleCalendarApiError ? error.code : "SYNC_ERROR";
    const message =
      error instanceof Error ? error.message.slice(0, 500) : "Erro de sincronização.";
    await prisma.$transaction([
      prisma.calendarSyncJob.update({
        where: { id: job.id },
        data: {
          status: finalAttempt ? "CANCELADO" : "ERRO",
          runAt: finalAttempt ? job.runAt : retryAt(job.attempts),
          lockedAt: null,
          lockedBy: null,
          lastErrorCode: code,
          lastErrorMessage: message,
        },
      }),
      ...(integration
        ? [
            prisma.calendarIntegration.update({
              where: { id: integration.id },
              data: {
                lastSyncAt: new Date(),
                lastErrorCode: code,
                lastErrorMessage: message,
                consecutiveFailures: { increment: 1 },
                status: finalAttempt ? "ERRO" : integration.status,
              },
            }),
          ]
        : []),
    ]);
    throw error;
  }
}

export async function scheduleChannelRenewals() {
  const threshold = new Date(Date.now() + 48 * 60 * 60 * 1_000);
  const integrations = await prisma.calendarIntegration.findMany({
    where: {
      status: "CONECTADO",
      selectedCalendarId: { not: null },
      OR: [
        { channels: { none: { status: "ATIVO" } } },
        {
          channels: {
            some: { status: "ATIVO", expiration: { lte: threshold } },
          },
        },
      ],
    },
  });
  for (const integration of integrations) {
    const bucket = new Date().toISOString().slice(0, 10);
    await enqueueCalendarJob({
      integrationId: integration.id,
      type: "RENEW_CHANNEL",
      idempotencyKey: calendarJobKey("RENEW_CHANNEL", [
        integration.id,
        bucket,
      ]),
    });
  }
  return integrations.length;
}
