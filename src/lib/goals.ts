import { prisma } from "@/lib/prisma";
import type { Goal, GoalPeriod, GoalStatus } from "@prisma/client";

function months(period: GoalPeriod, month: number | null, quarter: number | null): number[] {
  if ((period === "SEMANAL" || period === "MENSAL") && month) return [month];
  if (period === "TRIMESTRAL" && quarter) {
    const s = (quarter - 1) * 3 + 1;
    return [s, s + 1, s + 2];
  }
  if (period === "MENSAL" && month) return [month];
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

/**
 * Janela de datas de uma meta. Datas explícitas (start/end) têm prioridade.
 * Para metas SEMANAIS, a semana N cobre os dias [(N-1)*7+1 .. min(N*7, últimoDia)] do mês.
 */
export function goalDateRange(goal: Goal): { start: Date; end: Date } {
  if (goal.startDate && goal.endDate) {
    return { start: goal.startDate, end: goal.endDate };
  }
  const y = goal.year;

  if (goal.period === "SEMANAL" || goal.hierarchyLevel === "SEMANAL") {
    const m = goal.month ?? 1;
    const w = goal.week ?? 1;
    const lastDay = new Date(y, m, 0).getDate();
    const from = Math.min((w - 1) * 7 + 1, lastDay);
    const to = Math.min(w * 7, lastDay);
    return {
      start: new Date(y, m - 1, from),
      end: new Date(y, m - 1, to, 23, 59, 59, 999),
    };
  }

  const ms = months(goal.period, goal.month, goal.quarter);
  const first = ms[0];
  const last = ms[ms.length - 1];
  return {
    start: new Date(y, first - 1, 1),
    end: new Date(y, last, 0, 23, 59, 59, 999),
  };
}

/** Calcula o valor atual de uma meta automática a partir dos dados reais. */
export async function computeGoalCurrentValue(goal: Goal): Promise<number> {
  const cc = goal.costCenterId ?? undefined;
  const ms = months(goal.period, goal.month, goal.quarter);
  const { start, end } = goalDateRange(goal);
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

/** Status simples (compat com chamadas antigas). */
export function goalStatusFor(progressPct: number): GoalStatus {
  if (progressPct >= 100) return "BATIDA";
  if (progressPct >= 50) return "NO_PRAZO";
  return "EM_RISCO";
}

/**
 * Status rico considerando alvo, valor atual, janela e ritmo.
 * - SUPERADA: ultrapassou o alvo. BATIDA: atingiu exatamente.
 * - NAO_INICIADA: período não começou e valor 0.
 * - ATRASADA: prazo passou sem atingir.
 * - NO_PRAZO/EM_RISCO: dentro da janela conforme o ritmo. EM_ANDAMENTO: começou, sem ritmo suficiente p/ avaliar.
 */
export function computeGoalStatus(
  target: number,
  current: number,
  start: Date | null,
  end: Date | null,
  now: Date,
  canceled: boolean,
): GoalStatus {
  if (canceled) return "CANCELADA";

  if (target > 0) {
    if (current > target) return "SUPERADA";
    if (current >= target) return "BATIDA";
  }

  const t = now.getTime();
  if (start && t < start.getTime()) return current > 0 ? "EM_ANDAMENTO" : "NAO_INICIADA";
  if (end && t > end.getTime()) return "ATRASADA";

  if (start && end) {
    const total = end.getTime() - start.getTime();
    const elapsedFrac = total > 0 ? Math.min(1, Math.max(0, (t - start.getTime()) / total)) : 1;
    const progressFrac = target > 0 ? current / target : 0;
    if (progressFrac >= elapsedFrac) return current > 0 ? "NO_PRAZO" : "EM_ANDAMENTO";
    if (current > 0) return "EM_RISCO";
    return elapsedFrac > 0.15 ? "EM_RISCO" : "EM_ANDAMENTO";
  }

  const pct = target > 0 ? (current / target) * 100 : 0;
  if (pct >= 100) return "BATIDA";
  if (pct >= 50) return "NO_PRAZO";
  if (pct > 0) return "EM_ANDAMENTO";
  return "NAO_INICIADA";
}

export type GoalPace = {
  remaining: number;
  neededPerWeek: number;
  currentPerWeek: number;
  daysLate: number;
  weeksLeft: number;
};

/** Ritmo atual vs. necessário, e atraso, para exibição em metas em risco/atrasadas. */
export function goalPace(goal: Goal, now: Date = new Date()): GoalPace {
  const { start, end } = goalDateRange(goal);
  const MS_WEEK = 7 * 24 * 3600 * 1000;
  const MS_DAY = 24 * 3600 * 1000;
  const t = now.getTime();
  const remaining = Math.max(0, goal.targetValue - goal.currentValue);
  const weeksLeft = end ? Math.max(0, (end.getTime() - t) / MS_WEEK) : 0;
  const neededPerWeek = weeksLeft > 0 ? remaining / weeksLeft : remaining;
  const elapsedWeeks = start ? Math.max(0, (t - start.getTime()) / MS_WEEK) : 0;
  const currentPerWeek = elapsedWeeks > 0 ? goal.currentValue / elapsedWeeks : goal.currentValue;
  const daysLate = end && t > end.getTime() ? Math.floor((t - end.getTime()) / MS_DAY) : 0;
  return { remaining, neededPerWeek, currentPerWeek, daysLate, weeksLeft };
}

/** Ações registradas no histórico da meta (gravadas em AuditLog). */
export type GoalAction =
  | "CRIADA"
  | "ATUALIZADA"
  | "VINCULADA"
  | "DESVINCULADA"
  | "RESP_ADICIONADO"
  | "RESP_REMOVIDO"
  | "ALVO_ALTERADO"
  | "ATUAL_ALTERADO"
  | "STATUS_ALTERADO"
  | "BATIDA"
  | "SUPERADA"
  | "RECALCULADA"
  | "CANCELADA"
  | "REABERTA"
  | "EXCLUIDA";

/** Registra um evento no histórico/auditoria da meta. Nunca lança. */
export async function logGoal(
  goalId: string,
  action: GoalAction,
  metadata: Record<string, unknown> = {},
  userId?: string | null,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entity: "Goal",
        entityId: goalId,
        action,
        metadata: metadata as object,
        userId: userId ?? null,
      },
    });
  } catch {
    // auditoria é best-effort; não bloquear a operação principal.
  }
}

const LEVEL_ORDER = ["SEMANAL", "MENSAL", "TRIMESTRAL", "AVULSA"];

/**
 * Recalcula valor/progresso/status de TODA a árvore de metas, de baixo p/ cima.
 * - Metas pai com filhas (mesma unidade e includeInParentProgress) → valor = soma das filhas.
 * - Metas folha automáticas → valor da origem real (computeGoalCurrentValue).
 * - Metas folha manuais → mantêm o valor informado.
 * Seta achievedAt/exceededAt na 1ª vez e registra histórico de batida/superação.
 */
export async function recomputeGoalTree(performedById?: string | null): Promise<void> {
  const goals = await prisma.goal.findMany({ where: { deletedAt: null } });

  const childrenOf = new Map<string, Goal[]>();
  for (const g of goals) {
    if (!g.parentGoalId) continue;
    const arr = childrenOf.get(g.parentGoalId) ?? [];
    arr.push(g);
    childrenOf.set(g.parentGoalId, arr);
  }

  const sorted = [...goals].sort(
    (a, b) => LEVEL_ORDER.indexOf(a.hierarchyLevel) - LEVEL_ORDER.indexOf(b.hierarchyLevel),
  );

  const computed = new Map<string, number>();
  const now = new Date();

  for (const g of sorted) {
    const kids = (childrenOf.get(g.id) ?? []).filter(
      (k) => k.includeInParentProgress && k.unit === g.unit,
    );

    let current: number;
    if (kids.length > 0) {
      current = kids.reduce((s, k) => s + (computed.get(k.id) ?? k.currentValue), 0);
    } else if (g.calculationMode === "AUTOMATICO") {
      current = await computeGoalCurrentValue(g);
    } else {
      current = g.currentValue;
    }
    computed.set(g.id, current);

    const { start, end } = goalDateRange(g);
    const canceled = g.status === "CANCELADA";
    const status = computeGoalStatus(g.targetValue, current, start, end, now, canceled);
    const progress = g.targetValue > 0 ? (current / g.targetValue) * 100 : 0;

    const data: {
      currentValue: number;
      progressPercentage: number;
      status: GoalStatus;
      achievedAt?: Date;
      exceededAt?: Date;
    } = { currentValue: current, progressPercentage: progress, status };

    const reached = status === "BATIDA" || status === "SUPERADA";
    if (reached && !g.achievedAt) data.achievedAt = now;
    if (status === "SUPERADA" && !g.exceededAt) data.exceededAt = now;

    const changed =
      current !== g.currentValue ||
      status !== g.status ||
      data.achievedAt !== undefined ||
      data.exceededAt !== undefined;

    if (!changed) continue;

    await prisma.goal.update({ where: { id: g.id }, data });

    if (reached && g.status !== status) {
      await logGoal(
        g.id,
        status === "SUPERADA" ? "SUPERADA" : "BATIDA",
        { previous: { status: g.status, value: g.currentValue }, next: { status, value: current }, at: now },
        performedById,
      );
    }
  }
}
