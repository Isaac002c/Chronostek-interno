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
  GoalDistributionType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recomputeGoalTree, logGoal, distributeAssignees, equalSplit } from "@/lib/goals";
import {
  canManageStrategicGoals,
  canMutateGoal,
  visibleGoalWhere,
} from "@/lib/rbac";
import { monthLabel } from "@/lib/format";
import { monthRange, calendarWeeksOfMonth, spDayStart, spDayEnd } from "@/lib/tz";
import {
  requireWrite,
  zodFieldErrors,
  str,
  optStr,
  num,
  optNum,
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
    goalIndicatorId: z.string().nullable(),
    month: z.number().int().min(1).max(12).nullable(),
    quarter: z.number().int().min(1).max(4).nullable(),
    week: z.number().int().min(1).max(6).nullable(),
    year: z.number().int().min(2000).max(2100),
    targetValue: z.number(),
    currentValue: z.number(),
    unit: z.nativeEnum(GoalUnit),
    calculationMode: z.nativeEnum(GoalCalculationMode),
    includeInParentProgress: z.boolean(),
    parentWeight: z.number().nullable(),
    responsibleId: z.string().nullable(),
    costCenterId: z.string().nullable(),
    area: z.string().nullable(),
    status: z.nativeEnum(GoalStatus),
    startDate: z.date().nullable(),
    endDate: z.date().nullable(),
    distributionType: z.nativeEnum(GoalDistributionType),
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

  if (level === "ANUAL") {
    period = "ANUAL";
    month = null;
    quarter = null;
    week = null;
    parentGoalId = null;
  } else if (level === "TRIMESTRAL") {
    period = "TRIMESTRAL";
    month = null;
    week = null;
  } else if (level === "MENSAL") {
    period = "MENSAL";
    week = null;
    if (month) quarter = Math.ceil(month / 3);
  } else if (level === "SEMANAL") {
    period = "SEMANAL";
    if (month) quarter = Math.ceil(month / 3);
  } else if (level === "DIARIA") {
    period = "DIARIA";
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
    goalIndicatorId: optStr(fd, "goalIndicatorId"),
    month,
    quarter,
    week,
    year: optInt(fd, "year") ?? new Date().getFullYear(),
    targetValue: num(fd, "targetValue"),
    currentValue: num(fd, "currentValue"),
    unit: (optEnum(fd, "unit") ?? "REAIS") as GoalUnit,
    calculationMode: (optEnum(fd, "calculationMode") ?? "MANUAL") as GoalCalculationMode,
    includeInParentProgress: optBool(fd, "includeInParentProgress"),
    parentWeight: optNum(fd, "parentWeight"),
    responsibleId: primary,
    costCenterId: optStr(fd, "costCenterId"),
    area: optStr(fd, "area"),
    status: (optEnum(fd, "status") ?? "NO_PRAZO") as GoalStatus,
    startDate: optDate(fd, "startDate"),
    endDate: optDate(fd, "endDate"),
    distributionType: (optEnum(fd, "distributionType") ?? "COMPARTILHADA") as GoalDistributionType,
  };
}

/** Resolve automaticamente o período de planejamento correspondente ao nível/ano/mês/semana. */
async function resolvePlanningPeriod(
  d: GoalData,
  explicitId: string | null,
): Promise<{ id: string; startDate: Date; endDate: Date } | null> {
  if (explicitId) {
    const p = await prisma.planningPeriod.findUnique({ where: { id: explicitId }, select: { id: true, startDate: true, endDate: true } });
    if (p) return p;
  }
  const sel = { id: true, startDate: true, endDate: true };
  if (d.hierarchyLevel === "ANUAL")
    return prisma.planningPeriod.findFirst({ where: { type: "ANUAL", year: d.year }, select: sel });
  if (d.hierarchyLevel === "TRIMESTRAL" && d.quarter)
    return prisma.planningPeriod.findFirst({ where: { type: "TRIMESTRAL", year: d.year, quarter: d.quarter }, select: sel });
  if (d.hierarchyLevel === "MENSAL" && d.month)
    return prisma.planningPeriod.findFirst({ where: { type: "MENSAL", year: d.year, month: d.month }, select: sel });
  if (d.hierarchyLevel === "SEMANAL" && d.month && d.week)
    return prisma.planningPeriod.findFirst({ where: { type: "SEMANAL", year: d.year, month: d.month, week: d.week }, select: sel });
  return null;
}

/** Valida vínculo de meta pai: existência, compatibilidade de nível/período e ausência de ciclo. */
async function validateParent(
  d: GoalData,
  user: { id: string; role: import("@prisma/client").Role },
  editingId?: string,
): Promise<string | null> {
  if (!d.parentGoalId) return null;
  if (editingId && d.parentGoalId === editingId) return "Uma meta não pode ser pai dela mesma.";

  const visibility = visibleGoalWhere(user.role, user.id);
  const base: Prisma.GoalWhereInput = {
    id: d.parentGoalId,
    deletedAt: null,
  };
  const parent = await prisma.goal.findFirst({
    where: Object.keys(visibility).length
      ? { AND: [base, visibility] }
      : base,
    select: { id: true, hierarchyLevel: true, year: true, month: true, quarter: true, parentGoalId: true },
  });
  if (!parent) return "Meta pai não encontrada.";

  if (d.hierarchyLevel === "TRIMESTRAL") {
    if (parent.hierarchyLevel !== "ANUAL") return "Meta trimestral só pode ser vinculada a uma meta anual.";
    if (parent.year !== d.year) return "A meta anual pai deve ser do mesmo ano.";
  } else if (d.hierarchyLevel === "MENSAL") {
    if (parent.hierarchyLevel !== "TRIMESTRAL") return "Meta mensal só pode ser vinculada a uma meta trimestral.";
    if (parent.year !== d.year) return "A meta trimestral pai deve ser do mesmo ano.";
  } else if (d.hierarchyLevel === "SEMANAL") {
    if (parent.hierarchyLevel !== "MENSAL") return "Meta semanal só pode ser vinculada a uma meta mensal.";
    if (parent.year !== d.year || (d.month && parent.month && parent.month !== d.month))
      return "A meta mensal pai deve ser do mesmo ano e mês.";
  } else if (d.hierarchyLevel === "DIARIA") {
    if (parent.hierarchyLevel !== "SEMANAL") return "Meta diária só pode ser vinculada a uma meta semanal.";
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

/** Recria os responsáveis da meta (com distribuição) e registra adições/remoções. */
async function syncAssignees(
  goalId: string,
  ids: string[],
  primary: string | null,
  distributionType: GoalDistributionType,
  fd: FormData,
  total: number,
  performedById?: string | null,
) {
  const existing = await prisma.goalAssignee.findMany({ where: { goalId }, select: { userId: true } });
  const before = new Set(existing.map((e) => e.userId));
  const after = new Set(ids);

  const distInput = ids.map((id) => ({
    distributionType,
    plannedValue: distributionType === "VALOR_FIXO" ? optNum(fd, `dist__${id}`) : null,
    percentage: distributionType === "PERCENTUAL" ? optNum(fd, `dist__${id}`) : null,
  }));
  const planned = distributeAssignees(total, distInput);

  await prisma.goalAssignee.deleteMany({ where: { goalId } });
  if (ids.length > 0) {
    await prisma.goalAssignee.createMany({
      data: ids.map((userId, i) => ({
        goalId,
        userId,
        isPrimary: userId === primary,
        distributionType,
        plannedValue: Math.round(planned[i] * 100) / 100,
        percentage: distInput[i].percentage,
      })),
      skipDuplicates: true,
    });
  }

  for (const id of after) if (!before.has(id)) await logGoal(goalId, "RESP_ADICIONADO", { userId: id }, performedById);
  for (const id of before) if (!after.has(id)) await logGoal(goalId, "RESP_REMOVIDO", { userId: id }, performedById);
}

/** Gera metas-filhas (trimestral→meses, mensal→semanas) dividindo o alvo igualmente. */
async function autoSplitGoal(
  parent: {
    id: string; title: string; type: GoalType; hierarchyLevel: GoalLevel; year: number; quarter: number | null;
    month: number | null; targetValue: number; unit: GoalUnit; responsibleId: string | null; costCenterId: string | null;
    area: string | null; planningPeriodId: string | null;
  },
  performedById?: string | null,
): Promise<number> {
  const kids: Prisma.GoalCreateManyInput[] = [];

  if (parent.hierarchyLevel === "TRIMESTRAL" && parent.quarter) {
    const first = (parent.quarter - 1) * 3 + 1;
    const targets = equalSplit(parent.targetValue, 3);
    for (let i = 0; i < 3; i++) {
      const m = first + i;
      const mr = monthRange(parent.year, m);
      const monthPeriod = await prisma.planningPeriod.findFirst({ where: { type: "MENSAL", year: parent.year, month: m }, select: { id: true } });
      kids.push({
        title: `${parent.title} — ${monthLabel(m, parent.year)}`,
        type: parent.type, period: "MENSAL", hierarchyLevel: "MENSAL", parentGoalId: parent.id,
        planningPeriodId: monthPeriod?.id ?? null, month: m, quarter: parent.quarter, year: parent.year,
        targetValue: targets[i], currentValue: 0, progressPercentage: 0, unit: parent.unit, calculationMode: "MANUAL",
        includeInParentProgress: true, responsibleId: null, costCenterId: null,
        area: parent.area, status: "NAO_INICIADA", startDate: mr.start, endDate: mr.end,
      });
    }
  } else if (parent.hierarchyLevel === "MENSAL" && parent.month) {
    const weeks = calendarWeeksOfMonth(parent.year, parent.month);
    const targets = equalSplit(parent.targetValue, weeks.length);
    for (let i = 0; i < weeks.length; i++) {
      const w = weeks[i];
      const weekPeriod = await prisma.planningPeriod.findFirst({ where: { type: "SEMANAL", year: parent.year, month: parent.month, week: w.week }, select: { id: true } });
      kids.push({
        title: `${parent.title} — Semana ${w.week}`,
        type: parent.type, period: "SEMANAL", hierarchyLevel: "SEMANAL", parentGoalId: parent.id,
        planningPeriodId: weekPeriod?.id ?? null, month: parent.month, quarter: parent.quarter ?? Math.ceil(parent.month / 3),
        week: w.week, year: parent.year, targetValue: targets[i], currentValue: 0, progressPercentage: 0, unit: parent.unit,
        calculationMode: "MANUAL", includeInParentProgress: true, responsibleId: null,
        costCenterId: null, area: parent.area, status: "NAO_INICIADA",
        startDate: spDayStart(parent.year, parent.month, w.startDay), endDate: spDayEnd(parent.year, parent.month, w.endDay),
      });
    }
  }

  if (kids.length === 0) return 0;
  await prisma.goal.createMany({ data: kids });
  await logGoal(parent.id, "FILHAS_GERADAS", { count: kids.length, level: parent.hierarchyLevel }, performedById);
  return kids.length;
}

export async function createGoal(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await requireWrite("METAS");
  if ("error" in auth) return auth;

  const parsed = goalSchema.safeParse(parseGoal(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  const { distributionType, ...goalData } = parsed.data;
  if (
    (goalData.hierarchyLevel === "ANUAL" ||
      goalData.hierarchyLevel === "TRIMESTRAL") &&
    !canManageStrategicGoals(auth.user.role)
  )
    return { error: "Apenas administradores podem criar metas estratégicas." };

  const parentError = await validateParent(parsed.data, auth.user);
  if (parentError) return { fieldErrors: { parentGoalId: [parentError] } };

  const { ids, primary } = parseAssignees(fd);
  const explicitPeriodId = optStr(fd, "planningPeriodId");
  const autoSplit = optBool(fd, "autoSplit");

  try {
    const period = await resolvePlanningPeriod(parsed.data, explicitPeriodId);
    const startDate = goalData.startDate ?? period?.startDate ?? null;
    const endDate = goalData.endDate ?? period?.endDate ?? null;

    const created = await prisma.goal.create({
      data: {
        ...goalData,
        planningPeriodId: period?.id ?? null,
        startDate,
        endDate,
        progressPercentage: progressOf(goalData.targetValue, goalData.currentValue),
      },
    });
    await syncAssignees(created.id, ids, primary, distributionType, fd, goalData.targetValue, auth.user.id);
    await logGoal(created.id, "CRIADA", { title: goalData.title, level: goalData.hierarchyLevel }, auth.user.id);
    if (goalData.parentGoalId) await logGoal(created.id, "VINCULADA", { parentGoalId: goalData.parentGoalId }, auth.user.id);
    if (autoSplit) await autoSplitGoal({ ...created }, auth.user.id);
    await recomputeGoalTree(auth.user.id);
  } catch {
    return { error: "Não foi possível salvar a meta." };
  }

  revalidatePath("/dashboard/metas");
  redirect("/dashboard/metas");
}

export async function updateGoal(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await requireWrite("METAS");
  if ("error" in auth) return auth;

  const parsed = goalSchema.safeParse(parseGoal(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  const { distributionType, ...goalData } = parsed.data;
  if (
    (goalData.hierarchyLevel === "ANUAL" ||
      goalData.hierarchyLevel === "TRIMESTRAL") &&
    !canManageStrategicGoals(auth.user.role)
  )
    return { error: "Apenas administradores podem gerir metas estratégicas." };

  const parentError = await validateParent(parsed.data, auth.user, id);
  if (parentError) return { fieldErrors: { parentGoalId: [parentError] } };

  const { ids, primary } = parseAssignees(fd);
  const explicitPeriodId = optStr(fd, "planningPeriodId");

  try {
    const visibility = visibleGoalWhere(auth.user.role, auth.user.id);
    const before = await prisma.goal.findFirst({
      where: Object.keys(visibility).length
        ? { AND: [{ id, deletedAt: null }, visibility] }
        : { id, deletedAt: null },
      include: { assignees: { select: { userId: true } } },
    });
    if (!before) return { error: "Meta não encontrada." };
    if (
      !canMutateGoal(auth.user.role, auth.user.id, {
        hierarchyLevel: before.hierarchyLevel,
        responsibleId: before.responsibleId,
        assigneeUserIds: before.assignees.map((a) => a.userId),
      })
    )
      return { error: "Você não tem permissão para alterar esta meta." };

    const period = await resolvePlanningPeriod(parsed.data, explicitPeriodId);
    const startDate = goalData.startDate ?? period?.startDate ?? null;
    const endDate = goalData.endDate ?? period?.endDate ?? null;

    await prisma.goal.update({
      where: { id },
      data: {
        ...goalData,
        planningPeriodId: period?.id ?? null,
        startDate,
        endDate,
        progressPercentage: progressOf(goalData.targetValue, goalData.currentValue),
      },
    });
    await syncAssignees(id, ids, primary, distributionType, fd, goalData.targetValue, auth.user.id);

    if (before.targetValue !== goalData.targetValue)
      await logGoal(id, "ALVO_ALTERADO", { previous: before.targetValue, next: goalData.targetValue }, auth.user.id);
    if (before.currentValue !== goalData.currentValue)
      await logGoal(id, "ATUAL_ALTERADO", { previous: before.currentValue, next: goalData.currentValue }, auth.user.id);
    if (before.status !== goalData.status)
      await logGoal(id, "STATUS_ALTERADO", { previous: before.status, next: goalData.status }, auth.user.id);
    if (before.parentGoalId !== goalData.parentGoalId) {
      if (goalData.parentGoalId) await logGoal(id, "VINCULADA", { parentGoalId: goalData.parentGoalId }, auth.user.id);
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
  const auth = await requireWrite("METAS");
  if ("error" in auth) return auth;

  try {
    const visibility = visibleGoalWhere(auth.user.role, auth.user.id);
    const goal = await prisma.goal.findFirst({
      where: Object.keys(visibility).length
        ? { AND: [{ id, deletedAt: null }, visibility] }
        : { id, deletedAt: null },
      include: { assignees: { select: { userId: true } } },
    });
    if (!goal) return { error: "Meta não encontrada." };
    if (
      !canMutateGoal(auth.user.role, auth.user.id, {
        hierarchyLevel: goal.hierarchyLevel,
        responsibleId: goal.responsibleId,
        assigneeUserIds: goal.assignees.map((a) => a.userId),
      })
    )
      return { error: "Você não tem permissão para excluir esta meta." };
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
  const auth = await requireWrite("METAS");
  if ("error" in auth) return auth;

  try {
    await recomputeGoalTree(auth.user.id);
  } catch {
    return { error: "Erro ao recalcular metas." };
  }

  revalidatePath("/dashboard/metas");
  return { ok: true };
}
