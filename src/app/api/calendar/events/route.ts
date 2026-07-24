import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  authorizeCalendarApi,
  calendarApiError,
} from "@/lib/calendar-api";
import { visibleCalendarEventWhere } from "@/lib/calendar-permissions";
import { calendarEventCreateSchema } from "@/lib/calendar/schemas";
import {
  calendarEventInclude,
  createCalendarEventSeries,
} from "@/lib/calendar/events";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function dateParam(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Intervalo inválido.");
  return date;
}

export async function GET(request: NextRequest) {
  const auth = await authorizeCalendarApi("VIEW");
  if ("response" in auth) return auth.response;
  try {
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setUTCMonth(defaultFrom.getUTCMonth() - 1);
    const defaultTo = new Date(now);
    defaultTo.setUTCMonth(defaultTo.getUTCMonth() + 3);
    const from = dateParam(request.nextUrl.searchParams.get("from"), defaultFrom);
    const to = dateParam(request.nextUrl.searchParams.get("to"), defaultTo);
    if (to <= from) throw new Error("O fim do intervalo deve ser posterior ao início.");
    if (to.getTime() - from.getTime() > 2 * 366 * 24 * 60 * 60 * 1_000) {
      throw new Error("O intervalo máximo de consulta é de dois anos.");
    }
    const requestedSources = new Set(
      (request.nextUrl.searchParams.get("sources") ?? "telun,tarefas,juridico,financeiro,feriados")
        .split(",")
        .map((value) => value.trim().toLowerCase()),
    );
    const visible = visibleCalendarEventWhere(auth.user.role, auth.user.id);
    const canFinance =
      auth.user.role === "SUPER_ADMIN" ||
      auth.user.role === "SOCIO_ADMIN" ||
      auth.user.role === "FINANCEIRO";
    const canLegal =
      auth.user.role === "SUPER_ADMIN" ||
      auth.user.role === "SOCIO_ADMIN" ||
      auth.user.role === "JURIDICO";
    const admin =
      auth.user.role === "SUPER_ADMIN" || auth.user.role === "SOCIO_ADMIN";

    const [events, tasks, deadlines, entries, holidays] = await Promise.all([
      requestedSources.has("telun")
        ? prisma.calendarEvent.findMany({
            where: {
              AND: [
                visible,
                { startAt: { lte: to } },
                { endAt: { gte: from } },
              ],
            },
            include: calendarEventInclude,
            orderBy: [{ startAt: "asc" }, { title: "asc" }],
            take: 2_000,
          })
        : Promise.resolve([]),
      requestedSources.has("tarefas")
        ? prisma.task.findMany({
            where: {
              deletedAt: null,
              dueDate: { gte: from, lte: to },
              ...(admin ? {} : { assigneeId: auth.user.id }),
            },
            select: { id: true, title: true, dueDate: true, priority: true },
            take: 1_000,
          })
        : Promise.resolve([]),
      requestedSources.has("juridico") && canLegal
        ? prisma.legalDeadline.findMany({
            where: { date: { gte: from, lte: to } },
            select: { id: true, title: true, date: true, status: true },
            take: 1_000,
          })
        : Promise.resolve([]),
      requestedSources.has("financeiro") && canFinance
        ? prisma.financialEntry.findMany({
            where: {
              deletedAt: null,
              dueDate: { gte: from, lte: to },
            },
            select: {
              id: true,
              description: true,
              dueDate: true,
              type: true,
              status: true,
            },
            take: 1_000,
          })
        : Promise.resolve([]),
      requestedSources.has("feriados")
        ? prisma.holiday.findMany({
            where: { date: { gte: from, lte: to } },
            orderBy: { date: "asc" },
          })
        : Promise.resolve([]),
    ]);

    const derived = [
      ...tasks.flatMap((item) =>
        item.dueDate
          ? [{
              id: `task:${item.id}`,
              source: "TAREFA",
              title: item.title,
              startAt: item.dueDate,
              endAt: item.dueDate,
              allDay: true,
              priority: item.priority,
              editable: false,
              href: "/dashboard/tarefas",
            }]
          : [],
      ),
      ...deadlines.map((item) => ({
        id: `legal:${item.id}`,
        source: "JURIDICO",
        title: item.title,
        startAt: item.date,
        endAt: item.date,
        allDay: true,
        status: item.status,
        editable: false,
        href: "/dashboard/juridico",
      })),
      ...entries.flatMap((item) =>
        item.dueDate
          ? [{
              id: `finance:${item.id}`,
              source: "FINANCEIRO",
              title: `${item.type === "RECEITA" ? "Receber" : "Pagar"}: ${item.description}`,
              startAt: item.dueDate,
              endAt: item.dueDate,
              allDay: true,
              status: item.status,
              editable: false,
              href:
                item.type === "RECEITA"
                  ? "/dashboard/financeiro/contas-receber"
                  : "/dashboard/financeiro/contas-pagar",
            }]
          : [],
      ),
      ...holidays.map((item) => ({
        id: `holiday:${item.id}`,
        source: "FERIADO",
        title: item.name,
        startAt: item.date,
        endAt: item.date,
        allDay: true,
        editable: false,
        href: "/dashboard/calendario",
      })),
    ];
    return NextResponse.json(
      {
        data: [
          ...events.map((event) => ({
            ...event,
            source: "TELUN",
            editable: true,
          })),
          ...derived,
        ],
        meta: { from, to, total: events.length + derived.length },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return calendarApiError(error, "Não foi possível consultar o calendário.");
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizeCalendarApi("CREATE");
  if ("response" in auth) return auth.response;
  try {
    const input = calendarEventCreateSchema.parse(await request.json());
    const result = await createCalendarEventSeries({
      input,
      userId: auth.user.id,
    });
    await writeAudit({
      userId: auth.user.id,
      action: "create",
      entity: "CalendarEvent",
      entityId: result.events[0]?.id,
      after: {
        title: input.title,
        occurrences: result.events.length,
        syncQueued: result.syncQueued,
      },
      origin: "api/calendar/events",
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return calendarApiError(error, "Não foi possível criar o evento.");
  }
}
