import { NextRequest, NextResponse } from "next/server";
import { authorizeFinanceApi, apiError } from "@/lib/finance-api";
import { getConfiguredDre } from "@/lib/finance-dre-models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await authorizeFinanceApi("VIEW");
  if ("response" in auth) return auth.response;
  const month = Number(request.nextUrl.searchParams.get("month"));
  const year = Number(request.nextUrl.searchParams.get("year"));
  if (month < 1 || month > 12 || year < 2000 || year > 2100) {
    return NextResponse.json(
      { error: { code: "INVALID_PERIOD", message: "Período inválido." } },
      { status: 400 },
    );
  }
  try {
    const report = await getConfiguredDre({
      month,
      year,
      modelId: request.nextUrl.searchParams.get("modelId"),
      costCenterId: request.nextUrl.searchParams.get("costCenterId"),
    });
    if (!report) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Nenhum modelo publicado para o período." } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { data: report },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error, "Não foi possível calcular a DRE.");
  }
}
