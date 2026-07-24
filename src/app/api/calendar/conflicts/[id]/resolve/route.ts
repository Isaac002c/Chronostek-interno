import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  authorizeCalendarApi,
  calendarApiError,
} from "@/lib/calendar-api";
import { canCalendar } from "@/lib/calendar-permissions";
import { calendarJobKey, enqueueCalendarJob } from "@/lib/calendar/jobs";

export const runtime = "nodejs";

const schema = z.object({
  strategy: z.enum(["TELUN", "GOOGLE", "MERGE"]),
  merged: z
    .object({
      title: z.string().trim().min(1).max(240).optional(),
      description: z.string().max(10_000).nullable().optional(),
      startAt: z.coerce.date().optional(),
      endAt: z.coerce.date().optional(),
      location: z.string().max(500).nullable().optional(),
      meetingUrl: z.string().url().nullable().optional(),
    })
    .optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeCalendarApi("SYNC");
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const input = schema.parse(await request.json());
    const conflict = await prisma.calendarSyncConflict.findUnique({
      where: { id },
      include: { integration: true, event: true },
    });
    if (!conflict || conflict.status !== "PENDENTE") {
      throw Object.assign(new Error("Conflito não encontrado."), { code: "P2025" });
    }
    const ownsIntegration = conflict.integration.userId === auth.user.id;
    if (
      !ownsIntegration &&
      !canCalendar(auth.user.role, "RESOLVE_CONFLICTS")
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Sem permissão para resolver este conflito." } },
        { status: 403 },
      );
    }
    if (input.strategy === "GOOGLE") {
      const google = conflict.googleSnapshot as {
        summary?: string;
        description?: string;
        location?: string;
        hangoutLink?: string;
        start?: { date?: string; dateTime?: string };
        end?: { date?: string; dateTime?: string };
      };
      const startRaw = google.start?.dateTime ?? google.start?.date;
      const endRaw = google.end?.dateTime ?? google.end?.date;
      await prisma.calendarEvent.update({
        where: { id: conflict.eventId },
        data: {
          title: google.summary?.trim() || conflict.event.title,
          description: google.description ?? null,
          location: google.location ?? null,
          meetingUrl: google.hangoutLink ?? null,
          startAt: startRaw ? new Date(startRaw) : undefined,
          endAt: endRaw ? new Date(endRaw) : undefined,
          syncPending: false,
          updatedById: auth.user.id,
        },
      });
    } else if (input.strategy === "MERGE" && input.merged) {
      const startAt = input.merged.startAt ?? conflict.event.startAt;
      const endAt = input.merged.endAt ?? conflict.event.endAt;
      if (endAt <= startAt) throw new Error("Intervalo mesclado inválido.");
      await prisma.calendarEvent.update({
        where: { id: conflict.eventId },
        data: {
          ...input.merged,
          startAt,
          endAt,
          sourceVersion: { increment: 1 },
          syncPending: true,
          updatedById: auth.user.id,
        },
      });
    }
    const status =
      input.strategy === "TELUN"
        ? "RESOLVIDO_TELUN"
        : input.strategy === "GOOGLE"
          ? "RESOLVIDO_GOOGLE"
          : "MESCLADO";
    const resolved = await prisma.calendarSyncConflict.update({
      where: { id },
      data: {
        status,
        resolution: input,
        resolvedById: auth.user.id,
        resolvedAt: new Date(),
      },
    });
    if (input.strategy !== "GOOGLE") {
      const current = await prisma.calendarEvent.findUniqueOrThrow({
        where: { id: conflict.eventId },
        select: { sourceVersion: true },
      });
      await enqueueCalendarJob({
        integrationId: conflict.integrationId,
        type: "PUSH_EVENT",
        idempotencyKey: calendarJobKey("PUSH_EVENT", [
          conflict.eventId,
          current.sourceVersion,
          randomUUID(),
        ]),
        payload: { eventId: conflict.eventId },
      });
    }
    return NextResponse.json({ data: resolved });
  } catch (error) {
    return calendarApiError(error, "Não foi possível resolver o conflito.");
  }
}
