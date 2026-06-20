"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Priority, TaskStatus, ModuleKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import {
  requireWrite,
  zodFieldErrors,
  str,
  optStr,
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
  };
}

export async function createTask(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sessão expirada." };

  const parsed = taskSchema.safeParse(parseTask(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.task.create({
      data: { ...parsed.data, createdById: user.id },
    });
  } catch {
    return { error: "Não foi possível criar a tarefa." };
  }

  revalidatePath("/dashboard/tarefas");
  redirect("/dashboard/tarefas");
}

export async function updateTask(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = taskSchema.safeParse(parseTask(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.task.update({ where: { id }, data: parsed.data });
  } catch {
    return { error: "Não foi possível atualizar a tarefa." };
  }

  revalidatePath("/dashboard/tarefas");
  redirect("/dashboard/tarefas");
}

export async function completeTask(id: string): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  try {
    await prisma.task.update({
      where: { id },
      data: { status: "CONCLUIDA" },
    });
  } catch {
    return { error: "Não foi possível concluir a tarefa." };
  }

  revalidatePath("/dashboard/tarefas");
  return { ok: true };
}

export async function deleteTask(id: string): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  try {
    await prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } catch {
    return { error: "Não foi possível excluir a tarefa." };
  }

  revalidatePath("/dashboard/tarefas");
  return { ok: true };
}
