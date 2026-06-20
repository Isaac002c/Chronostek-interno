import { prisma } from "@/lib/prisma";

/** Acima deste valor, uma despesa exige aprovação. */
export const EXPENSE_APPROVAL_LIMIT = 5000;

export async function maybeRequestExpenseApproval(opts: {
  entryId: string;
  type: string;
  value: number;
  requestedById?: string | null;
}): Promise<void> {
  if (opts.type !== "DESPESA" || opts.value < EXPENSE_APPROVAL_LIMIT) return;
  try {
    await prisma.approvalRequest.create({
      data: {
        type: "DESPESA",
        requestedById: opts.requestedById ?? null,
        status: "PENDENTE",
        entityType: "FinancialEntry",
        entityId: opts.entryId,
        amount: opts.value,
        reason: `Despesa acima do limite de R$ ${EXPENSE_APPROVAL_LIMIT.toLocaleString("pt-BR")}`,
      },
    });
  } catch {
    // não bloquear o lançamento se a solicitação de aprovação falhar
  }
}
