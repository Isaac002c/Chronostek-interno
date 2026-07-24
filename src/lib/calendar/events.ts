import {
  CalendarSyncJobType,
  Prisma,
  type CalendarEvent,
} from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type {
  CalendarEventCreateInput,
} from "@/lib/calendar/schemas";
import { buildRrule, expandRecurrence } from "@/lib/calendar/recurrence";

export const calendarEventInclude = {
  participants: true,
  reminders: true,
  recurrence: true,
  externalMappings: {
    select: {
      id: true,
      externalCalendarId: true,
      externalEventId: true,
      htmlLink: true,
      lastSyncedAt: true,
      deletedExternally: true,
    },
  },
} satisfies Prisma.CalendarEventInclude;

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function jobKey(
  type: CalendarSyncJobType,
  eventId: string,
  version: number,
) {
  return createHash("sha256")
    .update(`${type}:${eventId}:${version}`)
    .digest("hex");
}

function participantData(
  participants: CalendarEventCreateInput["participants"],
): Prisma.CalendarEventParticipantUncheckedCreateWithoutEventInput[] {
  const seen = new Set<string>();
  return participants.flatMap((participant) => {
    const key = participant.userId
      ? `user:${participant.userId}`
      : participant.email
        ? `email:${participant.email.toLowerCase()}`
        : `manual:${participant.name ?? ""}:${participant.clientId ?? ""}:${participant.supplierId ?? ""}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      {
        userId: participant.userId ?? null,
        clientId: participant.clientId ?? null,
        supplierId: participant.supplierId ?? null,
        name: participant.name ?? null,
        email: participant.email?.toLowerCase() ?? null,
        kind: participant.kind,
        role: participant.role,
        status: participant.status,
      },
    ];
  });
}

function reminderData(
  reminders: CalendarEventCreateInput["reminders"],
): Prisma.CalendarEventReminderUncheckedCreateWithoutEventInput[] {
  const seen = new Set<number>();
  return reminders.flatMap((reminder) => {
    if (seen.has(reminder.minutesBefore)) return [];
    seen.add(reminder.minutesBefore);
    return [reminder];
  });
}

function baseEventData(
  input: CalendarEventCreateInput,
  userId: string,
): Omit<
  Prisma.CalendarEventUncheckedCreateInput,
  "id" | "startAt" | "endAt" | "recurrenceId" | "recurrenceInstanceKey"
> {
  return {
    tenantId: "default",
    title: input.title,
    description: input.description ?? null,
    type: input.type,
    status: input.status,
    priority: input.priority,
    privacy: input.privacy,
    origin: "TELUN",
    allDay: input.allDay,
    timezone: input.timezone,
    location: input.location ?? null,
    meetingUrl: input.meetingUrl ?? null,
    category: input.category ?? null,
    color: input.color ?? null,
    department: input.department ?? null,
    notes: input.notes ?? null,
    costCenterId: input.costCenterId ?? null,
    goalId: input.goalId ?? null,
    planningPeriodId: input.planningPeriodId ?? null,
    clientId: input.clientId ?? null,
    supplierId: input.supplierId ?? null,
    projectId: input.projectId ?? null,
    responsibleId: input.responsibleId ?? userId,
    createdById: userId,
    updatedById: userId,
    syncPending: false,
    sourceVersion: 1,
    cancelledAt: input.status === "CANCELADO" ? new Date() : null,
  } as Omit<
    Prisma.CalendarEventUncheckedCreateInput,
    "id" | "startAt" | "endAt" | "recurrenceId" | "recurrenceInstanceKey"
  >;
}

async function queuePush(
  tx: Prisma.TransactionClient,
  event: { id: string; sourceVersion: number },
  integrationId: string | null,
  createGoogleMeet: boolean,
) {
  if (!integrationId) return;
  const idempotencyKey = jobKey(
    "PUSH_EVENT",
    event.id,
    event.sourceVersion,
  );
  await tx.calendarSyncJob.upsert({
    where: { idempotencyKey },
    update: {
      status: "PENDENTE",
      runAt: new Date(),
      payload: { eventId: event.id, createGoogleMeet },
      completedAt: null,
    },
    create: {
      integrationId,
      type: "PUSH_EVENT",
      idempotencyKey,
      payload: { eventId: event.id, createGoogleMeet },
    },
  });
  await tx.calendarEvent.update({
    where: { id: event.id },
    data: { syncPending: true },
  });
}

export async function createCalendarEventSeries(params: {
  input: CalendarEventCreateInput;
  userId: string;
}) {
  const { input, userId } = params;
  const shouldSync = input.syncToGoogle || input.createGoogleMeet;
  return prisma.$transaction(
    async (tx) => {
      const integration = shouldSync
        ? await tx.calendarIntegration.findFirst({
            where: {
              userId,
              status: "CONECTADO",
              selectedCalendarId: { not: null },
            },
            select: { id: true },
          })
        : null;

      const recurrence = input.recurrence
        ? await tx.calendarRecurrence.create({
            data: {
              tenantId: "default",
              frequency: input.recurrence.frequency,
              interval: input.recurrence.interval,
              rrule: buildRrule(input.recurrence),
              timezone: input.recurrence.timezone,
              weekDays: input.recurrence.weekDays,
              monthDay: input.recurrence.monthDay ?? null,
              endType: input.recurrence.endType,
              until: input.recurrence.until ?? null,
              count: input.recurrence.count ?? null,
            },
          })
        : null;
      const occurrences = input.recurrence
        ? expandRecurrence({
            startAt: input.startAt,
            endAt: input.endAt,
            recurrence: input.recurrence,
          })
        : [
            {
              startAt: input.startAt,
              endAt: input.endAt,
              instanceKey: input.startAt.toISOString(),
            },
          ];
      if (occurrences.length === 0) {
        throw new Error("A recorrência não gerou ocorrências válidas.");
      }

      const created = [];
      for (const occurrence of occurrences) {
        const baseEvent = await tx.calendarEvent.create({
          data: {
            ...baseEventData(input, userId),
            startAt: occurrence.startAt,
            endAt: occurrence.endAt,
            recurrenceId: recurrence?.id ?? null,
            recurrenceInstanceKey: recurrence
              ? `${recurrence.id}:${occurrence.instanceKey}`
              : null,
            originalStartAt: recurrence ? occurrence.startAt : null,
          } satisfies Prisma.CalendarEventUncheckedCreateInput,
        });
        const participants = participantData(input.participants);
        const reminders = reminderData(input.reminders);
        if (participants.length > 0) {
          await tx.calendarEventParticipant.createMany({
            data: participants.map((participant) => ({
              ...participant,
              eventId: baseEvent.id,
            })),
          });
        }
        if (reminders.length > 0) {
          await tx.calendarEventReminder.createMany({
            data: reminders.map((reminder) => ({
              ...reminder,
              eventId: baseEvent.id,
            })),
          });
        }
        await tx.calendarEventHistory.create({
          data: {
            eventId: baseEvent.id,
            userId,
            action: "create",
            origin: "TELUN",
            after: jsonValue({
              ...input,
              startAt: occurrence.startAt,
              endAt: occurrence.endAt,
            }),
          },
        });
        const event = await tx.calendarEvent.findUniqueOrThrow({
          where: { id: baseEvent.id },
          include: calendarEventInclude,
        });
        await queuePush(
          tx,
          event,
          integration?.id ?? null,
          input.createGoogleMeet,
        );
        created.push(event);
      }
      return {
        events: created,
        recurrence,
        syncQueued: shouldSync && Boolean(integration),
        integrationRequired: shouldSync && !integration,
      };
    },
    { timeout: 60_000 },
  );
}

type EventUpdate = Partial<
  Omit<
    CalendarEventCreateInput,
    "recurrence" | "participants" | "reminders"
  >
> & {
  participants?: CalendarEventCreateInput["participants"];
  reminders?: CalendarEventCreateInput["reminders"];
};

const scalarUpdateKeys = [
  "title",
  "description",
  "type",
  "status",
  "priority",
  "privacy",
  "startAt",
  "endAt",
  "allDay",
  "timezone",
  "location",
  "meetingUrl",
  "category",
  "color",
  "department",
  "notes",
  "costCenterId",
  "goalId",
  "planningPeriodId",
  "clientId",
  "supplierId",
  "projectId",
  "responsibleId",
] as const;

function scalarUpdateData(
  input: EventUpdate,
  userId: string,
): Prisma.CalendarEventUncheckedUpdateInput {
  const data: Prisma.CalendarEventUncheckedUpdateInput = {
    updatedById: userId,
    sourceVersion: { increment: 1 },
  };
  for (const key of scalarUpdateKeys) {
    if (key in input) {
      (data as Record<string, unknown>)[key] =
        input[key] === undefined ? null : input[key];
    }
  }
  if (input.status === "CANCELADO") data.cancelledAt = new Date();
  if (input.status && input.status !== "CANCELADO") data.cancelledAt = null;
  return data;
}

export async function updateCalendarEvents(params: {
  event: CalendarEvent;
  input: EventUpdate;
  scope: "current" | "following" | "series";
  userId: string;
}) {
  const { event, input, scope, userId } = params;
  const startsAt = input.startAt ?? event.startAt;
  const endsAt = input.endAt ?? event.endAt;
  if (endsAt <= startsAt) {
    throw new Error("O término deve ocorrer depois do início.");
  }

  return prisma.$transaction(
    async (tx) => {
      const ids =
        scope === "current" || !event.recurrenceId
          ? [event.id]
          : (
              await tx.calendarEvent.findMany({
                where: {
                  recurrenceId: event.recurrenceId,
                  deletedAt: null,
                  ...(scope === "following"
                    ? { startAt: { gte: event.startAt } }
                    : {}),
                },
                select: { id: true },
                orderBy: { startAt: "asc" },
                take: 500,
              })
            ).map((item) => item.id);
      const integration =
        input.syncToGoogle || input.createGoogleMeet
          ? await tx.calendarIntegration.findFirst({
              where: {
                userId,
                status: "CONECTADO",
                selectedCalendarId: { not: null },
              },
              select: { id: true },
            })
          : null;

      const updated = [];
      for (const id of ids) {
        const before = await tx.calendarEvent.findUniqueOrThrow({
          where: { id },
          include: calendarEventInclude,
        });
        if (input.participants) {
          await tx.calendarEventParticipant.deleteMany({ where: { eventId: id } });
        }
        if (input.reminders) {
          await tx.calendarEventReminder.deleteMany({ where: { eventId: id } });
        }
        await tx.calendarEvent.update({
          where: { id },
          data: scalarUpdateData(input, userId),
        });
        if (input.participants) {
          const participants = participantData(input.participants);
          if (participants.length > 0) {
            await tx.calendarEventParticipant.createMany({
              data: participants.map((participant) => ({
                ...participant,
                eventId: id,
              })),
            });
          }
        }
        if (input.reminders) {
          const reminders = reminderData(input.reminders);
          if (reminders.length > 0) {
            await tx.calendarEventReminder.createMany({
              data: reminders.map((reminder) => ({
                ...reminder,
                eventId: id,
              })),
            });
          }
        }
        await tx.calendarEventHistory.create({
          data: {
            eventId: id,
            userId,
            action: `update:${scope}`,
            origin: "TELUN",
            before: jsonValue(before),
            after: jsonValue(input),
          },
        });
        const after = await tx.calendarEvent.findUniqueOrThrow({
          where: { id },
          include: calendarEventInclude,
        });
        await queuePush(
          tx,
          after,
          integration?.id ?? null,
          input.createGoogleMeet ?? false,
        );
        updated.push(after);
      }
      return {
        events: updated,
        affected: updated.length,
        syncQueued: Boolean(integration),
      };
    },
    { timeout: 60_000 },
  );
}

export async function deleteCalendarEvents(params: {
  event: CalendarEvent;
  scope: "current" | "following" | "series";
  userId: string;
}) {
  const { event, scope, userId } = params;
  return prisma.$transaction(async (tx) => {
    const where: Prisma.CalendarEventWhereInput =
      scope === "current" || !event.recurrenceId
        ? { id: event.id }
        : {
            recurrenceId: event.recurrenceId,
            ...(scope === "following"
              ? { startAt: { gte: event.startAt } }
              : {}),
          };
    const targets = await tx.calendarEvent.findMany({
      where: { ...where, deletedAt: null },
      select: {
        id: true,
        sourceVersion: true,
        externalMappings: { select: { integrationId: true } },
      },
      take: 500,
    });
    const now = new Date();
    await tx.calendarEvent.updateMany({
      where,
      data: {
        deletedAt: now,
        status: "CANCELADO",
        cancelledAt: now,
        updatedById: userId,
        sourceVersion: { increment: 1 },
      },
    });
    for (const target of targets) {
      await tx.calendarEventHistory.create({
        data: {
          eventId: target.id,
          userId,
          action: `delete:${scope}`,
          origin: "TELUN",
        },
      });
      for (const mapping of target.externalMappings) {
        const version = target.sourceVersion + 1;
        const idempotencyKey = jobKey("DELETE_EVENT", target.id, version);
        await tx.calendarSyncJob.upsert({
          where: { idempotencyKey },
          update: { status: "PENDENTE", runAt: now, completedAt: null },
          create: {
            integrationId: mapping.integrationId,
            type: "DELETE_EVENT",
            idempotencyKey,
            payload: { eventId: target.id },
          },
        });
      }
    }
    return { affected: targets.length };
  });
}
