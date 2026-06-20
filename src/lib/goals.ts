import { prisma } from "@/lib/prisma";
import type { Goal, GoalPeriod, GoalStatus } from "@prisma/client";

function months(period: GoalPeriod, month: number | null, quarter: number | null): number[] {
  if (period === "MENSAL" && month) return [month];
  if (period === "TRIMESTRAL" && quarter) {
    const s = (quarter - 1) * 3 + 1;
    return [s, s + 1, s + 2];
  }
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

function dateRange(period: GoalPeriod, month: number | null, quarter: number | null, year: number) {
  const ms = months(period, month, quarter);
  const first = ms[0];
  const last = ms[ms.length - 1];
  const start = new Date(year, first - 1, 1);
  const end = new Date(year, last, 0, 23, 59, 59, 999);
  return { start, end };
}

/** Calcula o valor atual de uma meta automática a partir dos dados reais. */
export async function computeGoalCurrentValue(goal: Goal): Promise<number> {
  const cc = goal.costCenterId ?? undefined;
  const ms = months(goal.period, goal.month, goal.quarter);
  const { start, end } = dateRange(goal.period, goal.month, goal.quarter, goal.year);
  const compWhere = { competenceYear: goal.year, competenceMonth: { in: ms } };
  const ccWhere = cc ? { costCenterId: cc } : {};

  switch (goal.type) {
    case "RECEITA": {
      const r = await prisma.financialEntry.aggregate({ _sum: { value: true }, where: { deletedAt: null, type: "RECEITA", status: { not: "CANCELADO" }, ...compWhere, ...ccWhere } });
      return r._sum.value ?? 0;
    }
    case "DESPESA": {
      const r = await prisma.financialEntry.aggregate({ _sum: { value: true }, where: { deletedAt: null, type: "DESPESA", status: { not: "CANCELADO" }, ...compWhere, ...ccWhere } });
      return r._sum.value ?? 0;
    }
    case "LUCRO": {
      const [rev, exp] = await Promise.all([
        prisma.financialEntry.aggregate({ _sum: { value: true }, where: { deletedAt: null, type: "RECEITA", status: { not: "CANCELADO" }, ...compWhere, ...ccWhere } }),
        prisma.financialEntry.aggregate({ _sum: { value: true }, where: { deletedAt: null, type: "DESPESA", status: { not: "CANCELADO" }, ...compWhere, ...ccWhere } }),
      ]);
      return (rev._sum.value ?? 0) - (exp._sum.value ?? 0);
    }
    case "LEADS":
      return prisma.lead.count({ where: { deletedAt: null, createdAt: { gte: start, lte: end }, ...ccWhere } });
    case "VENDAS":
      return prisma.lead.count({ where: { deletedAt: null, status: "GANHO", updatedAt: { gte: start, lte: end }, ...ccWhere } });
    case "CONTRATOS":
      return prisma.contract.count({ where: { deletedAt: null, status: "ATIVO", ...ccWhere } });
    case "MRR": {
      const r = await prisma.contract.aggregate({ _sum: { monthlyValue: true }, where: { deletedAt: null, status: "ATIVO", monthlyValue: { not: null }, ...ccWhere } });
      return r._sum.monthlyValue ?? 0;
    }
    case "ARR": {
      const r = await prisma.contract.aggregate({ _sum: { monthlyValue: true }, where: { deletedAt: null, status: "ATIVO", monthlyValue: { not: null }, ...ccWhere } });
      return (r._sum.monthlyValue ?? 0) * 12;
    }
    case "PROJETOS_ENTREGUES":
      return prisma.project.count({ where: { deletedAt: null, status: "ENTREGUE", updatedAt: { gte: start, lte: end }, ...ccWhere } });
    case "TAREFAS_CONCLUIDAS":
      return prisma.task.count({ where: { deletedAt: null, status: "CONCLUIDA", updatedAt: { gte: start, lte: end }, ...ccWhere } });
    case "HORAS": {
      const r = await prisma.timesheet.aggregate({ _sum: { hours: true }, where: { date: { gte: start, lte: end }, ...(cc ? { project: { costCenterId: cc } } : {}) } });
      return r._sum.hours ?? 0;
    }
    case "PRAZOS_JURIDICOS":
      return prisma.legalDeadline.count({ where: { status: "CONCLUIDO", date: { gte: start, lte: end }, ...ccWhere } });
    case "ROI_CAMPANHA": {
      const camps = await prisma.marketingCampaign.findMany({ where: { deletedAt: null, ...ccWhere }, select: { actualSpend: true, attributedRevenue: true } });
      const spend = camps.reduce((s, c) => s + (c.actualSpend ?? 0), 0);
      const rev = camps.reduce((s, c) => s + (c.attributedRevenue ?? 0), 0);
      return spend > 0 ? ((rev - spend) / spend) * 100 : 0;
    }
    default:
      return goal.currentValue;
  }
}

export function goalStatusFor(progressPct: number): GoalStatus {
  if (progressPct >= 100) return "BATIDA";
  if (progressPct >= 50) return "NO_PRAZO";
  return "EM_RISCO";
}
