import { prisma } from "@/lib/prisma";
import type { Goal, GoalPeriod, GoalStatus } from "@prisma/client";
import { spDayStart, spDayEnd, daysInMonth } from "@/lib/tz";
import {
  goalStatusFor,
  computeGoalStatus,
  equalSplit,
  distributeAssignees,
  sumChecklistContributions,
  effectiveResponsibles,
  effectiveCostCenter,
  type AssigneeDistInput,
  type GoalLite,
  type EffectiveResponsibles,
  type EffectiveCostCenter,
} from "@/lib/goal-math";

// Reexporta as funções puras (definidas em goal-math.ts) mantendo os imports existentes.
export { goalStatusFor, computeGoalStatus, equalSplit, distributeAssignees, sumChecklistContributions, effectiveResponsibles, effectiveCostCenter };
export type { AssigneeDistInput, GoalLite, EffectiveResponsibles, EffectiveCostCenter };

/**
 * Carrega uma meta e TODOS os seus ancestrais (cadeia de meta-pai) num Map, para
 * resolver herança de responsável/CC em memória sem N+1. Normaliza responsáveis:
 * usa `assignees`; se vazios mas houver `responsibleId` legado, sintetiza a entrada.
 */
export async function loadGoalAncestry(seedIds: string[]): Promise<Map<string, GoalLite>> {
  const map = new Map<string, GoalLite>();
  let frontier = [...new Set(seedIds)].filter(Boolean);
  let guard = 0;
  while (frontier.length > 0 && guard++ < 15) {
    const rows = await prisma.goal.findMany({
      where: { id: { in: frontier } },
      select: {
        id: true,
        parentGoalId: true,
        title: true,
        responsibleId: true,
        costCenterId: true,
        responsible: { select: { name: true } },
        assignees: { select: { userId: true, isPrimary: true, user: { select: { name: true } } } },
      },
    });
    const next: string[] = [];
    for (const r of rows) {
      const assignees =
        r.assignees.length > 0
          ? r.assignees.map((a) => ({ userId: a.userId, isPrimary: a.isPrimary, name: a.user.name }))
          : r.responsibleId
            ? [{ userId: r.responsibleId, isPrimary: true, name: r.responsible?.name ?? "—" }]
            : [];
      map.set(r.id, { id: r.id, parentGoalId: r.parentGoalId, title: r.title, responsibleId: r.responsibleId, costCenterId: r.costCenterId, assignees });
      if (r.parentGoalId && !map.has(r.parentGoalId)) next.push(r.parentGoalId);
    }
    frontier = [...new Set(next)].filter((id) => !map.has(id));
  }
  return map;
}

function months(period: GoalPeriod, month: number | null, quarter: number | null): number[] {
  if ((period === "SEMANAL" || period === "MENSAL" || period === "DIARIA") && month) return [month];
  if (period === "TRIMESTRAL" && quarter) {
    const s = (quarter - 1) * 3 + 1;
    return [s, s + 1, s + 2];
  }
  if (period === "MENSAL" && month) return [month];
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

/**
 * Janela de datas de uma meta (fuso America/Sao_Paulo).
 * Datas explícitas (start/end) têm prioridade — é assim que metas ligadas a um
 * PlanningPeriod herdam a janela exata do período. Para metas SEMANAIS legadas
 * sem datas, a semana N cobre os dias [(N-1)*7+1 .. min(N*7, últimoDia)] do mês.
 */
export function goalDateRange(goal: Goal): { start: Date; end: Date } {
  if (goal.startDate && goal.endDate) {
    return { start: goal.startDate, end: goal.endDate };
  }
  const y = goal.year;

  if (goal.period === "SEMANAL" || goal.hierarchyLevel === "SEMANAL") {
    const m = goal.month ?? 1;
    const w = goal.week ?? 1;
    const lastDay = daysInMonth(y, m);
    const from = Math.min((w - 1) * 7 + 1, lastDay);
    const to = Math.min(w * 7, lastDay);
    return { start: spDayStart(y, m, from), end: spDayEnd(y, m, to) };
  }

  const ms = months(goal.period, goal.month, goal.quarter);
  const first = ms[0];
  const last = ms[ms.length - 1];
  return { start: spDayStart(y, first, 1), end: spDayEnd(y, last, daysInMonth(y, last)) };
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

// ─────────────────────────── Contribuição de checklists ───────────────────────────

// sumChecklistContributions (pura) foi movida para goal-math.ts e é reexportada acima.

/** Valor realizado de uma meta cujo cálculo é por CHECKLIST (busca no banco). */
export async function goalChecklistValue(goalId: string): Promise<number> {
  const [primaryAgg, contribs] = await Promise.all([
    prisma.task.aggregate({
      _sum: { realizedContribution: true },
      where: { deletedAt: null, goalId },
    }),
    prisma.goalContribution.findMany({
      where: { goalId },
      select: { realizedValue: true, task: { select: { goalId: true, deletedAt: true } } },
    }),
  ]);
  const primary = primaryAgg._sum.realizedContribution ?? 0;
  const extra = contribs.reduce(
    (s, c) => (c.task && c.task.deletedAt === null && c.task.goalId !== goalId ? s + c.realizedValue : s),
    0,
  );
  return primary + extra;
}

// ─────────────────────────── Status / ritmo ───────────────────────────
// goalStatusFor e computeGoalStatus (puras) vivem em goal-math.ts (reexportadas acima).

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

// Distribuição entre responsáveis: equalSplit/distributeAssignees (puras) em goal-math.ts.

// ─────────────────────────── Histórico ───────────────────────────

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
  | "CHECKLIST_CONCLUIDO"
  | "CHECKLIST_REABERTO"
  | "FILHAS_GERADAS"
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

// ─────────────────────────── Recompute (roll-up) ───────────────────────────

const LEVEL_ORDER = ["DIARIA", "SEMANAL", "MENSAL", "TRIMESTRAL", "ANUAL", "AVULSA"];

/** Aplica valor/status/progresso calculados a uma meta e registra histórico de batida. */
async function applyGoalComputation(
  g: Goal,
  current: number,
  isAggregated: boolean,
  now: Date,
  performedById?: string | null,
): Promise<void> {
  const { start, end } = goalDateRange(g);
  const isAuto = g.calculationMode === "AUTOMATICO" || g.calculationMode === "CHECKLIST";
  let status: GoalStatus;
  if (g.status === "CANCELADA") {
    status = "CANCELADA";
  } else if (isAggregated || isAuto) {
    status = computeGoalStatus(g.targetValue, current, start, end, now, false);
  } else {
    status = g.status;
  }
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

  if (!changed) return;

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

/** Valor de uma meta-folha conforme o modo de cálculo. */
async function leafValue(g: Goal): Promise<number> {
  if (g.calculationMode === "AUTOMATICO") return computeGoalCurrentValue(g);
  if (g.calculationMode === "CHECKLIST") return goalChecklistValue(g.id);
  return g.currentValue;
}

/**
 * Recalcula valor/progresso/status de TODA a árvore de metas, de baixo p/ cima.
 * - Metas pai com filhas (mesma unidade e includeInParentProgress) → valor = soma das filhas.
 * - Metas folha → valor conforme o modo (automático / checklist / manual).
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
    } else {
      current = await leafValue(g);
    }
    computed.set(g.id, current);
    await applyGoalComputation(g, current, kids.length > 0, now, performedById);
  }
}

/**
 * Recompute DIRECIONADO: recalcula a meta informada e sobe pela cadeia de pais,
 * somando filhas quando aplicável. Muito mais barato que a árvore inteira — usado
 * quando um checklist é concluído/reaberto.
 */
export async function recomputeGoalChain(goalId: string, performedById?: string | null): Promise<void> {
  const now = new Date();
  let id: string | null = goalId;
  let guard = 0;
  while (id && guard++ < 20) {
    const currentId: string = id;
    const g = await prisma.goal.findUnique({ where: { id: currentId } });
    if (!g || g.deletedAt) break;

    const kids = await prisma.goal.findMany({
      where: { parentGoalId: currentId, deletedAt: null, includeInParentProgress: true, unit: g.unit },
      select: { currentValue: true },
    });
    const current = kids.length > 0 ? kids.reduce((s, k) => s + k.currentValue, 0) : await leafValue(g);
    await applyGoalComputation(g, current, kids.length > 0, now, performedById);
    id = g.parentGoalId;
  }
}

/** Alias mantido para compatibilidade com chamadas existentes. */
export const recalcAutomaticGoals = recomputeGoalTree;

// ─────────────────────────── Alertas ───────────────────────────

export type GoalAlertKind = "ATRASADA" | "EM_RISCO" | "PRAZO_PROXIMO" | "BATIDA" | "SUPERADA";

export type GoalAlert = {
  goalId: string;
  title: string;
  kind: GoalAlertKind;
  message: string;
};

/** Deriva alertas de saúde para o dashboard a partir de uma lista de metas. */
export function goalAlerts(goals: Goal[], now: Date = new Date()): GoalAlert[] {
  const alerts: GoalAlert[] = [];
  const MS_DAY = 24 * 3600 * 1000;
  for (const g of goals) {
    if (g.status === "ATRASADA" || g.status === "NAO_BATIDA") {
      const p = goalPace(g, now);
      alerts.push({ goalId: g.id, title: g.title, kind: "ATRASADA", message: p.daysLate > 0 ? `Atrasada há ${p.daysLate} dia(s)` : "Prazo encerrado sem atingir" });
    } else if (g.status === "EM_RISCO") {
      alerts.push({ goalId: g.id, title: g.title, kind: "EM_RISCO", message: "Ritmo abaixo do necessário" });
    } else if (g.status === "SUPERADA") {
      alerts.push({ goalId: g.id, title: g.title, kind: "SUPERADA", message: "Meta superada 🎉" });
    } else if (g.status === "BATIDA") {
      alerts.push({ goalId: g.id, title: g.title, kind: "BATIDA", message: "Meta batida ✅" });
    } else if (g.endDate || g.status === "NO_PRAZO" || g.status === "EM_ANDAMENTO") {
      const { end } = goalDateRange(g);
      const daysLeft = (end.getTime() - now.getTime()) / MS_DAY;
      if (daysLeft >= 0 && daysLeft <= 5 && g.progressPercentage < 100) {
        alerts.push({ goalId: g.id, title: g.title, kind: "PRAZO_PROXIMO", message: `Prazo em ${Math.ceil(daysLeft)} dia(s) · ${Math.round(g.progressPercentage)}%` });
      }
    }
  }
  return alerts;
}
