import { prisma } from "@/lib/prisma";

export type CostCenterOverview = {
  month: number;
  year: number;
  monthlyBudget: number;
  realizedRevenue: number;
  realizedExpense: number;
  saldo: number;
  pctConsumed: number;
  activeGoals: number;
  goalsAtRisk: number;
  openTasks: number;
  overdueTasks: number;
  lastMovement: Date | null;
};

export async function getCostCenterOverview(
  costCenterId: string,
  ref: Date = new Date(),
): Promise<CostCenterOverview> {
  const month = ref.getMonth() + 1;
  const year = ref.getFullYear();

  const [
    cc,
    monthlyBudget,
    revAgg,
    expAgg,
    activeGoals,
    goalsAtRisk,
    openTasks,
    overdueTasks,
    lastEntry,
  ] = await Promise.all([
    prisma.costCenter.findUnique({ where: { id: costCenterId }, select: { monthlyBudgetDefault: true } }),
    prisma.budget.findFirst({
      where: { costCenterId, periodType: "MENSAL", month, year, deletedAt: null, status: { in: ["APROVADO", "ATIVO"] } },
      select: { plannedExpense: true },
    }),
    prisma.financialEntry.aggregate({
      _sum: { value: true },
      where: { deletedAt: null, costCenterId, type: "RECEITA", status: { not: "CANCELADO" }, competenceMonth: month, competenceYear: year },
    }),
    prisma.financialEntry.aggregate({
      _sum: { value: true },
      where: { deletedAt: null, costCenterId, type: "DESPESA", status: { not: "CANCELADO" }, competenceMonth: month, competenceYear: year },
    }),
    prisma.goal.count({ where: { deletedAt: null, costCenterId, status: { in: ["NO_PRAZO", "EM_RISCO"] } } }),
    prisma.goal.count({ where: { deletedAt: null, costCenterId, status: "EM_RISCO" } }),
    prisma.task.count({ where: { deletedAt: null, costCenterId, status: { notIn: ["CONCLUIDA", "CANCELADA"] } } }),
    prisma.task.count({ where: { deletedAt: null, costCenterId, status: { notIn: ["CONCLUIDA", "CANCELADA"] }, dueDate: { lt: ref } } }),
    prisma.financialEntry.findFirst({
      where: { deletedAt: null, costCenterId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const budget = monthlyBudget?.plannedExpense ?? cc?.monthlyBudgetDefault ?? 0;
  const realizedRevenue = revAgg._sum.value ?? 0;
  const realizedExpense = expAgg._sum.value ?? 0;

  return {
    month,
    year,
    monthlyBudget: budget,
    realizedRevenue,
    realizedExpense,
    saldo: budget - realizedExpense,
    pctConsumed: budget > 0 ? (realizedExpense / budget) * 100 : 0,
    activeGoals,
    goalsAtRisk,
    openTasks,
    overdueTasks,
    lastMovement: lastEntry?.createdAt ?? null,
  };
}
