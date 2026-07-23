"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { ContributionUnit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recomputeGoalChain, logGoal } from "@/lib/goals";
import {
  canAccessModule,
  isRestrictedToOwn,
  visibleGoalWhere,
} from "@/lib/rbac";
import {
  requireWrite,
  zodFieldErrors,
  str,
  optStr,
  optNum,
  num,
  optDate,
  optEnum,
  type ActionState,
} from "@/lib/actions";

function checklistWhereForUser(
  id: string,
  user: { id: string; role: import("@prisma/client").Role },
) {
  return {
    id,
    deletedAt: null,
    ...(isRestrictedToOwn(user.role) ? { assigneeId: user.id } : {}),
  };
}

async function canLinkGoal(
  user: { id: string; role: import("@prisma/client").Role },
  goalId: string | null,
): Promise<boolean> {
  if (!goalId) return true;
  if (!canAccessModule(user.role, "METAS")) return false;
  const visibility = visibleGoalWhere(user.role, user.id);
  const goal = await prisma.goal.findFirst({
    where: Object.keys(visibility).length
      ? { AND: [{ id: goalId, deletedAt: null }, visibility] }
      : { id: goalId, deletedAt: null },
    select: { id: true },
  });
  return Boolean(goal);
}

function revalidateChecklistViews() {
  revalidatePath("/dashboard/metas");
  revalidatePath("/dashboard/metas/checklists");
  revalidatePath("/dashboard/tarefas");
}

/** Conclui um checklist com o valor planejado (ou já realizado) e alimenta a meta. */
export async function completeChecklist(id: string): Promise<ActionState> {
  const auth = await requireWrite("TAREFAS");
  if ("error" in auth) return auth;

  try {
    const t = await prisma.task.findFirst({
      where: checklistWhereForUser(id, auth.user),
      select: { goalId: true, plannedContribution: true, realizedContribution: true },
    });
    if (!t) return { error: "Checklist não encontrado." };

    const realized = t.realizedContribution ?? t.plannedContribution ?? 0;
    await prisma.task.update({
      where: { id },
      data: { status: "CONCLUIDA", completedAt: new Date(), realizedContribution: realized },
    });

    if (t.goalId) {
      await recomputeGoalChain(t.goalId, auth.user.id);
      await logGoal(t.goalId, "CHECKLIST_CONCLUIDO", { taskId: id, realized }, auth.user.id);
    }
  } catch {
    return { error: "Não foi possível concluir o checklist." };
  }

  revalidateChecklistViews();
  return { ok: true };
}

/** Reabre um checklist (volta a A_FAZER, zera o realizado) e recalcula a meta. */
export async function reopenChecklist(id: string): Promise<ActionState> {
  const auth = await requireWrite("TAREFAS");
  if ("error" in auth) return auth;

  try {
    const t = await prisma.task.findFirst({
      where: checklistWhereForUser(id, auth.user),
      select: { goalId: true },
    });
    if (!t) return { error: "Checklist não encontrado." };

    await prisma.task.update({
      where: { id },
      data: { status: "A_FAZER", completedAt: null, realizedContribution: 0 },
    });

    if (t.goalId) {
      await recomputeGoalChain(t.goalId, auth.user.id);
      await logGoal(t.goalId, "CHECKLIST_REABERTO", { taskId: id }, auth.user.id);
    }
  } catch {
    return { error: "Não foi possível reabrir o checklist." };
  }

  revalidateChecklistViews();
  return { ok: true };
}

const updateResultSchema = z.object({
  realizedContribution: z.number(),
  evidenceUrl: z.string().nullable(),
  evidenceNote: z.string().nullable(),
  markDone: z.boolean(),
});

/** Registra resultado realizado + evidência de um checklist e recalcula a meta. */
export async function saveChecklistResult(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite("TAREFAS");
  if ("error" in auth) return auth;

  const parsed = updateResultSchema.safeParse({
    realizedContribution: num(fd, "realizedContribution"),
    evidenceUrl: optStr(fd, "evidenceUrl"),
    evidenceNote: optStr(fd, "evidenceNote"),
    markDone: (fd.get("markDone") ?? "") === "on" || fd.get("markDone") === "true",
  });
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;

  try {
    const t = await prisma.task.findFirst({
      where: checklistWhereForUser(id, auth.user),
      select: { goalId: true, status: true },
    });
    if (!t) return { error: "Checklist não encontrado." };

    await prisma.task.update({
      where: { id },
      data: {
        realizedContribution: d.realizedContribution,
        evidenceUrl: d.evidenceUrl,
        evidenceNote: d.evidenceNote,
        ...(d.markDone ? { status: "CONCLUIDA", completedAt: new Date() } : {}),
      },
    });

    if (t.goalId) {
      await recomputeGoalChain(t.goalId, auth.user.id);
      await logGoal(t.goalId, d.markDone ? "CHECKLIST_CONCLUIDO" : "ATUAL_ALTERADO", { taskId: id, realized: d.realizedContribution }, auth.user.id);
    }
  } catch {
    return { error: "Não foi possível salvar o resultado." };
  }

  revalidateChecklistViews();
  return { ok: true };
}

const quickSchema = z.object({
  title: z.string().min(1, "Informe o título do checklist."),
  goalId: z.string().nullable(),
  assigneeId: z.string().nullable(),
  costCenterId: z.string().nullable(),
  planningPeriodId: z.string().nullable(),
  dueDate: z.date().nullable(),
  contributionUnit: z.nativeEnum(ContributionUnit).nullable(),
  plannedContribution: z.number().nullable(),
});

/** Criação rápida de um checklist (tarefa vinculada a uma meta) a partir do dia/meta. */
export async function quickCreateChecklist(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite("TAREFAS");
  if ("error" in auth) return auth;

  const parsed = quickSchema.safeParse({
    title: str(fd, "title"),
    goalId: optStr(fd, "goalId"),
    assigneeId: optStr(fd, "assigneeId"),
    costCenterId: optStr(fd, "costCenterId"),
    planningPeriodId: optStr(fd, "planningPeriodId"),
    dueDate: optDate(fd, "dueDate"),
    contributionUnit: (optEnum(fd, "contributionUnit") as ContributionUnit | undefined) ?? null,
    plannedContribution: optNum(fd, "plannedContribution"),
  });
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  if (!(await canLinkGoal(auth.user, parsed.data.goalId)))
    return { fieldErrors: { goalId: ["Meta indisponível para este usuário."] } };
  const d = isRestrictedToOwn(auth.user.role)
    ? { ...parsed.data, assigneeId: auth.user.id }
    : parsed.data;

  try {
    await prisma.task.create({
      data: {
        title: d.title,
        module: "METAS",
        status: "A_FAZER",
        assigneeId: d.assigneeId,
        costCenterId: d.costCenterId,
        goalId: d.goalId,
        planningPeriodId: d.planningPeriodId,
        dueDate: d.dueDate,
        contributionUnit: d.contributionUnit,
        plannedContribution: d.plannedContribution,
        createdById: auth.user.id,
      },
    });
  } catch {
    return { error: "Não foi possível criar o checklist." };
  }

  revalidateChecklistViews();
  return { ok: true };
}
