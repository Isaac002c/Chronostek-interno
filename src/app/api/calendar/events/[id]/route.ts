import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authorizeCalendarApi,
  calendarApiError,
} from "@/lib/calendar-api";
import {
  canCalendar,
  ownsCalendarEvent,
  visibleCalendarEventWhere,
} from "@/lib/calendar-permissions";
import { calendarEventUpdateSchema } from "@/lib/calendar/schemas";
import {
  calendarEventInclude,
  deleteCalendarEvents,
  updateCalendarEvents,
} from "@/lib/calendar/events";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function scopeOf(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("scope") ?? "current";
  if (!["current", "following", "series"].includes(value)) {
    throw new Error("Escopo de recorrência inválido.");
  }
  return value as "current" | "following" | "series";
}

async function visibleEvent(id: string, user: { id: string; role: Parameters<typeof visibleCalendarEventWhere>[0] }) {
  return prisma.calendarEvent.findFirst({
    where: {
      AND: [{ id }, visibleCalendarEventWhere(user.role, user.id)],
    },
    include: calendarEventInclude,
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeCalendarApi("VIEW");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const event = await visibleEvent(id, auth.user);
  if (!event) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Evento não encontrado." } },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { data: event },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeCalendarApi("EDIT_OWN");
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const event = await visibleEvent(id, auth.user);
    if (!event) throw Object.assign(new Error("Evento não encontrado."), { code: "P2025" });
    if (
      !ownsCalendarEvent(auth.user.id, event) &&
      !canCalendar(auth.user.role, "EDIT_ANY")
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Sem permissão para editar este evento." } },
        { status: 403 },
      );
    }
    const input = calendarEventUpdateSchema.parse(await request.json());
    const result = await updateCalendarEvents({
      event,
      input,
      scope: scopeOf(request),
      userId: auth.user.id,
    });
    await writeAudit({
      userId: auth.user.id,
      action: "update",
      entity: "CalendarEvent",
      entityId: id,
      before: { sourceVersion: event.sourceVersion },
      after: { affected: result.affected },
      origin: "api/calendar/events",
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    return calendarApiError(error, "Não foi possível atualizar o evento.");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeCalendarApi("DELETE_OWN");
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const event = await visibleEvent(id, auth.user);
    if (!event) throw Object.assign(new Error("Evento não encontrado."), { code: "P2025" });
    if (
      !ownsCalendarEvent(auth.user.id, event) &&
      !canCalendar(auth.user.role, "DELETE_ANY")
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Sem permissão para excluir este evento." } },
        { status: 403 },
      );
    }
    const result = await deleteCalendarEvents({
      event,
      scope: scopeOf(request),
      userId: auth.user.id,
    });
    await writeAudit({
      userId: auth.user.id,
      action: "delete",
      entity: "CalendarEvent",
      entityId: id,
      after: result,
      origin: "api/calendar/events",
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    return calendarApiError(error, "Não foi possível excluir o evento.");
  }
}
