"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FinancialType, FinancialStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { maybeRequestExpenseApproval } from "@/lib/approvals";
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

const now = () => new Date();

const entrySchema = z.object({
  description: z.string().min(1, "Informe a descrição."),
  type: z.nativeEnum(FinancialType),
  value: z.number().nonnegative("Valor inválido."),
  dueDate: z.date().nullable(),
  paymentDate: z.date().nullable(),
  competenceMonth: z.number().int().min(1).max(12),
  competenceYear: z.number().int().min(2000).max(2100),
  status: z.nativeEnum(FinancialStatus),
  costCenterId: z.string().min(1, "Selecione o centro de custo."),
  categoryId: z.string().nullable(),
  clientId: z.string().nullable(),
  contractId: z.string().nullable(),
  projectId: z.string().nullable(),
  recurring: z.boolean(),
  installments: z.number().int().positive().nullable(),
  installmentNumber: z.number().int().positive().nullable(),
  paymentMethod: z.nativeEnum(PaymentMethod).nullable(),
  notes: z.string().nullable(),
});

function parseEntry(fd: FormData) {
  return {
    description: str(fd, "description"),
    type: (optEnum(fd, "type") ?? "RECEITA") as FinancialType,
    value: num(fd, "value"),
    dueDate: optDate(fd, "dueDate"),
    paymentDate: optDate(fd, "paymentDate"),
    competenceMonth: optInt(fd, "competenceMonth") ?? now().getMonth() + 1,
    competenceYear: optInt(fd, "competenceYear") ?? now().getFullYear(),
    status: (optEnum(fd, "status") ?? "PENDENTE") as FinancialStatus,
    costCenterId: optStr(fd, "costCenterId"),
    categoryId: optStr(fd, "categoryId"),
    clientId: optStr(fd, "clientId"),
    contractId: optStr(fd, "contractId"),
    projectId: optStr(fd, "projectId"),
    recurring: optBool(fd, "recurring"),
    installments: optInt(fd, "installments"),
    installmentNumber: optInt(fd, "installmentNumber"),
    paymentMethod: (optEnum(fd, "paymentMethod") ?? null) as PaymentMethod | null,
    notes: optStr(fd, "notes"),
  };
}

export async function createEntry(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = entrySchema.safeParse(parseEntry(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    const entry = await prisma.financialEntry.create({ data: parsed.data });
    await maybeRequestExpenseApproval({
      entryId: entry.id,
      type: parsed.data.type,
      value: parsed.data.value,
      requestedById: auth.user.id,
    });
  } catch {
    return { error: "Não foi possível salvar o lançamento." };
  }

  revalidatePath("/dashboard/financeiro/lancamentos");
  revalidatePath("/dashboard/financeiro");
  redirect("/dashboard/financeiro/lancamentos");
}

export async function updateEntry(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = entrySchema.safeParse(parseEntry(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.financialEntry.update({ where: { id }, data: parsed.data });
  } catch {
    return { error: "Não foi possível atualizar o lançamento." };
  }

  revalidatePath("/dashboard/financeiro/lancamentos");
  revalidatePath("/dashboard/financeiro");
  redirect("/dashboard/financeiro/lancamentos");
}

export async function deleteEntry(id: string): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  try {
    await prisma.financialEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } catch {
    return { error: "Não foi possível excluir o lançamento." };
  }

  revalidatePath("/dashboard/financeiro/lancamentos");
  revalidatePath("/dashboard/financeiro");
  return { ok: true };
}

/** Atalho: marcar um lançamento como pago hoje. */
export async function markEntryPaid(id: string): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  try {
    await prisma.financialEntry.update({
      where: { id },
      data: { status: "PAGO", paymentDate: new Date() },
    });
  } catch {
    return { error: "Não foi possível baixar o lançamento." };
  }

  revalidatePath("/dashboard/financeiro/lancamentos");
  revalidatePath("/dashboard/financeiro");
  return { ok: true };
}
