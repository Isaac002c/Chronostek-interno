import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canFinance } from "@/lib/finance-permissions";
import { getMonthByMonth, type AccountingRegime } from "@/lib/finance-monthly";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = [
  "Mês",
  "Receita prevista",
  "Receita realizada",
  "Despesa prevista",
  "Despesa realizada",
  "Contas a receber",
  "Contas a pagar",
  "Vencidos",
  "Resultado previsto",
  "Resultado realizado",
  "Orçamento",
  "Desvio",
  "Saldo inicial",
  "Saldo final",
  "Receita recorrente",
  "Inadimplência",
];

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canFinance(user.role, "EXPORT")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const year = Number(request.nextUrl.searchParams.get("year")) || new Date().getFullYear();
  if (year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Ano inválido." }, { status: 400 });
  }
  const regime: AccountingRegime =
    request.nextUrl.searchParams.get("regime") === "CAIXA" ? "CAIXA" : "COMPETENCIA";
  const costCenterId = request.nextUrl.searchParams.get("costCenterId");
  const data = await getMonthByMonth({ year, regime, costCenterId });
  const lines = data.months.map((month) =>
    [
      month.month,
      month.expectedRevenue,
      month.realizedRevenue,
      month.expectedExpense,
      month.realizedExpense,
      month.receivable,
      month.payable,
      month.overdue,
      month.expectedResult,
      month.realizedResult,
      month.budget,
      month.budgetVariance,
      month.openingBalance,
      month.closingBalance,
      month.recurringRevenue,
      month.delinquency,
    ].join(";"),
  );
  const csv = `\uFEFF${HEADERS.join(";")}\r\n${lines.join("\r\n")}\r\n`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mes-a-mes-${year}-${regime.toLowerCase()}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
