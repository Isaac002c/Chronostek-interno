"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BudgetPeriodType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
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

const schema = z.object({
  costCenterId: z.string().min(1, "Selecione o centro de custo."),
  periodType: z.nativeEnum(BudgetPeriodType),
  month: z.number().int().min(1).max(12).nullable(),
  quarter: z.number().int().min(1).max(4).nullable(),
  year: z.number().int().min(2000).max(2100),
  plannedRevenue: z.number().nonnegative(),
  plannedExpense: z.number().nonnegative(),
  notes: z.string().nullable(),
});

function parse(fd: FormData) {
  return {
    costCenterId: str(fd, "costCenterId"),
    periodType: (optEnum(fd, "periodType") ?? "MENSAL") as BudgetPeriodType,
    month: optInt(fd, "month"),
    quarter: optInt(fd, "quarter"),
    year: optInt(fd, "year") ?? new Date().getFullYear(),
    plannedRevenue: num(fd, "plannedRevenue"),
    plannedExpense: num(fd, "plannedExpense"),
    notes: optStr(fd, "notes"),
  };
}

export async function createBudget(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = schema.safeParse(parse(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;

  let id: string;
  try {
    const b = await prisma.budget.create({
      data: {
        costCenterId: d.costCenterId,
        periodType: d.periodType,
        month: d.periodType === "MENSAL" ? d.month : null,
        quarter: d.periodType === "TRIMESTRAL" ? d.quarter : null,
        year: d.year,
        plannedRevenue: d.plannedRevenue,
        plannedExpense: d.plannedExpense,
        plannedProfit: d.plannedRevenue - d.plannedExpense,
        notes: d.notes,
      },
    });
    id = b.id;
  } catch {
    return { error: "Não foi possível salvar o orçamento." };
  }

  revalidatePath("/dashboard/financeiro/orcamentos");
  redirect(`/dashboard/financeiro/orcamentos/${id}`);
}

export async function updateBudget(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = schema.safeParse(parse(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;

  const existing = await prisma.budget.findUnique({ where: { id }, select: { status: true } });
  if (!existing) return { error: "Orçamento não encontrado." };
  if (existing.status !== "RASCUNHO")
    return { error: "Só é possível editar orçamentos em rascunho." };

  try {
    await prisma.budget.update({
      where: { id },
      data: {
        costCenterId: d.costCenterId,
        periodType: d.periodType,
        month: d.periodType === "MENSAL" ? d.month : null,
        quarter: d.periodType === "TRIMESTRAL" ? d.quarter : null,
        year: d.year,
        plannedRevenue: d.plannedRevenue,
        plannedExpense: d.plannedExpense,
        plannedProfit: d.plannedRevenue - d.plannedExpense,
        notes: d.notes,
      },
    });
  } catch {
    return { error: "Não foi possível atualizar o orçamento." };
  }

  revalidatePath("/dashboard/financeiro/orcamentos");
  revalidatePath(`/dashboard/financeiro/orcamentos/${id}`);
  redirect(`/dashboard/financeiro/orcamentos/${id}`);
}

async function setStatus(
  id: string,
  status: "APROVADO" | "ATIVO" | "ENCERRADO",
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sessão expirada." };
  try {
    await prisma.budget.update({
      where: { id },
      data: {
        status,
        ...(status === "APROVADO" ? { approvedById: user.id, approvedAt: new Date() } : {}),
      },
    });
  } catch {
    return { error: "Não foi possível alterar o status." };
  }
  revalidatePath("/dashboard/financeiro/orcamentos");
  revalidatePath(`/dashboard/financeiro/orcamentos/${id}`);
  return { ok: true };
}

export async function approveBudget(id: string): Promise<ActionState> {
  return setStatus(id, "APROVADO");
}
export async function activateBudget(id: string): Promise<ActionState> {
  return setStatus(id, "ATIVO");
}
export async function closeBudget(id: string): Promise<ActionState> {
  return setStatus(id, "ENCERRADO");
}

export async function deleteBudget(id: string): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;
  try {
    await prisma.budget.update({ where: { id }, data: { deletedAt: new Date() } });
  } catch {
    return { error: "Não foi possível excluir o orçamento." };
  }
  revalidatePath("/dashboard/financeiro/orcamentos");
  return { ok: true };
}
