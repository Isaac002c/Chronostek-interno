"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { TimesheetType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireWrite,
  zodFieldErrors,
  str,
  optStr,
  num,
  optDate,
  optBool,
  optEnum,
  type ActionState,
} from "@/lib/actions";

const timesheetSchema = z.object({
  userId: z.string().min(1, "Selecione o profissional."),
  projectId: z.string().min(1, "Selecione o projeto."),
  date: z.date({ message: "Informe a data." }),
  hours: z.number().positive("Horas devem ser maiores que zero."),
  description: z.string().nullable(),
  type: z.nativeEnum(TimesheetType),
  productive: z.boolean(),
});

function parseTimesheet(fd: FormData) {
  return {
    userId: str(fd, "userId"),
    projectId: str(fd, "projectId"),
    date: optDate(fd, "date"),
    hours: num(fd, "hours"),
    description: optStr(fd, "description"),
    type: (optEnum(fd, "type") ?? "DESENVOLVIMENTO") as TimesheetType,
    productive: fd.has("productive") ? optBool(fd, "productive") : true,
  };
}

export async function createTimesheet(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite("TI");
  if ("error" in auth) return auth;

  const parsed = timesheetSchema.safeParse(parseTimesheet(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.timesheet.create({ data: parsed.data });
  } catch {
    return { error: "Não foi possível registrar as horas." };
  }

  revalidatePath("/dashboard/ti/timesheet");
  revalidatePath("/dashboard/ti/projetos");
  revalidatePath(`/dashboard/ti/projetos/${parsed.data.projectId}`);
  return { ok: true };
}

export async function deleteTimesheet(id: string): Promise<ActionState> {
  const auth = await requireWrite("TI");
  if ("error" in auth) return auth;

  try {
    const row = await prisma.timesheet.delete({ where: { id } });
    revalidatePath("/dashboard/ti/timesheet");
    revalidatePath("/dashboard/ti/projetos");
    revalidatePath(`/dashboard/ti/projetos/${row.projectId}`);
  } catch {
    return { error: "Não foi possível excluir o registro." };
  }

  return { ok: true };
}
