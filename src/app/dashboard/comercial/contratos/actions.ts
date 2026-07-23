"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ContractType, ContractStatus } from "@prisma/client";
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

const contractSchema = z.object({
  clientId: z.string().min(1, "Selecione o cliente."),
  title: z.string().min(1, "Informe o título do contrato."),
  type: z.nativeEnum(ContractType),
  totalValue: z.number().nonnegative().nullable(),
  monthlyValue: z.number().nonnegative().nullable(),
  startDate: z.date().nullable(),
  endDate: z.date().nullable(),
  status: z.nativeEnum(ContractStatus),
  costCenterId: z.string().nullable(),
  categoryId: z.string().nullable(),
  notes: z.string().nullable(),
});

function parseContract(fd: FormData) {
  return {
    clientId: str(fd, "clientId"),
    title: str(fd, "title"),
    type: (optEnum(fd, "type") ?? "PROJETO_FECHADO") as ContractType,
    totalValue: optNum(fd, "totalValue"),
    monthlyValue: optNum(fd, "monthlyValue"),
    startDate: optDate(fd, "startDate"),
    endDate: optDate(fd, "endDate"),
    status: (optEnum(fd, "status") ?? "ATIVO") as ContractStatus,
    costCenterId: optStr(fd, "costCenterId"),
    categoryId: optStr(fd, "categoryId"),
    notes: optStr(fd, "notes"),
  };
}

export async function createContract(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite("COMERCIAL");
  if ("error" in auth) return auth;

  const parsed = contractSchema.safeParse(parseContract(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.contract.create({ data: parsed.data });
  } catch {
    return { error: "Não foi possível salvar o contrato." };
  }

  revalidatePath("/dashboard/comercial/contratos");
  redirect("/dashboard/comercial/contratos");
}

export async function updateContract(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite("COMERCIAL");
  if ("error" in auth) return auth;

  const parsed = contractSchema.safeParse(parseContract(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.contract.update({ where: { id }, data: parsed.data });
  } catch {
    return { error: "Não foi possível atualizar o contrato." };
  }

  revalidatePath("/dashboard/comercial/contratos");
  redirect("/dashboard/comercial/contratos");
}

export async function deleteContract(id: string): Promise<ActionState> {
  const auth = await requireWrite("COMERCIAL");
  if ("error" in auth) return auth;

  try {
    await prisma.contract.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } catch {
    return { error: "Não foi possível excluir o contrato." };
  }

  revalidatePath("/dashboard/comercial/contratos");
  return { ok: true };
}
