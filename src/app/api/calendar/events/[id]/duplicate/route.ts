import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authorizeCalendarApi,
  calendarApiError,
} from "@/lib/calendar-api";
import { visibleCalendarEventWhere } from "@/lib/calendar-permissions";
import { calendarEventCreateSchema } from "@/lib/calendar/schemas";
import { createCalendarEventSeries } from "@/lib/calendar/events";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeCalendarApi("CREATE");
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const source = await prisma.calendarEvent.findFirst({
      where: { AND: [{ id }, visibleCalendarEventWhere(auth.user.role, auth.user.id)] },
      include: { participants: true, reminders: true },
    });
    if (!source) throw Object.assign(new Error("Evento não encontrado."), { code: "P2025" });
    const override = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const input = calendarEventCreateSchema.parse({
      title: `Cópia de ${source.title}`,
      description: source.description,
      type: source.type,
      status: "AGENDADO",
      priority: source.priority,
      privacy: source.privacy,
      startAt: source.startAt,
      endAt: source.endAt,
      allDay: source.allDay,
      timezone: source.timezone,
      location: source.location,
      meetingUrl: null,
      category: source.category,
      color: source.color,
      department: source.department,
      notes: source.notes,
      costCenterId: source.costCenterId,
      goalId: source.goalId,
      planningPeriodId: source.planningPeriodId,
      clientId: source.clientId,
      supplierId: source.supplierId,
      projectId: source.projectId,
      responsibleId: auth.user.id,
      participants: source.participants.map((participant) => ({
        userId: participant.userId,
        clientId: participant.clientId,
        supplierId: participant.supplierId,
        name: participant.name,
        email: participant.email,
        kind: participant.kind,
        role: participant.role,
        status: "CONVIDADO",
      })),
      reminders: source.reminders.map((reminder) => ({
        amount: reminder.amount,
        unit: reminder.unit,
      })),
      ...override,
      recurrence: null,
    });
    const result = await createCalendarEventSeries({
      input,
      userId: auth.user.id,
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return calendarApiError(error, "Não foi possível duplicar o evento.");
  }
}
