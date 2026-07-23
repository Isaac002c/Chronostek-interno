"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Priority, TaskStatus, ModuleKey, ContributionUnit } from "@prisma/client";
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
  optDate,
  optEnum,
  type ActionState,
} from "@/lib/actions";

const taskSchema = z.object({
  title: z.string().min(1, "Informe o título da tarefa."),
  description: z.string().nullable(),
  assigneeId: z.string().nullable(),
  costCenterId: z.string().nullable(),
  priority: z.nativeEnum(Priority),
  status: z.nativeEnum(TaskStatus),
  dueDate: z.date().nullable(),
  module: z.nativeEnum(ModuleKey),
  goalId: z.string().nullable(),
  planningPeriodId: z.string().nullable(),
  contributionUnit: z.nativeEnum(ContributionUnit).nullable(),
  plannedContribution: z.number().nullable(),
  realizedContribution: z.number().nullable(),
  contributionWeight: z.number().nullable(),
  evidenceUrl: z.string().nullable(),
  evidenceNote: z.string().nullable(),
});

function parseTask(fd: FormData) {
  return {
    title: str(fd, "title"),
    description: optStr(fd, "description"),
    assigneeId: optStr(fd, "assigneeId"),
    costCenterId: optStr(fd, "costCenterId"),
    priority: (optEnum(fd, "priority") ?? "MEDIA") as Priority,
    status: (optEnum(fd, "status") ?? "A_FAZER") as TaskStatus,
    dueDate: optDate(fd, "dueDate"),
    module: (optEnum(fd, "module") ?? "GERAL") as ModuleKey,
    goalId: optStr(fd, "goalId"),
    planningPeriodId: optStr(fd, "planningPeriodId"),
    contributionUnit: (optEnum(fd, "contributionUnit") as ContributionUnit | undefined) ?? null,
    plannedContribution: optNum(fd, "plannedContribution"),
    realizedContribution: optNum(fd, "realizedContribution"),
    contributionWeight: optNum(fd, "contributionWeight"),
    evidenceUrl: optStr(fd, "evidenceUrl"),
    evidenceNote: optStr(fd, "evidenceNote"),
  };
}

function revalidateTaskViews() {
  revalidatePath("/dashboard/tarefas");
  revalidatePath("/dashboard/metas");
  revalidatePath("/dashboard/metas/checklists");
}

function taskWhereForUser(
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

export async function createTask(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await requireWrite("TAREFAS");
  if ("error" in auth) return auth;

  const parsed = taskSchema.safeParse(parseTask(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  if (!(await canLinkGoal(auth.user, parsed.data.goalId)))
    return { fieldErrors: { goalId: ["Meta indisponível para este usuário."] } };
  const d = isRestrictedToOwn(auth.user.role)
    ? { ...parsed.data, assigneeId: auth.user.id }
    : parsed.data;

  try {
    const created = await prisma.task.create({
      data: {
        ...d,
        completedAt: d.status === "CONCLUIDA" ? new Date() : null,
        createdById: auth.user.id,
      },
    });
    if (created.goalId) await recomputeGoalChain(created.goalId, auth.user.id);
  } catch {
    return { error: "Não foi possível criar a tarefa." };
  }

  revalidateTaskViews();
  redirect("/dashboard/tarefas");
}

export async function updateTask(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await requireWrite("TAREFAS");
  if ("error" in auth) return auth;

  const parsed = taskSchema.safeParse(parseTask(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  if (!(await canLinkGoal(auth.user, parsed.data.goalId)))
    return { fieldErrors: { goalId: ["Meta indisponível para este usuário."] } };
  const d = isRestrictedToOwn(auth.user.role)
    ? { ...parsed.data, assigneeId: auth.user.id }
    : parsed.data;

  try {
    const before = await prisma.task.findFirst({
      where: taskWhereForUser(id, auth.user),
      select: { goalId: true, status: true },
    });
    if (!before) return { error: "Tarefa não encontrada." };

    const wasDone = before.status === "CONCLUIDA";
    const nowDone = d.status === "CONCLUIDA";

    await prisma.task.update({
      where: { id },
      data: {
        ...d,
        completedAt: nowDone ? (wasDone ? undefined : new Date()) : null,
      },
    });

    // Recalcula a(s) meta(s) afetada(s): a nova e, se mudou, a antiga.
    const affected = new Set<string>();
    if (d.goalId) affected.add(d.goalId);
    if (before.goalId && before.goalId !== d.goalId) affected.add(before.goalId);
    for (const gid of affected) await recomputeGoalChain(gid, auth.user.id);
  } catch {
    return { error: "Não foi possível atualizar a tarefa." };
  }

  revalidateTaskViews();
  redirect("/dashboard/tarefas");
}

export async function completeTask(id: string): Promise<ActionState> {
  const auth = await requireWrite("TAREFAS");
  if ("error" in auth) return auth;

  try {
    const t = await prisma.task.findFirst({
      where: taskWhereForUser(id, auth.user),
      select: { goalId: true, plannedContribution: true, realizedContribution: true },
    });
    if (!t) return { error: "Tarefa não encontrada." };

    const realized = t.realizedContribution ?? t.plannedContribution ?? null;
    await prisma.task.update({
      where: { id },
      data: { status: "CONCLUIDA", completedAt: new Date(), realizedContribution: realized },
    });

    if (t.goalId) {
      await recomputeGoalChain(t.goalId, auth.user.id);
      await logGoal(t.goalId, "CHECKLIST_CONCLUIDO", { taskId: id, realized }, auth.user.id);
    }
  } catch {
    return { error: "Não foi possível concluir a tarefa." };
  }

  revalidateTaskViews();
  return { ok: true };
}

export async function deleteTask(id: string): Promise<ActionState> {
  const auth = await requireWrite("TAREFAS");
  if ("error" in auth) return auth;

  try {
    const t = await prisma.task.findFirst({
      where: taskWhereForUser(id, auth.user),
      select: { goalId: true },
    });
    if (!t) return { error: "Tarefa não encontrada." };
    await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
    if (t?.goalId) await recomputeGoalChain(t.goalId, auth.user.id);
  } catch {
    return { error: "Não foi possível excluir a tarefa." };
  }

  revalidateTaskViews();
  return { ok: true };
}
