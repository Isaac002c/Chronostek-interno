import { NextRequest, NextResponse } from "next/server";
import { CalendarSyncDirection } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  authorizeCalendarApi,
  calendarApiError,
} from "@/lib/calendar-api";
import { googleCalendarRequest } from "@/lib/calendar/google-client";
import { calendarJobKey, enqueueCalendarJob } from "@/lib/calendar/jobs";

export const runtime = "nodejs";

const schema = z.object({
  calendarId: z.string().trim().min(1).max(1_000),
  direction: z.nativeEnum(CalendarSyncDirection).default("BIDIRECIONAL"),
});

export async function PATCH(request: NextRequest) {
  const auth = await authorizeCalendarApi("CONNECT_GOOGLE");
  if ("response" in auth) return auth.response;
  try {
    const input = schema.parse(await request.json());
    const integration = await prisma.calendarIntegration.findFirstOrThrow({
      where: { userId: auth.user.id, status: "CONECTADO" },
    });
    const response = await googleCalendarRequest<{
      id: string;
      summary: string;
      accessRole?: string;
    }>(
      integration,
      `/users/me/calendarList/${encodeURIComponent(input.calendarId)}`,
    );
    if (!["owner", "writer"].includes(response.data.accessRole ?? "")) {
      throw new Error("Selecione um calendário com permissão de escrita.");
    }
    const changed = integration.selectedCalendarId !== response.data.id;
    const updated = await prisma.calendarIntegration.update({
      where: { id: integration.id },
      data: {
        selectedCalendarId: response.data.id,
        selectedCalendarName: response.data.summary,
        direction: input.direction,
        syncTokenEncrypted: changed ? null : undefined,
      },
    });
    const bucket = new Date().toISOString().slice(0, 16);
    await Promise.all([
      enqueueCalendarJob({
        integrationId: updated.id,
        type: "FULL_SYNC",
        idempotencyKey: calendarJobKey("FULL_SYNC", [updated.id, bucket]),
      }),
      enqueueCalendarJob({
        integrationId: updated.id,
        type: "RENEW_CHANNEL",
        idempotencyKey: calendarJobKey("RENEW_CHANNEL", [updated.id, bucket]),
      }),
    ]);
    return NextResponse.json({
      data: {
        selectedCalendarId: updated.selectedCalendarId,
        selectedCalendarName: updated.selectedCalendarName,
        direction: updated.direction,
        syncQueued: true,
      },
    });
  } catch (error) {
    return calendarApiError(error, "Não foi possível selecionar o calendário.");
  }
}
