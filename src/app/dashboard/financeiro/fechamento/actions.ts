"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { CLOSING_CHECKLIST } from "@/lib/closing";
import {
  requireFinancePermission,
  str,
  optStr,
  optInt,
  type ActionState,
} from "@/lib/actions";

export async function closeMonth(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("CLOSE_PERIOD");
  if ("error" in auth)
    return { error: "Você não tem permissão para fechar o mês." };
  const { user } = auth;

  const month = optInt(fd, "month");
  const year = optInt(fd, "year");
  if (!month || !year) return { error: "Mês/ano inválidos." };

  const checklist: Record<string, boolean> = {};
  for (const item of CLOSING_CHECKLIST) checklist[item.key] = fd.get(item.key) === "on";
  const notes = optStr(fd, "notes");

  try {
    const saved = await prisma.monthlyClosing.upsert({
      where: { year_month: { year, month } },
      update: {
        status: "FECHADO",
        checklist,
        notes,
        closedById: user.id,
        closedAt: new Date(),
      },
      create: {
        year,
        month,
        status: "FECHADO",
        checklist,
        notes,
        closedById: user.id,
        closedAt: new Date(),
      },
    });
    await writeAudit({
      userId: user.id,
      action: "close",
      entity: "MonthlyClosing",
      entityId: saved.id,
      after: { month, year, checklist },
      origin: "financeiro/fechamento",
    });
  } catch {
    return { error: "Não foi possível fechar o mês." };
  }

  revalidatePath("/dashboard/financeiro/fechamento");
  return { ok: true };
}

export async function reopenMonth(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("REOPEN_PERIOD");
  if ("error" in auth)
    return { error: "Apenas administradores/sócios podem reabrir um mês fechado." };
  const { user } = auth;

  const month = optInt(fd, "month");
  const year = optInt(fd, "year");
  const reason = str(fd, "reason");
  if (!month || !year) return { error: "Mês/ano inválidos." };
  if (!reason) return { error: "Informe a justificativa da reabertura." };

  try {
    const closing = await prisma.monthlyClosing.findUnique({
      where: { year_month: { year, month } },
    });
    if (!closing) return { error: "Fechamento não encontrado." };

    await prisma.monthlyClosing.update({
      where: { id: closing.id },
      data: {
        status: "REABERTO",
        reopenedById: user.id,
        reopenedAt: new Date(),
        reopenReason: reason,
      },
    });
    await writeAudit({
      userId: user.id,
      action: "reopen",
      entity: "MonthlyClosing",
      entityId: closing.id,
      before: { status: closing.status },
      reason,
      origin: "financeiro/fechamento",
    });
  } catch {
    return { error: "Não foi possível reabrir o mês." };
  }

  revalidatePath("/dashboard/financeiro/fechamento");
  return { ok: true };
}
