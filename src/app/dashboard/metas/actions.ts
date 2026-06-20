"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { GoalType, GoalPeriod, GoalUnit, GoalStatus, GoalCalculationMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeGoalCurrentValue, goalStatusFor } from "@/lib/goals";
import {
  requireWrite,
  zodFieldErrors,
  str,
  optStr,
  num,
  optInt,
  optEnum,
  type ActionState,
} from "@/lib/actions";

const progressOf = (target: number, current: number) =>
  target > 0 ? (current / target) * 100 : 0;

const goalSchema = z.object({
  title: z.string().min(1, "Informe o título da meta."),
  description: z.string().nullable(),
  type: z.nativeEnum(GoalType),
  period: z.nativeEnum(GoalPeriod),
  month: z.number().int().min(1).max(12).nullable(),
  quarter: z.number().int().min(1).max(4).nullable(),
  year: z.number().int().min(2000).max(2100),
  targetValue: z.number(),
  currentValue: z.number(),
  unit: z.nativeEnum(GoalUnit),
  responsibleId: z.string().nullable(),
  costCenterId: z.string().nullable(),
  status: z.nativeEnum(GoalStatus),
  calculationMode: z.nativeEnum(GoalCalculationMode),
});

function parseGoal(fd: FormData) {
  return {
    title: str(fd, "title"),
    description: optStr(fd, "description"),
    type: (optEnum(fd, "type") ?? "RECEITA") as GoalType,
    period: (optEnum(fd, "period") ?? "MENSAL") as GoalPeriod,
    month: optInt(fd, "month"),
    quarter: optInt(fd, "quarter"),
    year: optInt(fd, "year") ?? new Date().getFullYear(),
    targetValue: num(fd, "targetValue"),
    currentValue: num(fd, "currentValue"),
    unit: (optEnum(fd, "unit") ?? "REAIS") as GoalUnit,
    responsibleId: optStr(fd, "responsibleId"),
    costCenterId: optStr(fd, "costCenterId"),
    status: (optEnum(fd, "status") ?? "NO_PRAZO") as GoalStatus,
    calculationMode: (optEnum(fd, "calculationMode") ?? "MANUAL") as GoalCalculationMode,
  };
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
  try {
    const created = await prisma.goal.create({
      data: { ...d, progressPercentage: progressOf(d.targetValue, d.currentValue) },
    });
    if (created.calculationMode === "AUTOMATICO") {
      const cur = await computeGoalCurrentValue(created);
      const p = progressOf(created.targetValue, cur);
      await prisma.goal.update({
        where: { id: created.id },
        data: { currentValue: cur, progressPercentage: p, status: goalStatusFor(p) },
      });
    }
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
  try {
    const updated = await prisma.goal.update({
      where: { id },
      data: { ...d, progressPercentage: progressOf(d.targetValue, d.currentValue) },
    });
    if (updated.calculationMode === "AUTOMATICO") {
      const cur = await computeGoalCurrentValue(updated);
      const p = progressOf(updated.targetValue, cur);
      await prisma.goal.update({
        where: { id },
        data: { currentValue: cur, progressPercentage: p, status: goalStatusFor(p) },
      });
    }
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
    await prisma.goal.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } catch {
    return { error: "Não foi possível excluir a meta." };
  }

  revalidatePath("/dashboard/metas");
  return { ok: true };
}

/** Recalcula todas as metas automáticas a partir dos dados reais. */
export async function recalcAutomaticGoals(): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const goals = await prisma.goal.findMany({
    where: { deletedAt: null, calculationMode: "AUTOMATICO" },
  });
  try {
    for (const g of goals) {
      const cur = await computeGoalCurrentValue(g);
      const p = progressOf(g.targetValue, cur);
      await prisma.goal.update({
        where: { id: g.id },
        data: { currentValue: cur, progressPercentage: p, status: goalStatusFor(p) },
      });
    }
  } catch {
    return { error: "Erro ao recalcular metas." };
  }

  revalidatePath("/dashboard/metas");
  return { ok: true };
}
