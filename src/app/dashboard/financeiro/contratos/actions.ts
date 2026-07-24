"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFinancePermission, type ActionState } from "@/lib/actions";
import { generateMissingRecurringOccurrences } from "@/lib/finance-recurrence";

/**
 * Rotina idempotente de reparo. Séries novas já nascem com todo o prazo gerado;
 * esta ação apenas recompõe ocorrências ausentes sem duplicar cobranças.
 */
export async function generateRecurrences(): Promise<ActionState> {
  const auth = await requireFinancePermission("CREATE_RECURRENCE");
  if ("error" in auth) return auth;
  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() + 12);

  try {
    const series = await prisma.recurringEntry.findMany({
      where: { deletedAt: null, active: true, status: "ATIVA" },
      select: { id: true },
    });
    for (const item of series) {
      await generateMissingRecurringOccurrences(item.id, auth.user.id, horizon);
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível gerar as recorrências.",
    };
  }

  revalidatePath("/dashboard/financeiro/contratos");
  revalidatePath("/dashboard/financeiro/lancamentos");
  revalidatePath("/dashboard/financeiro/mes-a-mes");
  revalidatePath("/dashboard/financeiro");
  return { ok: true };
}
