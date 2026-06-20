"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  LegalContractType,
  LegalContractStatus,
  LegalDeadlineStatus,
  Priority,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireWrite,
  zodFieldErrors,
  str,
  optStr,
  optDate,
  optEnum,
  type ActionState,
} from "@/lib/actions";

// ───────────────────────── Contratos jurídicos ─────────────────────────

const legalSchema = z.object({
  title: z.string().min(1, "Informe o título."),
  counterpartyName: z.string().nullable(),
  clientId: z.string().nullable(),
  type: z.nativeEnum(LegalContractType),
  status: z.nativeEnum(LegalContractStatus),
  signatureDate: z.date().nullable(),
  expirationDate: z.date().nullable(),
  responsibleId: z.string().nullable(),
  fileUrl: z.string().nullable(),
  notes: z.string().nullable(),
});

function parseLegal(fd: FormData) {
  return {
    title: str(fd, "title"),
    counterpartyName: optStr(fd, "counterpartyName"),
    clientId: optStr(fd, "clientId"),
    type: (optEnum(fd, "type") ?? "OUTRO") as LegalContractType,
    status: (optEnum(fd, "status") ?? "RASCUNHO") as LegalContractStatus,
    signatureDate: optDate(fd, "signatureDate"),
    expirationDate: optDate(fd, "expirationDate"),
    responsibleId: optStr(fd, "responsibleId"),
    fileUrl: optStr(fd, "fileUrl"),
    notes: optStr(fd, "notes"),
  };
}

export async function createLegalContract(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = legalSchema.safeParse(parseLegal(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.legalContract.create({ data: parsed.data });
  } catch {
    return { error: "Não foi possível salvar o contrato jurídico." };
  }

  revalidatePath("/dashboard/juridico");
  redirect("/dashboard/juridico");
}

export async function updateLegalContract(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = legalSchema.safeParse(parseLegal(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.legalContract.update({ where: { id }, data: parsed.data });
  } catch {
    return { error: "Não foi possível atualizar o contrato jurídico." };
  }

  revalidatePath("/dashboard/juridico");
  redirect("/dashboard/juridico");
}

export async function deleteLegalContract(id: string): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  try {
    await prisma.legalContract.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } catch {
    return { error: "Não foi possível excluir o contrato jurídico." };
  }

  revalidatePath("/dashboard/juridico");
  return { ok: true };
}

// ───────────────────────── Prazos jurídicos ─────────────────────────

const deadlineSchema = z.object({
  title: z.string().min(1, "Informe o título do prazo."),
  legalContractId: z.string().nullable(),
  date: z.date({ message: "Informe a data." }),
  priority: z.nativeEnum(Priority),
  status: z.nativeEnum(LegalDeadlineStatus),
  responsibleId: z.string().nullable(),
});

function parseDeadline(fd: FormData) {
  return {
    title: str(fd, "title"),
    legalContractId: optStr(fd, "legalContractId"),
    date: optDate(fd, "date"),
    priority: (optEnum(fd, "priority") ?? "MEDIA") as Priority,
    status: (optEnum(fd, "status") ?? "PENDENTE") as LegalDeadlineStatus,
    responsibleId: optStr(fd, "responsibleId"),
  };
}

export async function createDeadline(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = deadlineSchema.safeParse(parseDeadline(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.legalDeadline.create({ data: parsed.data });
  } catch {
    return { error: "Não foi possível criar o prazo." };
  }

  revalidatePath("/dashboard/juridico");
  return { ok: true };
}

export async function markDeadlineDone(id: string): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  try {
    await prisma.legalDeadline.update({
      where: { id },
      data: { status: "CONCLUIDO" },
    });
  } catch {
    return { error: "Não foi possível concluir o prazo." };
  }

  revalidatePath("/dashboard/juridico");
  return { ok: true };
}

export async function deleteDeadline(id: string): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  try {
    await prisma.legalDeadline.delete({ where: { id } });
  } catch {
    return { error: "Não foi possível excluir o prazo." };
  }

  revalidatePath("/dashboard/juridico");
  return { ok: true };
}
