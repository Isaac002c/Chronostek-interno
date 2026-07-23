"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWrite, str, type ActionState } from "@/lib/actions";
import { isAdmin } from "@/lib/rbac";
import { ensurePlanningYear } from "@/lib/planning";

/** Cria (idempotente) toda a estrutura de um ano: 4 trimestres → 12 meses → semanas reais. */
export async function createPlanningYear(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite("METAS");
  if ("error" in auth) return auth;
  if (!isAdmin(auth.user.role))
    return { error: "Apenas administradores podem criar períodos anuais." };

  const year = Number(str(fd, "year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    return { fieldErrors: { year: ["Informe um ano entre 2000 e 2100."] } };

  try {
    await ensurePlanningYear(year, auth.user.id);
  } catch (e) {
    console.error("createPlanningYear falhou:", e);
    return { error: "Não foi possível criar o período anual." };
  }

  revalidatePath("/dashboard/metas/periodos");
  return { ok: true };
}

/** Exclui um ano de planejamento (cascateia trimestres/meses/semanas). Só admin. */
export async function deletePlanningYear(id: string): Promise<ActionState> {
  const auth = await requireWrite("METAS");
  if ("error" in auth) return auth;
  if (!isAdmin(auth.user.role))
    return { error: "Apenas administradores podem excluir um período anual." };

  try {
    // Metas/tarefas ligadas às semanas/meses ficam com planningPeriodId nulo (SetNull),
    // preservando as metas em si. Só a estrutura de calendário é removida.
    await prisma.planningPeriod.delete({ where: { id } });
  } catch {
    return { error: "Não foi possível excluir o período." };
  }

  revalidatePath("/dashboard/metas/periodos");
  return { ok: true };
}
