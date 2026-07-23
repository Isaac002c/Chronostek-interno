import { prisma } from "@/lib/prisma";
import type { CategoryType, Prisma, Role } from "@prisma/client";
import type { Option } from "@/lib/enums";
import { canAccessModule, visibleGoalWhere } from "@/lib/rbac";

type GoalOptionUser = { id: string; role: Role };

export async function getUserOptions(): Promise<Option[]> {
  const rows = await prisma.user.findMany({
    where: { deletedAt: null, status: "ATIVO" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

export async function getClientOptions(): Promise<Option[]> {
  const rows = await prisma.client.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

export async function getCostCenterOptions(): Promise<Option[]> {
  const rows = await prisma.costCenter.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
  return rows.map((r) => ({ value: r.id, label: `${r.code} · ${r.name}` }));
}

export async function getCategoryOptions(type?: CategoryType): Promise<Option[]> {
  const rows = await prisma.financialCategory.findMany({
    where: { active: true, ...(type ? { type } : {}) },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
  return rows.map((r) => ({ value: r.id, label: `${r.code} · ${r.name}` }));
}

export async function getProjectOptions(): Promise<Option[]> {
  const rows = await prisma.project.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

export async function getContractOptions(): Promise<Option[]> {
  const rows = await prisma.contract.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true, client: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    value: r.id,
    label: `${r.title} — ${r.client.name}`,
  }));
}

export type GoalParentCandidate = {
  value: string;
  label: string;
  level: string;
  year: number;
  month: number | null;
  quarter: number | null;
};

/**
 * Candidatos a meta PAI (níveis TRIMESTRAL e MENSAL não excluídos), com metadados
 * para o formulário filtrar conforme o nível/ano/mês selecionados no cliente:
 * - MENSAL → pai TRIMESTRAL do mesmo ano.
 * - SEMANAL → pai MENSAL do mesmo ano e mês.
 */
export async function getGoalParentCandidates(
  user: GoalOptionUser,
  excludeId?: string,
): Promise<GoalParentCandidate[]> {
  const visibility = visibleGoalWhere(user.role, user.id);
  const base: Prisma.GoalWhereInput = {
    deletedAt: null,
    hierarchyLevel: { in: ["ANUAL", "TRIMESTRAL", "MENSAL", "SEMANAL"] },
    ...(excludeId ? { id: { not: excludeId } } : {}),
  };
  const rows = await prisma.goal.findMany({
    where: Object.keys(visibility).length
      ? { AND: [base, visibility] }
      : base,
    select: { id: true, title: true, hierarchyLevel: true, year: true, month: true, quarter: true },
    orderBy: [{ year: "desc" }, { quarter: "asc" }, { month: "asc" }],
  });
  return rows.map((r) => ({
    value: r.id,
    label: r.title,
    level: r.hierarchyLevel,
    year: r.year,
    month: r.month,
    quarter: r.quarter,
  }));
}

/** Metas selecionáveis para vincular a uma tarefa/checklist (com nível no rótulo). */
export async function getGoalOptions(user: GoalOptionUser): Promise<Option[]> {
  if (!canAccessModule(user.role, "METAS")) return [];
  const visibility = visibleGoalWhere(user.role, user.id);
  const base = { deletedAt: null, status: { not: "CANCELADA" as const } };
  const rows = await prisma.goal.findMany({
    where: Object.keys(visibility).length
      ? { AND: [base, visibility] }
      : base,
    select: { id: true, title: true, hierarchyLevel: true, year: true },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  const levelShort: Record<string, string> = {
    ANUAL: "Anual",
    TRIMESTRAL: "Trim.",
    MENSAL: "Mensal",
    SEMANAL: "Semanal",
    DIARIA: "Diária",
    AVULSA: "Avulsa",
  };
  return rows.map((r) => ({ value: r.id, label: `${r.title} · ${levelShort[r.hierarchyLevel] ?? r.hierarchyLevel}` }));
}

export async function getGoalIndicatorOptions(): Promise<Option[]> {
  const rows = await prisma.goalIndicator.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

export async function getLegalContractOptions(): Promise<Option[]> {
  const rows = await prisma.legalContract.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ value: r.id, label: r.title }));
}
