import { prisma } from "@/lib/prisma";
import type { PlanningPeriod, Prisma } from "@prisma/client";
import { monthShort, monthLabel } from "@/lib/format";
import {
  calendarWeeksOfMonth,
  daysInMonth,
  quarterRange,
  monthRange,
  spDayStart,
  spDayEnd,
  spDateKey,
  spKeyOf,
  weekdayOf,
  yearRange,
} from "@/lib/tz";

const WEEKDAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday] ?? "";
}

/**
 * Gera (idempotente) a árvore de planejamento de um ano:
 * ANUAL → 4× TRIMESTRAL → 12× MENSAL → semanas reais do calendário (SEMANAL).
 * Dias úteis são calculados sob demanda (ver getWeekDays) — não viram linhas.
 * Retorna o período ANUAL.
 */
export async function ensurePlanningYear(
  year: number,
  createdById?: string | null,
): Promise<PlanningPeriod> {
  const existing = await prisma.planningPeriod.findFirst({
    where: { type: "ANUAL", year },
  });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const yr = yearRange(year);
    const annual = await tx.planningPeriod.create({
      data: {
        name: String(year),
        type: "ANUAL",
        year,
        startDate: yr.start,
        endDate: yr.end,
        status: "PLANEJADO",
        createdById: createdById ?? null,
      },
    });

    for (let q = 1; q <= 4; q++) {
      const qr = quarterRange(year, q);
      const quarter = await tx.planningPeriod.create({
        data: {
          name: `${q}º Trimestre ${year}`,
          type: "TRIMESTRAL",
          year,
          quarter: q,
          startDate: qr.start,
          endDate: qr.end,
          parentId: annual.id,
          createdById: createdById ?? null,
        },
      });

      for (let mi = 0; mi < 3; mi++) {
        const m = (q - 1) * 3 + 1 + mi;
        const mr = monthRange(year, m);
        const month = await tx.planningPeriod.create({
          data: {
            name: monthLabel(m, year),
            type: "MENSAL",
            year,
            quarter: q,
            month: m,
            startDate: mr.start,
            endDate: mr.end,
            parentId: quarter.id,
            createdById: createdById ?? null,
          },
        });

        for (const w of calendarWeeksOfMonth(year, m)) {
          await tx.planningPeriod.create({
            data: {
              name: `Semana ${w.week} · ${monthShort(m)}/${year}`,
              type: "SEMANAL",
              year,
              quarter: q,
              month: m,
              week: w.week,
              startDate: spDayStart(year, m, w.startDay),
              endDate: spDayEnd(year, m, w.endDay),
              parentId: month.id,
              createdById: createdById ?? null,
            },
          });
        }
      }
    }

    return annual;
  });
}

export async function listPlanningYears() {
  return prisma.planningPeriod.findMany({
    where: { type: "ANUAL" },
    orderBy: { year: "desc" },
    include: { _count: { select: { children: true, goals: true } } },
  });
}

const CHILD_ORDER: Prisma.PlanningPeriodOrderByWithRelationInput[] = [
  { quarter: "asc" },
  { month: "asc" },
  { week: "asc" },
];

export async function getPlanningPeriod(id: string) {
  return prisma.planningPeriod.findUnique({
    where: { id },
    include: {
      children: { orderBy: CHILD_ORDER },
      parent: { select: { id: true, name: true, type: true, parentId: true } },
    },
  });
}

/** Trilha (breadcrumb) do topo até o período informado. */
export async function getPlanningBreadcrumb(
  period: { id: string; name: string; type: string; parentId: string | null },
): Promise<{ id: string; name: string; type: string }[]> {
  const chain: { id: string; name: string; type: string }[] = [
    { id: period.id, name: period.name, type: period.type },
  ];
  let parentId = period.parentId;
  let guard = 0;
  while (parentId && guard++ < 10) {
    const p = await prisma.planningPeriod.findUnique({
      where: { id: parentId },
      select: { id: true, name: true, type: true, parentId: true },
    });
    if (!p) break;
    chain.unshift({ id: p.id, name: p.name, type: p.type });
    parentId = p.parentId;
  }
  return chain;
}

export type PlanningDay = {
  key: string; // AAAA-MM-DD (SP)
  year: number;
  month: number;
  day: number;
  weekday: number;
  weekdayName: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  isWorkingDay: boolean;
  start: Date;
  end: Date;
};

/** Itera dias de calendário (SP) de um início a um fim (inclusive). */
function eachCalendarDay(startKeyParts: { y: number; m: number; d: number }, endKey: string): { y: number; m: number; d: number }[] {
  const out: { y: number; m: number; d: number }[] = [];
  let { y, m, d } = startKeyParts;
  let guard = 0;
  while (guard++ < 400) {
    out.push({ y, m, d });
    if (spDateKey(y, m, d) === endKey) break;
    d += 1;
    if (d > daysInMonth(y, m)) {
      d = 1;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  }
  return out;
}

/**
 * Dias de uma semana (período SEMANAL), com marcação de dia útil.
 * Considera fim de semana e feriados cadastrados; `includeWeekends` mostra sáb/dom.
 */
export async function getWeekDays(
  period: { startDate: Date; endDate: Date },
  includeWeekends = false,
): Promise<PlanningDay[]> {
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: period.startDate, lte: period.endDate } },
  });
  const holidayMap = new Map(holidays.map((h) => [spKeyOf(h.date), h.name]));

  const startParts = spKeyOf(period.startDate).split("-").map(Number);
  const endKey = spKeyOf(period.endDate);
  const days = eachCalendarDay({ y: startParts[0], m: startParts[1], d: startParts[2] }, endKey);

  const result: PlanningDay[] = [];
  for (const { y, m, d } of days) {
    const weekday = weekdayOf(y, m, d);
    const isWeekend = weekday === 0 || weekday === 6;
    const key = spDateKey(y, m, d);
    const holidayName = holidayMap.get(key) ?? null;
    const isHoliday = holidayName !== null;
    if (isWeekend && !includeWeekends) continue;
    result.push({
      key,
      year: y,
      month: m,
      day: d,
      weekday,
      weekdayName: weekdayName(weekday),
      isWeekend,
      isHoliday,
      holidayName,
      isWorkingDay: !isWeekend && !isHoliday,
      start: spDayStart(y, m, d),
      end: spDayEnd(y, m, d),
    });
  }
  return result;
}
