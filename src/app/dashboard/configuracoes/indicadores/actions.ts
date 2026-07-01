"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ContributionUnit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";
import {
  requireWrite,
  zodFieldErrors,
  str,
  optStr,
  optBool,
  optEnum,
  type ActionState,
} from "@/lib/actions";

const schema = z.object({
  name: z.string().min(1, "Informe o nome do indicador."),
  unit: z.nativeEnum(ContributionUnit),
  customUnit: z.string().nullable(),
  category: z.string().nullable(),
  icon: z.string().nullable(),
  formula: z.string().nullable(),
  calculationType: z.string().nullable(),
  defaultCostCenterId: z.string().nullable(),
  active: z.boolean(),
});

function parse(fd: FormData) {
  return {
    name: str(fd, "name"),
    unit: (optEnum(fd, "unit") ?? "QUANTIDADE") as ContributionUnit,
    customUnit: optStr(fd, "customUnit"),
    category: optStr(fd, "category"),
    icon: optStr(fd, "icon"),
    formula: optStr(fd, "formula"),
    calculationType: optStr(fd, "calculationType"),
    defaultCostCenterId: optStr(fd, "defaultCostCenterId"),
    active: optBool(fd, "active"),
  };
}

async function requireAdmin() {
  const auth = await requireWrite();
  if ("error" in auth) return auth;
  if (!isAdmin(auth.user.role)) return { error: "Apenas administradores podem gerenciar indicadores." };
  return auth;
}

export async function createIndicator(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const parsed = schema.safeParse(parse(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.goalIndicator.create({ data: parsed.data });
  } catch {
    return { error: "Não foi possível criar o indicador." };
  }
  revalidatePath("/dashboard/configuracoes/indicadores");
  redirect("/dashboard/configuracoes/indicadores");
}

export async function updateIndicator(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const parsed = schema.safeParse(parse(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.goalIndicator.update({ where: { id }, data: parsed.data });
  } catch {
    return { error: "Não foi possível atualizar o indicador." };
  }
  revalidatePath("/dashboard/configuracoes/indicadores");
  redirect("/dashboard/configuracoes/indicadores");
}

export async function deleteIndicator(id: string): Promise<ActionState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  try {
    await prisma.goalIndicator.delete({ where: { id } });
  } catch {
    return { error: "Não foi possível excluir o indicador." };
  }
  revalidatePath("/dashboard/configuracoes/indicadores");
  return { ok: true };
}
