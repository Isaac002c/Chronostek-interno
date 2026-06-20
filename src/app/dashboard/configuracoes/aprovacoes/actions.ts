"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/rbac";
import type { ActionState } from "@/lib/actions";

async function respond(
  id: string,
  status: "APROVADO" | "REJEITADO",
): Promise<ActionState> {
  const u = await getCurrentUser();
  if (!u) return { error: "Sessão expirada." };
  if (!isAdmin(u.role)) return { error: "Apenas administradores aprovam." };

  try {
    const req = await prisma.approvalRequest.update({
      where: { id },
      data: { status, approvedById: u.id, respondedAt: new Date() },
    });
    // Despesa rejeitada -> cancela o lançamento vinculado.
    if (status === "REJEITADO" && req.entityType === "FinancialEntry") {
      await prisma.financialEntry
        .update({ where: { id: req.entityId }, data: { status: "CANCELADO" } })
        .catch(() => undefined);
    }
  } catch {
    return { error: "Não foi possível responder à solicitação." };
  }

  revalidatePath("/dashboard/configuracoes/aprovacoes");
  revalidatePath("/dashboard/financeiro/lancamentos");
  return { ok: true };
}

export async function approveApproval(id: string): Promise<ActionState> {
  return respond(id, "APROVADO");
}
export async function rejectApproval(id: string): Promise<ActionState> {
  return respond(id, "REJEITADO");
}
