import { NextRequest, NextResponse } from "next/server";
import {
  authorizeCalendarApi,
  calendarApiError,
} from "@/lib/calendar-api";
import { prisma } from "@/lib/prisma";
import {
  canCalendar,
  ownsCalendarEvent,
  visibleCalendarEventWhere,
} from "@/lib/calendar-permissions";
import { updateCalendarEvents } from "@/lib/calendar/events";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeCalendarApi("EDIT_OWN");
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const event = await prisma.calendarEvent.findFirst({
      where: { AND: [{ id }, visibleCalendarEventWhere(auth.user.role, auth.user.id)] },
    });
    if (!event) throw Object.assign(new Error("Evento não encontrado."), { code: "P2025" });
    if (
      !ownsCalendarEvent(auth.user.id, event) &&
      !canCalendar(auth.user.role, "EDIT_ANY")
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Sem permissão para cancelar este evento." } },
        { status: 403 },
      );
    }
    const body = (await request.json().catch(() => ({}))) as {
      scope?: "current" | "following" | "series";
      syncToGoogle?: boolean;
    };
    const result = await updateCalendarEvents({
      event,
      input: { status: "CANCELADO", syncToGoogle: body.syncToGoogle ?? true },
      scope: body.scope ?? "current",
      userId: auth.user.id,
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    return calendarApiError(error, "Não foi possível cancelar o evento.");
  }
}
