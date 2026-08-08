"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { canAccessModule, canWrite } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/office/agents";

export type ActionResult = { ok: boolean; error?: string };

/**
 * Decisão humana sobre uma solicitação de aprovação de um agente (§13). Registra
 * SEMPRE o usuário responsável e a atividade auditável. A autoridade é do backend.
 */
export async function decideApproval(input: {
  approvalId: string;
  decision: "APPROVED" | "REJECTED";
}): Promise<ActionResult> {
  const user = await requireUser();
  if (!canAccessModule(user.role, "OFFICE") || !canWrite(user.role)) {
    return { ok: false, error: "Sem permissão para decidir aprovações." };
  }
  if (input.decision !== "APPROVED" && input.decision !== "REJECTED") {
    return { ok: false, error: "Decisão inválida." };
  }

  const approval = await prisma.agentApproval.findUnique({
    where: { id: input.approvalId },
    select: {
      id: true,
      status: true,
      agentId: true,
      tenantId: true,
      conversationId: true,
      taskId: true,
      title: true,
    },
  });
  if (!approval) return { ok: false, error: "Aprovação não encontrada." };
  if (approval.status !== "PENDING") return { ok: false, error: "Esta solicitação já foi decidida." };

  await prisma.agentApproval.update({
    where: { id: approval.id },
    data: { status: input.decision, decidedById: user.id, decidedAt: new Date() },
  });

  await logActivity(
    {
      tenantId: approval.tenantId,
      agentId: approval.agentId,
      conversationId: approval.conversationId,
      taskId: approval.taskId,
      userId: user.id,
    },
    {
      type: input.decision === "APPROVED" ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED",
      title: `${input.decision === "APPROVED" ? "Aprovou" : "Rejeitou"}: ${approval.title}`,
    },
  );

  revalidatePath("/dashboard/office/aprovacoes");
  revalidatePath("/dashboard/office");
  return { ok: true };
}
