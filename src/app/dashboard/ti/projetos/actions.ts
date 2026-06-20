"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ProjectType, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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

const projectSchema = z.object({
  name: z.string().min(1, "Informe o nome do projeto."),
  clientId: z.string().nullable(),
  contractId: z.string().nullable(),
  type: z.nativeEnum(ProjectType),
  status: z.nativeEnum(ProjectStatus),
  budgetValue: z.number().nonnegative().nullable(),
  estimatedCost: z.number().nonnegative().nullable(),
  hourlyRate: z.number().nonnegative().nullable(),
  startDate: z.date().nullable(),
  deadline: z.date().nullable(),
  responsibleId: z.string().nullable(),
  costCenterId: z.string().nullable(),
  description: z.string().nullable(),
});

function parseProject(fd: FormData) {
  return {
    name: str(fd, "name"),
    clientId: optStr(fd, "clientId"),
    contractId: optStr(fd, "contractId"),
    type: (optEnum(fd, "type") ?? "SISTEMA") as ProjectType,
    status: (optEnum(fd, "status") ?? "PLANEJADO") as ProjectStatus,
    budgetValue: optNum(fd, "budgetValue"),
    estimatedCost: optNum(fd, "estimatedCost"),
    hourlyRate: optNum(fd, "hourlyRate"),
    startDate: optDate(fd, "startDate"),
    deadline: optDate(fd, "deadline"),
    responsibleId: optStr(fd, "responsibleId"),
    costCenterId: optStr(fd, "costCenterId"),
    description: optStr(fd, "description"),
  };
}

export async function createProject(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = projectSchema.safeParse(parseProject(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  let id: string;
  try {
    const project = await prisma.project.create({ data: parsed.data });
    id = project.id;
  } catch {
    return { error: "Não foi possível salvar o projeto." };
  }

  revalidatePath("/dashboard/ti/projetos");
  redirect(`/dashboard/ti/projetos/${id}`);
}

export async function updateProject(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = projectSchema.safeParse(parseProject(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.project.update({ where: { id }, data: parsed.data });
  } catch {
    return { error: "Não foi possível atualizar o projeto." };
  }

  revalidatePath("/dashboard/ti/projetos");
  revalidatePath(`/dashboard/ti/projetos/${id}`);
  redirect(`/dashboard/ti/projetos/${id}`);
}

export async function deleteProject(id: string): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  try {
    await prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } catch {
    return { error: "Não foi possível excluir o projeto." };
  }

  revalidatePath("/dashboard/ti/projetos");
  return { ok: true };
}
