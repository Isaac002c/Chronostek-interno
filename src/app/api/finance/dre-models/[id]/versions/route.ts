import { NextRequest, NextResponse } from "next/server";
import { authorizeFinanceApi, apiError } from "@/lib/finance-api";
import { createDreVersion } from "@/lib/finance-dre-models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeFinanceApi("CONFIGURE_DRE");
  if ("response" in auth) return auth.response;
  try {
    const { id } = await context.params;
    const version = await createDreVersion(id, auth.user.id);
    return NextResponse.json({ data: version }, { status: 201 });
  } catch (error) {
    return apiError(error, "Não foi possível criar a versão.");
  }
}
