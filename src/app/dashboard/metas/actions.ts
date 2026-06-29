"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  GoalType,
  GoalPeriod,
  GoalUnit,
  GoalStatus,
  GoalLevel,
  GoalCalculationMode,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recomputeGoalTree, logGoal } from "@/lib/goals";
import {
  requireWrite,
  zodFieldErrors,
  str,
  optStr,
  num,
  optInt,
  optDate,
  optBool,
  optEnum,
  type ActionState,
} from "@/lib/actions";

const progressOf = (target: number, current: number) =>
  target > 0 ? (current / target) * 100 : 0;

const goalSchema = z
  .object({
    title: z.string().min(1, "Informe o título da meta."),
    description: z.string().nullable(),
    type: z.nativeEnum(GoalType),
    period: z.nativeEnum(GoalPeriod),
    hierarchyLevel: z.nativeEnum(GoalLevel),
    parentGoalId: z.string().nullable(),
    month: z.number().int().min(1).max(12).nullable(),
    quarter: z.number().int().min(1).max(4).nullable(),
    week: z.number().int().min(1).max(6).nullable(),
    year: z.number().int().min(2000).max(2100),
    targetValue: z.number(),
    currentValue: z.number(),
    unit: z.nativeEnum(GoalUnit),
    calculationMode: z.nativeEnum(GoalCalculationMode),
    includeInParentProgress: z.boolean(),
    responsibleId: z.string().nullable(),
    costCenterId: z.string().nullable(),
    area: z.string().nullable(),
    status: z.nativeEnum(GoalStatus),
    startDate: z.date().nullable(),
    endDate: z.date().nullable(),
  })
  .superRefine((d, ctx) => {
    if (d.hierarchyLevel === "TRIMESTRAL" && !d.quarter)
      ctx.addIssue({ path: ["quarter"], code: z.ZodIssueCode.custom, message: "Informe o trimestre." });
    if (d.hierarchyLevel === "MENSAL" && !d.month)
      ctx.addIssue({ path: ["month"], code: z.ZodIssueCode.custom, message: "Informe o mês." });
    if (d.hierarchyLevel === "SEMANAL" && !d.month)
      ctx.addIssue({ path: ["month"], code: z.ZodIssueCode.custom, message: "Informe o mês." });
    if (d.hierarchyLevel === "SEMANAL" && !d.week)
      ctx.addIssue({ path: ["week"], code: z.ZodIssueCode.custom, message: "Informe a semana." });
  });

type GoalData = z.infer<typeof goalSchema>;

/** Lê os ids de responsáveis (checkboxes) + o principal e devolve set normalizado. */
function parseAssignees(fd: FormData): { ids: string[]; primary: string | null } {
  const raw = fd
    .getAll("responsibleIds")
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  const primary = optStr(fd, "primaryResponsibleId");
  const ids = Array.from(new Set([...(primary ? [primary] : []), ...raw]));
  return { ids, primary: primary ?? ids[0] ?? null };
}

function parseGoal(fd: FormData): GoalData {
  const level = (optEnum(fd, "hierarchyLevel") ?? "AVULSA") as GoalLevel;
  const rawPeriod = (optEnum(fd, "period") ?? "MENSAL") as GoalPeriod;
  let month = optInt(fd, "month");
  let quarter = optInt(fd, "quarter");
  let week = optInt(fd, "week");
  let period = rawPeriod;
  let parentGoalId = optStr(fd, "parentGoalId");

  if (level === "TRIMESTRAL") {
    period = "TRIMESTRAL";
    month = null;
    week = null;
    parentGoalId = null;
  } else if (level === "MENSAL") {
    period = "MENSAL";
    week = null;
    if (month) quarter = Math.ceil(month / 3);
  } else if (level === "SEMANAL") {
    period = "SEMANAL";
    if (month) quarter = Math.ceil(month / 3);
  } else {
    // AVULSA: período livre, sem pai.
    parentGoalId = null;
  }

  const { primary } = parseAssignees(fd);

  return {
    title: str(fd, "title"),
    description: optStr(fd, "description"),
    type: (optEnum(fd, "type") ?? "RECEITA") as GoalType,
    period,
    hierarchyLevel: level,
    parentGoalId,
    month,
    quarter,
    week,
    year: optInt(fd, "year") ?? new Date().getFullYear(),
    targetValue: num(fd, "targetValue"),
    currentValue: num(fd, "currentValue"),
    unit: (optEnum(fd, "unit") ?? "REAIS") as GoalUnit,
    calculationMode: (optEnum(fd, "calculationMode") ?? "MANUAL") as GoalCalculationMode,
    includeInParentProgress: optBool(fd, "includeInParentProgress"),
    responsibleId: primary,
    costCenterId: optStr(fd, "costCenterId"),
    area: optStr(fd, "area"),
    status: (optEnum(fd, "status") ?? "NO_PRAZO") as GoalStatus,
    startDate: optDate(fd, "startDate"),
    endDate: optDate(fd, "endDate"),
  };
}

/** Valida vínculo de meta pai: existência, compatibilidade de nível/período e ausência de ciclo. */
async function validateParent(d: GoalData, editingId?: string): Promise<string | null> {
  if (!d.parentGoalId) return null;
  if (editingId && d.parentGoalId === editingId) return "Uma meta não pode ser pai dela mesma.";

  const parent = await prisma.goal.findFirst({
    where: { id: d.parentGoalId, deletedAt: null },
    select: { id: true, hierarchyLevel: true, year: true, month: true, parentGoalId: true },
  });
  if (!parent) return "Meta pai não encontrada.";

  if (d.hierarchyLevel === "MENSAL") {
    if (parent.hierarchyLevel !== "TRIMESTRAL")
      return "Meta mensal só pode ser vinculada a uma meta trimestral.";
    if (parent.year !== d.year)
      return "A meta trimestral pai deve ser do mesmo ano.";
  } else if (d.hierarchyLevel === "SEMANAL") {
    if (parent.hierarchyLevel !== "MENSAL")
      return "Meta semanal só pode ser vinculada a uma meta mensal.";
    if (parent.year !== d.year || (d.month && parent.month && parent.month !== d.month))
      return "A meta mensal pai deve ser do mesmo ano e mês.";
  } else {
    return "Este nível de meta não admite meta pai.";
  }

  // Sem ciclo: subir a cadeia de ancestrais do pai; não pode reencontrar a meta editada.
  if (editingId) {
    let cursorId: string | null = parent.parentGoalId;
    let guard = 0;
    while (cursorId && guard++ < 50) {
      if (cursorId === editingId) return "Vínculo inválido: criaria um ciclo entre metas.";
      const up: { parentGoalId: string | null } | null = await prisma.goal.findUnique({
        where: { id: cursorId },
        select: { parentGoalId: true },
      });
      cursorId = up?.parentGoalId ?? null;
    }
  }
  return null;
}

/** Recria os responsáveis da meta e registra adições/remoções no histórico. */
async function syncAssignees(goalId: string, ids: string[], primary: string | null, performedById?: string | null) {
  const existing = await prisma.goalAssignee.findMany({ where: { goalId }, select: { userId: true } });
  const before = new Set(existing.map((e) => e.userId));
  const after = new Set(ids);

  await prisma.goalAssignee.deleteMany({ where: { goalId } });
  if (ids.length > 0) {
    await prisma.goalAssignee.createMany({
      data: ids.map((userId) => ({ goalId, userId, isPrimary: userId === primary })),
      skipDuplicates: true,
    });
  }

  for (const id of after) if (!before.has(id)) await logGoal(goalId, "RESP_ADICIONADO", { userId: id }, performedById);
  for (const id of before) if (!after.has(id)) await logGoal(goalId, "RESP_REMOVIDO", { userId: id }, performedById);
}

export async function createGoal(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = goalSchema.safeParse(parseGoal(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;

  const parentError = await validateParent(d);
  if (parentError) return { fieldErrors: { parentGoalId: [parentError] } };

  const { ids, primary } = parseAssignees(fd);
  try {
    const created = await prisma.goal.create({
      data: { ...d, progressPercentage: progressOf(d.targetValue, d.currentValue) },
    });
    await syncAssignees(created.id, ids, primary, auth.user.id);
    await logGoal(created.id, "CRIADA", { title: d.title, level: d.hierarchyLevel }, auth.user.id);
    if (d.parentGoalId) await logGoal(created.id, "VINCULADA", { parentGoalId: d.parentGoalId }, auth.user.id);
    await recomputeGoalTree(auth.user.id);
  } catch {
    return { error: "Não foi possível salvar a meta." };
  }

  revalidatePath("/dashboard/metas");
  redirect("/dashboard/metas");
}

export async function updateGoal(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = goalSchema.safeParse(parseGoal(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;

  const parentError = await validateParent(d, id);
  if (parentError) return { fieldErrors: { parentGoalId: [parentError] } };

  const { ids, primary } = parseAssignees(fd);
  try {
    const before = await prisma.goal.findFirst({ where: { id, deletedAt: null } });
    if (!before) return { error: "Meta não encontrada." };

    await prisma.goal.update({
      where: { id },
      data: { ...d, progressPercentage: progressOf(d.targetValue, d.currentValue) },
    });
    await syncAssignees(id, ids, primary, auth.user.id);

    // Histórico de mudanças relevantes.
    if (before.targetValue !== d.targetValue)
      await logGoal(id, "ALVO_ALTERADO", { previous: before.targetValue, next: d.targetValue }, auth.user.id);
    if (before.currentValue !== d.currentValue)
      await logGoal(id, "ATUAL_ALTERADO", { previous: before.currentValue, next: d.currentValue }, auth.user.id);
    if (before.status !== d.status)
      await logGoal(id, "STATUS_ALTERADO", { previous: before.status, next: d.status }, auth.user.id);
    if (before.parentGoalId !== d.parentGoalId) {
      if (d.parentGoalId) await logGoal(id, "VINCULADA", { parentGoalId: d.parentGoalId }, auth.user.id);
      else await logGoal(id, "DESVINCULADA", { previous: before.parentGoalId }, auth.user.id);
    }

    await recomputeGoalTree(auth.user.id);
  } catch {
    return { error: "Não foi possível atualizar a meta." };
  }

  revalidatePath("/dashboard/metas");
  redirect("/dashboard/metas");
}

export async function deleteGoal(id: string): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  try {
    // Desvincula filhas para não deixar ponteiros órfãos.
    await prisma.goal.updateMany({ where: { parentGoalId: id }, data: { parentGoalId: null } });
    await prisma.goal.update({ where: { id }, data: { deletedAt: new Date() } });
    await logGoal(id, "EXCLUIDA", {}, auth.user.id);
    await recomputeGoalTree(auth.user.id);
  } catch {
    return { error: "Não foi possível excluir a meta." };
  }

  revalidatePath("/dashboard/metas");
  return { ok: true };
}

/** Recalcula todas as metas automáticas e consolida a árvore (folhas → pais). */
export async function recalcAutomaticGoals(): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  try {
    await recomputeGoalTree(auth.user.id);
  } catch {
    return { error: "Erro ao recalcular metas." };
  }

  revalidatePath("/dashboard/metas");
  return { ok: true };
}
