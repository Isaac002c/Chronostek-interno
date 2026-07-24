import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeFinanceApi, apiError } from "@/lib/finance-api";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  amount: z.number().positive(),
  date: z.coerce.date().optional(),
  reason: z.string().nullable().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeFinanceApi("SETTLE_ENTRY");
  if ("response" in auth) return auth.response;
  try {
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const before = await prisma.financialEntry.findFirst({
      where: { id, deletedAt: null },
    });
    if (!before) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Lançamento não encontrado." } },
        { status: 404 },
      );
    }
    if (before.status === "CANCELADO") throw new Error("Lançamento cancelado.");
    const paidValue =
      Math.round(((before.paidValue ?? 0) + body.amount + Number.EPSILON) * 100) /
      100;
    if (paidValue > before.value) throw new Error("A baixa supera o valor em aberto.");
    const entry = await prisma.financialEntry.update({
      where: { id },
      data: {
        paidValue,
        paymentDate: body.date ?? new Date(),
        status: paidValue === before.value ? "PAGO" : "PARCIAL",
        approvedById: auth.user.id,
      },
    });
    await writeAudit({
      userId: auth.user.id,
      action: before.type === "RECEITA" ? "receive-partial" : "pay-partial",
      entity: "FinancialEntry",
      entityId: id,
      before: { paidValue: before.paidValue, status: before.status },
      after: { paidValue: entry.paidValue, status: entry.status },
      reason: body.reason,
      origin: "api/finance/entries/settlements",
    });
    return NextResponse.json({ data: entry });
  } catch (error) {
    return apiError(error, "Não foi possível registrar a baixa.");
  }
}
