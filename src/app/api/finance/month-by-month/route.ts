import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canFinance } from "@/lib/finance-permissions";
import { getMonthByMonth, type AccountingRegime } from "@/lib/finance-monthly";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canFinance(user.role, "VIEW")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const year = Number(request.nextUrl.searchParams.get("year")) || new Date().getFullYear();
  if (year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Ano inválido." }, { status: 400 });
  }
  const regime: AccountingRegime =
    request.nextUrl.searchParams.get("regime") === "CAIXA" ? "CAIXA" : "COMPETENCIA";
  const costCenterId = request.nextUrl.searchParams.get("costCenterId");
  const result = await getMonthByMonth({ year, regime, costCenterId });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
