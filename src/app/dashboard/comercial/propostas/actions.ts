"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireWrite,
  zodFieldErrors,
  str,
  optStr,
  num,
  optInt,
  optDate,
  optEnum,
  type ActionState,
} from "@/lib/actions";

const proposalSchema = z.object({
  clientId: z.string().nullable(),
  leadId: z.string().nullable(),
  title: z.string().min(1, "Informe o título da proposta."),
  value: z.number().nonnegative("Valor inválido."),
  status: z.nativeEnum(ProposalStatus),
  probability: z.number().int().min(0).max(100).nullable(),
  expectedDate: z.date().nullable(),
  notes: z.string().nullable(),
});

function parseProposal(fd: FormData) {
  return {
    clientId: optStr(fd, "clientId"),
    leadId: optStr(fd, "leadId"),
    title: str(fd, "title"),
    value: num(fd, "value"),
    status: (optEnum(fd, "status") ?? "RASCUNHO") as ProposalStatus,
    probability: optInt(fd, "probability"),
    expectedDate: optDate(fd, "expectedDate"),
    notes: optStr(fd, "notes"),
  };
}

export async function createProposal(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = proposalSchema.safeParse(parseProposal(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.proposal.create({ data: parsed.data });
  } catch {
    return { error: "Não foi possível salvar a proposta." };
  }

  revalidatePath("/dashboard/comercial/propostas");
  redirect("/dashboard/comercial/propostas");
}

export async function updateProposal(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = proposalSchema.safeParse(parseProposal(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.proposal.update({ where: { id }, data: parsed.data });
  } catch {
    return { error: "Não foi possível atualizar a proposta." };
  }

  revalidatePath("/dashboard/comercial/propostas");
  redirect("/dashboard/comercial/propostas");
}

export async function deleteProposal(id: string): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  try {
    await prisma.proposal.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } catch {
    return { error: "Não foi possível excluir a proposta." };
  }

  revalidatePath("/dashboard/comercial/propostas");
  return { ok: true };
}
