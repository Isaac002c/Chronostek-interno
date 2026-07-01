// Funções PURAS de cálculo de metas (sem Prisma/IO), isoladas para testes.
// Reexportadas por goals.ts para manter os pontos de import existentes.

import type { GoalStatus, GoalAssignee } from "@prisma/client";

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
 * - NO_PRAZO/EM_RISCO: dentro da janela conforme o ritmo.
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

/** Divide um total em N partes iguais, ajustando o resto na última (soma exata). */
export function equalSplit(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.round((total / n) * 100) / 100;
  const parts = Array(n).fill(base);
  const diff = Math.round((total - base * n) * 100) / 100;
  parts[n - 1] = Math.round((parts[n - 1] + diff) * 100) / 100;
  return parts;
}

export type AssigneeDistInput = {
  distributionType: GoalAssignee["distributionType"];
  plannedValue?: number | null;
  percentage?: number | null;
};

/**
 * Valor planejado de cada responsável a partir do total da meta.
 * COMPARTILHADA = cada um responde pelo total (não somar ao total da meta).
 * As distribuições são uma VISÃO; nunca inflam o valor da meta (sem duplicidade).
 */
export function distributeAssignees(total: number, list: AssigneeDistInput[]): number[] {
  const n = list.length;
  if (n === 0) return [];
  return list.map((a, i) => {
    switch (a.distributionType) {
      case "VALOR_FIXO":
        return a.plannedValue ?? 0;
      case "PERCENTUAL":
        return Math.round(total * ((a.percentage ?? 0) / 100) * 100) / 100;
      case "IGUALITARIA":
        return equalSplit(total, n)[i];
      case "COMPARTILHADA":
      default:
        return total;
    }
  });
}

// ─────────────────────────── Herança (responsável / centro de custo) ───────────────────────────

/** Representação leve de uma meta para resolver herança em memória. */
export type GoalLite = {
  id: string;
  parentGoalId: string | null;
  title: string;
  responsibleId: string | null;
  costCenterId: string | null;
  assignees: { userId: string; isPrimary: boolean; name: string }[];
};

export type EffectiveResponsibles = {
  assignees: { userId: string; isPrimary: boolean; name: string }[];
  inherited: boolean;
  inheritedFromId: string | null;
  inheritedFromTitle: string | null;
};

export type EffectiveCostCenter = {
  costCenterId: string | null;
  inherited: boolean;
  inheritedFromId: string | null;
  inheritedFromTitle: string | null;
};

/**
 * Responsáveis EFETIVOS de uma meta: os próprios, se existirem; senão herda
 * subindo a cadeia de meta-pai até encontrar. Puro (sem IO); `byId` traz a meta
 * e seus ancestrais. Não altera dados — herança só ocorre quando o filho está vazio.
 */
export function effectiveResponsibles(goalId: string, byId: Map<string, GoalLite>): EffectiveResponsibles {
  let id: string | null = goalId;
  let guard = 0;
  while (id && guard++ < 12) {
    const node: GoalLite | undefined = byId.get(id);
    if (!node) break;
    if (node.assignees.length > 0) {
      return {
        assignees: node.assignees,
        inherited: id !== goalId,
        inheritedFromId: id !== goalId ? node.id : null,
        inheritedFromTitle: id !== goalId ? node.title : null,
      };
    }
    id = node.parentGoalId;
  }
  return { assignees: [], inherited: false, inheritedFromId: null, inheritedFromTitle: null };
}

/** Centro de custo EFETIVO: o próprio, se houver; senão herda da meta-pai mais próxima. */
export function effectiveCostCenter(goalId: string, byId: Map<string, GoalLite>): EffectiveCostCenter {
  let id: string | null = goalId;
  let guard = 0;
  while (id && guard++ < 12) {
    const node: GoalLite | undefined = byId.get(id);
    if (!node) break;
    if (node.costCenterId) {
      return {
        costCenterId: node.costCenterId,
        inherited: id !== goalId,
        inheritedFromId: id !== goalId ? node.id : null,
        inheritedFromTitle: id !== goalId ? node.title : null,
      };
    }
    id = node.parentGoalId;
  }
  return { costCenterId: null, inherited: false, inheritedFromId: null, inheritedFromTitle: null };
}

/**
 * Soma pura das contribuições realizadas para uma meta, sem duplicidade:
 * - contribuição primária: tarefas cujo `goalId` é a própria meta (realizedContribution);
 * - contribuições extras: linhas GoalContribution apontando para a meta, cuja tarefa
 *   tenha OUTRA meta primária (evita contar a mesma tarefa duas vezes).
 */
export function sumChecklistContributions(
  tasks: { goalId: string | null; deletedAt: Date | null; realizedContribution: number | null }[],
  contributions: { goalId: string; realizedValue: number; task: { goalId: string | null; deletedAt: Date | null } }[],
  goalId: string,
): number {
  const primary = tasks
    .filter((t) => t.deletedAt === null && t.goalId === goalId)
    .reduce((s, t) => s + (t.realizedContribution ?? 0), 0);
  const extra = contributions
    .filter((c) => c.goalId === goalId && c.task.deletedAt === null && c.task.goalId !== goalId)
    .reduce((s, c) => s + c.realizedValue, 0);
  return primary + extra;
}
