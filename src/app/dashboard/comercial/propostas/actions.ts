"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireWrite,
  requireLegalPermission,
  zodFieldErrors,
  str,
  optStr,
  num,
  optInt,
  optDate,
  optEnum,
  type ActionState,
} from "@/lib/actions";
import { writeAudit } from "@/lib/audit";

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
  const auth = await requireWrite("COMERCIAL");
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
  const auth = await requireWrite("COMERCIAL");
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
  const auth = await requireWrite("COMERCIAL");
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

export async function generateContractFromProposal(
  id: string,
): Promise<ActionState> {
  const auth = await requireLegalPermission("GENERATE_CONTRACT_FROM_PROPOSAL");
  if ("error" in auth) return auth;
  try {
    const proposal = await prisma.proposal.findFirst({
      where: { id, deletedAt: null },
      include: { contract: { select: { id: true } } },
    });
    if (!proposal) return { error: "Proposta não encontrada." };
    if (proposal.status !== "ACEITA") {
      return { error: "Somente propostas aceitas podem gerar contrato." };
    }
    if (!proposal.clientId) {
      return { error: "Vincule um cliente à proposta antes de gerar o contrato." };
    }
    if (proposal.contract) {
      return { error: "Esta proposta já possui contrato no Jurídico." };
    }
    const contract = await prisma.contract.create({
      data: {
        clientId: proposal.clientId,
        proposalId: proposal.id,
        title: proposal.title,
        type: "PROJETO_FECHADO",
        totalValue: proposal.value,
        status: "RASCUNHO",
        startDate: proposal.expectedDate,
        commercialResponsibleId: auth.user.id,
        createdById: auth.user.id,
        updatedById: auth.user.id,
        notes: proposal.notes,
      },
    });
    await writeAudit({
      userId: auth.user.id,
      action: "generate_contract",
      entity: "Proposal",
      entityId: proposal.id,
      after: { contractId: contract.id, clientId: proposal.clientId },
      origin: "comercial/propostas",
    });
    revalidatePath("/dashboard/comercial/propostas");
    revalidatePath("/dashboard/juridico/contratos");
    redirect(`/dashboard/juridico/contratos/${contract.id}/edit`);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String(error.digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return { error: "Esta proposta já possui contrato no Jurídico." };
    }
    return { error: "Não foi possível gerar o contrato." };
  }
}
