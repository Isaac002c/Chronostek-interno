"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  LegalDeadlineStatus,
  Priority,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireLegalPermission,
  zodFieldErrors,
  str,
  optStr,
  optDate,
  optEnum,
  type ActionState,
} from "@/lib/actions";
import { writeAudit } from "@/lib/audit";

const deadlineSchema = z.object({
  title: z.string().min(1, "Informe o título do prazo."),
  contractId: z.string().nullable(),
  date: z.date({ message: "Informe a data." }),
  priority: z.nativeEnum(Priority),
  status: z.nativeEnum(LegalDeadlineStatus),
  responsibleId: z.string().nullable(),
});

function parseDeadline(formData: FormData) {
  return {
    title: str(formData, "title"),
    contractId: optStr(formData, "contractId"),
    date: optDate(formData, "date"),
    priority: (optEnum(formData, "priority") ?? "MEDIA") as Priority,
    status: (optEnum(formData, "status") ??
      "PENDENTE") as LegalDeadlineStatus,
    responsibleId: optStr(formData, "responsibleId"),
  };
}

function revalidateLegal() {
  revalidatePath("/dashboard/juridico");
  revalidatePath("/dashboard/juridico/prazos");
  revalidatePath("/dashboard/calendario");
}

export async function createDeadline(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireLegalPermission("EDIT_CONTRACT");
  if ("error" in auth) return auth;
  const parsed = deadlineSchema.safeParse(parseDeadline(formData));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  try {
    if (parsed.data.contractId) {
      const contract = await prisma.contract.count({
        where: { id: parsed.data.contractId, deletedAt: null },
      });
      if (!contract) return { error: "Contrato não encontrado." };
    }
    const deadline = await prisma.legalDeadline.create({
      data: {
        ...parsed.data,
        responsibleId: parsed.data.responsibleId ?? auth.user.id,
      },
    });
    const sourceKey = `legal-deadline:${deadline.id}`;
    await prisma.calendarEvent.create({
      data: {
        tenantId: "default",
        title: deadline.title,
        description:
          "Prazo jurídico automático. Altere o registro de origem no Jurídico.",
        type: "PRAZO",
        status: "AGENDADO",
        priority:
          deadline.priority === "CRITICA"
            ? "CRITICA"
            : deadline.priority === "ALTA"
              ? "ALTA"
              : deadline.priority === "BAIXA"
                ? "BAIXA"
                : "MEDIA",
        privacy: "INTERNO",
        origin: "AUTOMACAO",
        startAt: deadline.date,
        endAt: new Date(deadline.date.getTime() + 60 * 60 * 1000),
        allDay: true,
        timezone: "America/Sao_Paulo",
        category: "Jurídico · Prazo",
        color: "#7c3aed",
        department: "JURIDICO",
        responsibleId: deadline.responsibleId,
        sourceEntityType: "LEGAL_DEADLINE",
        sourceEntityId: deadline.id,
        sourceKey,
        syncPending: true,
      },
    });
    await writeAudit({
      userId: auth.user.id,
      action: "create",
      entity: "LegalDeadline",
      entityId: deadline.id,
      after: parsed.data,
      origin: "juridico/prazos",
    });
  } catch {
    return { error: "Não foi possível criar o prazo." };
  }
  revalidateLegal();
  return { ok: true };
}

export async function markDeadlineDone(id: string): Promise<ActionState> {
  const auth = await requireLegalPermission("EDIT_CONTRACT");
  if ("error" in auth) return auth;
  try {
    const before = await prisma.legalDeadline.findUnique({ where: { id } });
    if (!before) return { error: "Prazo não encontrado." };
    await prisma.$transaction([
      prisma.legalDeadline.update({
        where: { id },
        data: { status: "CONCLUIDO", completedAt: new Date() },
      }),
      prisma.calendarEvent.updateMany({
        where: {
          tenantId: "default",
          sourceKey: `legal-deadline:${id}`,
          deletedAt: null,
        },
        data: { status: "CONCLUIDO", syncPending: true },
      }),
    ]);
    await writeAudit({
      userId: auth.user.id,
      action: "complete",
      entity: "LegalDeadline",
      entityId: id,
      before,
      after: { status: "CONCLUIDO" },
      origin: "juridico/prazos",
    });
  } catch {
    return { error: "Não foi possível concluir o prazo." };
  }
  revalidateLegal();
  return { ok: true };
}

export async function deleteDeadline(id: string): Promise<ActionState> {
  const auth = await requireLegalPermission("EDIT_CONTRACT");
  if ("error" in auth) return auth;
  try {
    const before = await prisma.legalDeadline.findUnique({ where: { id } });
    if (!before) return { error: "Prazo não encontrado." };
    await prisma.$transaction([
      prisma.legalDeadline.delete({ where: { id } }),
      prisma.calendarEvent.updateMany({
        where: {
          tenantId: "default",
          sourceKey: `legal-deadline:${id}`,
          deletedAt: null,
        },
        data: { deletedAt: new Date(), syncPending: true },
      }),
    ]);
    await writeAudit({
      userId: auth.user.id,
      action: "delete",
      entity: "LegalDeadline",
      entityId: id,
      before,
      origin: "juridico/prazos",
    });
  } catch {
    return { error: "Não foi possível excluir o prazo." };
  }
  revalidateLegal();
  return { ok: true };
}
