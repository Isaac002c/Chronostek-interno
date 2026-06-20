import { prisma } from "@/lib/prisma";
import type { BudgetPeriodType } from "@prisma/client";

/** Meses de competência cobertos por um período de orçamento. */
export function competenceMonthsForPeriod(
  periodType: BudgetPeriodType,
  month: number | null,
  quarter: number | null,
): number[] {
  if (periodType === "MENSAL" && month) return [month];
  if (periodType === "TRIMESTRAL" && quarter) {
    const start = (quarter - 1) * 3 + 1;
    return [start, start + 1, start + 2];
  }
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

export type Variance = { diff: number; pct: number };

/** Variação realizado x planejado em R$ e %. */
export function variance(planned: number, realized: number): Variance {
  const diff = realized - planned;
  const pct = planned !== 0 ? (diff / planned) * 100 : realized !== 0 ? 100 : 0;
  return { diff, pct };
}

export type RealizedResult = {
  realizedRevenue: number;
  realizedExpense: number;
  realizedProfit: number;
};

/** Realizado (competência) de um CC num período — exclui lançamentos cancelados. */
export async function getRealizedForPeriod(
  costCenterId: string,
  periodType: BudgetPeriodType,
  month: number | null,
  quarter: number | null,
  year: number,
): Promise<RealizedResult> {
  const months = competenceMonthsForPeriod(periodType, month, quarter);
  const baseWhere = {
    deletedAt: null,
    costCenterId,
    status: { not: "CANCELADO" as const },
    competenceYear: year,
    competenceMonth: { in: months },
  };
  const [rev, exp] = await Promise.all([
    prisma.financialEntry.aggregate({ _sum: { value: true }, where: { ...baseWhere, type: "RECEITA" } }),
    prisma.financialEntry.aggregate({ _sum: { value: true }, where: { ...baseWhere, type: "DESPESA" } }),
  ]);
  const realizedRevenue = rev._sum.value ?? 0;
  const realizedExpense = exp._sum.value ?? 0;
  return {
    realizedRevenue,
    realizedExpense,
    realizedProfit: realizedRevenue - realizedExpense,
  };
}

export function periodDescriptor(
  periodType: BudgetPeriodType,
  month: number | null,
  quarter: number | null,
  year: number,
): string {
  if (periodType === "MENSAL" && month) {
    const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${nomes[month - 1]}/${year}`;
  }
  if (periodType === "TRIMESTRAL" && quarter) return `${quarter}º tri ${year}`;
  return `Anual ${year}`;
}
