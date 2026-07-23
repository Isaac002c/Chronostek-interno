"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LegalDemandType, LegalDemandStatus, Priority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireWrite,
  zodFieldErrors,
  str,
  optStr,
  optEnum,
  type ActionState,
} from "@/lib/actions";

async function defaultLegalCC(value: string | null): Promise<string | null> {
  if (value) return value;
  const cc = await prisma.costCenter.findUnique({ where: { code: 5000 }, select: { id: true } });
  return cc?.id ?? null;
}

const schema = z.object({
  title: z.string().min(1, "Informe o título da demanda."),
  description: z.string().nullable(),
  type: z.nativeEnum(LegalDemandType),
  status: z.nativeEnum(LegalDemandStatus),
  priority: z.nativeEnum(Priority),
  clientId: z.string().nullable(),
  legalContractId: z.string().nullable(),
  responsibleId: z.string().nullable(),
  costCenterId: z.string().nullable(),
  notes: z.string().nullable(),
});

function parse(fd: FormData) {
  return {
    title: str(fd, "title"),
    description: optStr(fd, "description"),
    type: (optEnum(fd, "type") ?? "REVISAO_CONTRATO") as LegalDemandType,
    status: (optEnum(fd, "status") ?? "ABERTA") as LegalDemandStatus,
    priority: (optEnum(fd, "priority") ?? "MEDIA") as Priority,
    clientId: optStr(fd, "clientId"),
    legalContractId: optStr(fd, "legalContractId"),
    responsibleId: optStr(fd, "responsibleId"),
    costCenterId: optStr(fd, "costCenterId"),
    notes: optStr(fd, "notes"),
  };
}

export async function createLegalDemand(_p: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await requireWrite("JURIDICO");
  if ("error" in auth) return auth;
  const parsed = schema.safeParse(parse(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;
  try {
    await prisma.legalDemand.create({
      data: {
        ...d,
        costCenterId: await defaultLegalCC(d.costCenterId),
        resolvedAt: d.status === "RESOLVIDA" ? new Date() : null,
      },
    });
  } catch {
    return { error: "Não foi possível salvar a demanda." };
  }
  revalidatePath("/dashboard/juridico/demandas");
  redirect("/dashboard/juridico/demandas");
}

export async function updateLegalDemand(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await requireWrite("JURIDICO");
  if ("error" in auth) return auth;
  const parsed = schema.safeParse(parse(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;
  try {
    await prisma.legalDemand.update({
      where: { id },
      data: { ...d, resolvedAt: d.status === "RESOLVIDA" ? new Date() : null },
    });
  } catch {
    return { error: "Não foi possível atualizar a demanda." };
  }
  revalidatePath("/dashboard/juridico/demandas");
  redirect("/dashboard/juridico/demandas");
}

export async function deleteLegalDemand(id: string): Promise<ActionState> {
  const auth = await requireWrite("JURIDICO");
  if ("error" in auth) return auth;
  try {
    await prisma.legalDemand.update({ where: { id }, data: { deletedAt: new Date() } });
  } catch {
    return { error: "Não foi possível excluir a demanda." };
  }
  revalidatePath("/dashboard/juridico/demandas");
  return { ok: true };
}
