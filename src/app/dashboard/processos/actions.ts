"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/rbac";
import { seedProcesses } from "@/lib/processes";
import { writeAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/actions";

/** Sincroniza (idempotente) o catálogo dos 12 processos. Admin/sócio apenas. */
export async function syncProcesses(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) {
    return { error: "Apenas administradores/sócios podem sincronizar o catálogo de processos." };
  }
  try {
    const count = await seedProcesses();
    await writeAudit({
      userId: user.id,
      action: "sync",
      entity: "ProcessDefinition",
      after: { count },
      origin: "processos",
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Não foi possível sincronizar os processos.",
    };
  }
  revalidatePath("/dashboard/processos");
  return { ok: true };
}
