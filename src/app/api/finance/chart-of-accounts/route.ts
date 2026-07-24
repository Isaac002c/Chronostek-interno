import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeFinanceApi } from "@/lib/finance-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await authorizeFinanceApi("VIEW");
  if ("response" in auth) return auth.response;
  const items = await prisma.financialCategory.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { order: "asc" }, { code: "asc" }],
  });
  return NextResponse.json({ data: items });
}
