"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LegalDocumentType, LegalDocumentStatus } from "@prisma/client";
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

async function defaultLegalCC(value: string | null): Promise<string | null> {
  if (value) return value;
  const cc = await prisma.costCenter.findUnique({ where: { code: 5000 }, select: { id: true } });
  return cc?.id ?? null;
}

const schema = z.object({
  title: z.string().min(1, "Informe o título do documento."),
  type: z.nativeEnum(LegalDocumentType),
  status: z.nativeEnum(LegalDocumentStatus),
  legalContractId: z.string().nullable(),
  clientId: z.string().nullable(),
  fileUrl: z.string().nullable(),
  externalLink: z.string().nullable(),
  expirationDate: z.date().nullable(),
  responsibleId: z.string().nullable(),
  costCenterId: z.string().nullable(),
  notes: z.string().nullable(),
});

function parse(fd: FormData) {
  return {
    title: str(fd, "title"),
    type: (optEnum(fd, "type") ?? "OUTRO") as LegalDocumentType,
    status: (optEnum(fd, "status") ?? "RASCUNHO") as LegalDocumentStatus,
    legalContractId: optStr(fd, "legalContractId"),
    clientId: optStr(fd, "clientId"),
    fileUrl: optStr(fd, "fileUrl"),
    externalLink: optStr(fd, "externalLink"),
    expirationDate: optDate(fd, "expirationDate"),
    responsibleId: optStr(fd, "responsibleId"),
    costCenterId: optStr(fd, "costCenterId"),
    notes: optStr(fd, "notes"),
  };
}

export async function createLegalDocument(_p: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await requireWrite("JURIDICO");
  if ("error" in auth) return auth;
  const parsed = schema.safeParse(parse(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;
  try {
    await prisma.legalDocument.create({ data: { ...d, costCenterId: await defaultLegalCC(d.costCenterId) } });
  } catch {
    return { error: "Não foi possível salvar o documento." };
  }
  revalidatePath("/dashboard/juridico/documentos");
  redirect("/dashboard/juridico/documentos");
}

export async function updateLegalDocument(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await requireWrite("JURIDICO");
  if ("error" in auth) return auth;
  const parsed = schema.safeParse(parse(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  try {
    await prisma.legalDocument.update({ where: { id }, data: parsed.data });
  } catch {
    return { error: "Não foi possível atualizar o documento." };
  }
  revalidatePath("/dashboard/juridico/documentos");
  redirect("/dashboard/juridico/documentos");
}

export async function deleteLegalDocument(id: string): Promise<ActionState> {
  const auth = await requireWrite("JURIDICO");
  if ("error" in auth) return auth;
  try {
    await prisma.legalDocument.update({ where: { id }, data: { deletedAt: new Date() } });
  } catch {
    return { error: "Não foi possível excluir o documento." };
  }
  revalidatePath("/dashboard/juridico/documentos");
  return { ok: true };
}
