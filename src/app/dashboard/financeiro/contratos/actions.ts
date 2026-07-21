"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { recurrenceOccurrences, competenceOf } from "@/lib/finance-rules";
import type { ActionState } from "@/lib/actions";

/**
 * Gera os lançamentos financeiros devidos a partir das recorrências ativas,
 * do início de cada recorrência até o fim do mês atual. Idempotente: não
 * duplica lançamentos já gerados (checa recurringEntryId + competência).
 */
export async function generateRecurrences(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user || !canWrite(user.role))
    return { error: "Você não tem permissão para gerar recorrências." };

  const now = new Date();
  const horizon = new Date(now.getFullYear(), now.getMonth() + 1, 0); // fim do mês atual

  let created = 0;
  try {
    const recurrences = await prisma.recurringEntry.findMany({
      where: { deletedAt: null, active: true },
    });

    for (const r of recurrences) {
      const occ = recurrenceOccurrences(r.startDate, horizon, r.frequency, r.dayOfMonth, r.endDate);
      let last: { month: number; year: number } | null = null;

      for (const d of occ) {
        const comp = competenceOf(d);
        const exists = await prisma.financialEntry.findFirst({
          where: {
            recurringEntryId: r.id,
            competenceMonth: comp.month,
            competenceYear: comp.year,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (exists) {
          last = comp;
          continue;
        }
        await prisma.financialEntry.create({
          data: {
            description: r.description,
            type: r.type,
            value: r.value,
            dueDate: d,
            competenceMonth: comp.month,
            competenceYear: comp.year,
            status: "PREVISTO",
            categoryId: r.categoryId,
            costCenterId: r.costCenterId,
            clientId: r.clientId,
            contractId: r.contractId,
            supplierId: r.supplierId,
            recurring: true,
            recurringEntryId: r.id,
            createdById: user.id,
          },
        });
        created++;
        last = comp;
      }

      if (last) {
        await prisma.recurringEntry.update({
          where: { id: r.id },
          data: { lastGeneratedMonth: last.month, lastGeneratedYear: last.year },
        });
      }
    }

    await writeAudit({
      userId: user.id,
      action: "generate-recurrences",
      entity: "RecurringEntry",
      after: { created },
      origin: "financeiro/contratos",
    });
  } catch {
    return { error: "Não foi possível gerar as recorrências." };
  }

  revalidatePath("/dashboard/financeiro/contratos");
  revalidatePath("/dashboard/financeiro/lancamentos");
  revalidatePath("/dashboard/financeiro");
  return { ok: true };
}
