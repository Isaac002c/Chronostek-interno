"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LeadOrigin, LeadStatus, LeadInteractionType, Priority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessModule, isRestrictedToOwn } from "@/lib/rbac";
import {
  requireWrite,
  zodFieldErrors,
  str,
  optStr,
  optNum,
  optInt,
  optDate,
  optEnum,
  type ActionState,
} from "@/lib/actions";

const leadSchema = z.object({
  name: z.string().min(1, "Informe o nome do lead."),
  company: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email("E-mail inválido.").nullable(),
  origin: z.nativeEnum(LeadOrigin),
  channel: z.string().nullable(),
  responsibleId: z.string().nullable(),
  status: z.nativeEnum(LeadStatus),
  estimatedValue: z.number().nonnegative("Valor inválido.").nullable(),
  probability: z
    .number()
    .int()
    .min(0, "0 a 100.")
    .max(100, "0 a 100.")
    .nullable(),
  expectedCloseDate: z.date().nullable(),
  notes: z.string().nullable(),
  lossReason: z.string().nullable(),
  tags: z.array(z.string()),
});

function parseLead(fd: FormData) {
  return {
    name: str(fd, "name"),
    company: optStr(fd, "company"),
    phone: optStr(fd, "phone"),
    email: optStr(fd, "email"),
    origin: (optEnum(fd, "origin") ?? "OUTRO") as LeadOrigin,
    channel: optStr(fd, "channel"),
    responsibleId: optStr(fd, "responsibleId"),
    status: (optEnum(fd, "status") ?? "NOVO") as LeadStatus,
    estimatedValue: optNum(fd, "estimatedValue"),
    probability: optInt(fd, "probability"),
    expectedCloseDate: optDate(fd, "expectedCloseDate"),
    notes: optStr(fd, "notes"),
    lossReason: optStr(fd, "lossReason"),
    tags: str(fd, "tags")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

function leadWhereForUser(
  id: string,
  user: { id: string; role: import("@prisma/client").Role },
) {
  return {
    id,
    deletedAt: null,
    ...(isRestrictedToOwn(user.role) ? { responsibleId: user.id } : {}),
  };
}

export async function createLead(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite("LEADS");
  if ("error" in auth) return auth;

  const parsed = leadSchema.safeParse(parseLead(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  let id: string;
  try {
    const data = isRestrictedToOwn(auth.user.role)
      ? { ...parsed.data, responsibleId: auth.user.id }
      : parsed.data;
    const lead = await prisma.lead.create({ data });
    id = lead.id;
  } catch {
    return { error: "Não foi possível salvar o lead." };
  }

  revalidatePath("/dashboard/leads");
  redirect(`/dashboard/leads/${id}`);
}

export async function updateLead(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite("LEADS");
  if ("error" in auth) return auth;

  const parsed = leadSchema.safeParse(parseLead(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    const existing = await prisma.lead.findFirst({
      where: leadWhereForUser(id, auth.user),
      select: { id: true },
    });
    if (!existing) return { error: "Lead não encontrado." };
    const data = isRestrictedToOwn(auth.user.role)
      ? { ...parsed.data, responsibleId: auth.user.id }
      : parsed.data;
    await prisma.lead.update({ where: { id }, data });
  } catch {
    return { error: "Não foi possível atualizar o lead." };
  }

  revalidatePath("/dashboard/leads");
  revalidatePath(`/dashboard/leads/${id}`);
  redirect(`/dashboard/leads/${id}`);
}

export async function deleteLead(id: string): Promise<ActionState> {
  const auth = await requireWrite("LEADS");
  if ("error" in auth) return auth;

  try {
    const result = await prisma.lead.updateMany({
      where: leadWhereForUser(id, auth.user),
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { error: "Lead não encontrado." };
  } catch {
    return { error: "Não foi possível excluir o lead." };
  }

  revalidatePath("/dashboard/leads");
  return { ok: true };
}

export async function addInteraction(
  leadId: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite("LEADS");
  if ("error" in auth) return auth;

  const content = str(fd, "content");
  if (!content) return { fieldErrors: { content: ["Descreva a interação."] } };

  try {
    const lead = await prisma.lead.findFirst({
      where: leadWhereForUser(leadId, auth.user),
      select: { id: true },
    });
    if (!lead) return { error: "Lead não encontrado." };
    await prisma.leadInteraction.create({
      data: {
        leadId,
        userId: auth.user.id,
        type: (optEnum(fd, "type") ?? "NOTA") as LeadInteractionType,
        content,
      },
    });
  } catch {
    return { error: "Não foi possível registrar a interação." };
  }

  revalidatePath(`/dashboard/leads/${leadId}`);
  return { ok: true };
}

export async function createTaskForLead(
  leadId: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite("LEADS");
  if ("error" in auth) return auth;

  const title = str(fd, "title");
  if (!title) return { fieldErrors: { title: ["Informe o título da tarefa."] } };

  try {
    const lead = await prisma.lead.findFirst({
      where: leadWhereForUser(leadId, auth.user),
      select: { id: true },
    });
    if (!lead) return { error: "Lead não encontrado." };
    await prisma.task.create({
      data: {
        title,
        leadId,
        module: "LEADS",
        priority: (optEnum(fd, "priority") ?? "MEDIA") as Priority,
        dueDate: optDate(fd, "dueDate"),
        assigneeId: auth.user.id,
        createdById: auth.user.id,
      },
    });
  } catch {
    return { error: "Não foi possível criar a tarefa." };
  }

  revalidatePath(`/dashboard/leads/${leadId}`);
  return { ok: true };
}

export async function convertLeadToClient(leadId: string): Promise<ActionState> {
  const auth = await requireWrite("LEADS");
  if ("error" in auth) return auth;

  const lead = await prisma.lead.findFirst({
    where: leadWhereForUser(leadId, auth.user),
  });
  if (!lead) return { error: "Lead não encontrado." };
  if (lead.convertedClientId)
    return { error: "Este lead já foi convertido em cliente." };

  let clientId: string;
  try {
    clientId = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          name: lead.company || lead.name,
          tradeName: lead.company ? lead.name : null,
          email: lead.email,
          phone: lead.phone,
          origin: lead.origin,
          status: "ATIVO",
          internalResponsibleId: lead.responsibleId,
        },
      });
      const claimedLead = await tx.lead.updateMany({
        where: {
          ...leadWhereForUser(leadId, auth.user),
          convertedClientId: null,
        },
        data: { convertedClientId: client.id, status: "GANHO" },
      });
      if (claimedLead.count !== 1) {
        throw new Error("Lead já convertido ou fora do escopo.");
      }
      return client.id;
    });
  } catch {
    return { error: "Não foi possível converter o lead." };
  }

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/comercial/clientes");
  redirect(
    canAccessModule(auth.user.role, "COMERCIAL")
      ? `/dashboard/comercial/clientes/${clientId}`
      : `/dashboard/leads/${leadId}`,
  );
}
