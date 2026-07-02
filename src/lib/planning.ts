import { randomUUID } from "node:crypto";
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

  const owner = createdById ?? null;
  const yr = yearRange(year);
  const annualId = randomUUID();

  const annual: Prisma.PlanningPeriodCreateManyInput = {
    id: annualId, name: String(year), type: "ANUAL", year,
    startDate: yr.start, endDate: yr.end, status: "PLANEJADO", createdById: owner,
  };
  const quarters: Prisma.PlanningPeriodCreateManyInput[] = [];
  const months: Prisma.PlanningPeriodCreateManyInput[] = [];
  const weeks: Prisma.PlanningPeriodCreateManyInput[] = [];

  for (let q = 1; q <= 4; q++) {
    const quarterId = randomUUID();
    const qr = quarterRange(year, q);
    quarters.push({
      id: quarterId, name: `${q}º Trimestre ${year}`, type: "TRIMESTRAL", year, quarter: q,
      startDate: qr.start, endDate: qr.end, parentId: annualId, createdById: owner,
    });
    for (let mi = 0; mi < 3; mi++) {
      const m = (q - 1) * 3 + 1 + mi;
      const monthId = randomUUID();
      const mr = monthRange(year, m);
      months.push({
        id: monthId, name: monthLabel(m, year), type: "MENSAL", year, quarter: q, month: m,
        startDate: mr.start, endDate: mr.end, parentId: quarterId, createdById: owner,
      });
      for (const w of calendarWeeksOfMonth(year, m)) {
        weeks.push({
          id: randomUUID(), name: `Semana ${w.week} · ${monthShort(m)}/${year}`, type: "SEMANAL",
          year, quarter: q, month: m, week: w.week,
          startDate: spDayStart(year, m, w.startDay), endDate: spDayEnd(year, m, w.endDay),
          parentId: monthId, createdById: owner,
        });
      }
    }
  }

  // createMany por nível (pais antes das filhas), numa transação em lote: rápido e
  // atômico, sem ~69 round-trips sequenciais (evitava o timeout de transação
  // interativa quando o request vem da Vercel via internet até o Postgres da VPS).
  await prisma.$transaction([
    prisma.planningPeriod.createMany({ data: [annual] }),
    prisma.planningPeriod.createMany({ data: quarters }),
    prisma.planningPeriod.createMany({ data: months }),
    prisma.planningPeriod.createMany({ data: weeks }),
  ]);

  const created = await prisma.planningPeriod.findUnique({ where: { id: annualId } });
  return created!;
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
