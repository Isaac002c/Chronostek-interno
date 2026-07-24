import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeFinanceApi } from "@/lib/finance-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeFinanceApi("VIEW");
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const model = await prisma.dreModel.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { version: "desc" },
        include: {
          rows: {
            orderBy: { order: "asc" },
            include: { mappings: true },
          },
        },
      },
    },
  });
  if (!model) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Modelo não encontrado." } },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { data: model },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
