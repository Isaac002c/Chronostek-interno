import type { Goal } from "@prisma/client";
import { formatCurrency, formatNumber, formatDate, monthShort } from "@/lib/format";
import { goalPace } from "@/lib/goals";
import type { GoalNode } from "./goal-tree";

export type GoalWithRefs = Goal & {
  assignees: { isPrimary: boolean; user: { name: string } }[];
  responsible: { name: string } | null;
};

export function fmtGoalValue(value: number, unit: string): string {
  switch (unit) {
    case "REAIS":
      return formatCurrency(value);
    case "PERCENTUAL":
      return `${formatNumber(value)}%`;
    case "HORAS":
      return `${formatNumber(value)}h`;
    default:
      return formatNumber(value);
  }
}

export function goalPeriodLabel(g: Goal): string {
  if (g.hierarchyLevel === "ANUAL") return `Ano ${g.year}`;
  if (g.hierarchyLevel === "TRIMESTRAL" || (g.period === "TRIMESTRAL" && g.quarter))
    return `${g.quarter}º tri ${g.year}`;
  if (g.hierarchyLevel === "SEMANAL" || g.period === "SEMANAL")
    return `Sem ${g.week ?? "?"} · ${g.month ? monthShort(g.month) : ""}/${g.year}`;
  if (g.month) return `${monthShort(g.month)}/${g.year}`;
  return `${g.year}`;
}

export function responsiblesOf(g: GoalWithRefs): string[] {
  if (g.assignees.length > 0) {
    return [...g.assignees]
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map((a) => a.user.name);
  }
  return g.responsible ? [g.responsible.name] : [];
}

export function statusMessage(g: Goal): string | null {
  const now = new Date();
  if (g.status === "ATRASADA" || g.status === "NAO_BATIDA") {
    const p = goalPace(g, now);
    const late = p.daysLate > 0 ? `Atrasada há ${p.daysLate} dia${p.daysLate === 1 ? "" : "s"}` : "Prazo encerrado";
    return `${late} · Faltam ${fmtGoalValue(p.remaining, g.unit)}`;
  }
  if (g.status === "EM_RISCO") {
    const p = goalPace(g, now);
    return `Ritmo atual: ${fmtGoalValue(p.currentPerWeek, g.unit)}/sem · Necessário: ${fmtGoalValue(p.neededPerWeek, g.unit)}/sem`;
  }
  return null;
}

export function achievedLabel(g: Goal): string | null {
  if (g.status === "SUPERADA")
    return `Meta superada: ${Math.round(g.progressPercentage)}% concluído${g.achievedAt ? ` · em ${formatDate(g.achievedAt)}` : ""}`;
  if (g.status === "BATIDA")
    return g.achievedAt ? `Meta batida em ${formatDate(g.achievedAt)}` : "Meta batida";
  return null;
}

/** Card simples (sem árvore de filhas) — usado em listas por período/responsável. */
export function flatGoalNode(
  g: GoalWithRefs,
  parentTitle: string | null = null,
  effective?: { names: string[]; inherited: boolean },
): GoalNode {
  return {
    id: g.id,
    title: g.title,
    level: g.hierarchyLevel,
    status: g.status,
    periodLabel: goalPeriodLabel(g),
    currentLabel: fmtGoalValue(g.currentValue, g.unit),
    targetLabel: fmtGoalValue(g.targetValue, g.unit),
    progress: g.targetValue > 0 ? (g.currentValue / g.targetValue) * 100 : 0,
    responsibles: effective ? effective.names : responsiblesOf(g),
    inheritedResp: effective?.inherited ?? false,
    parentTitle,
    achievedLabel: achievedLabel(g),
    message: statusMessage(g),
    childrenSummary: null,
    children: [],
  };
}
