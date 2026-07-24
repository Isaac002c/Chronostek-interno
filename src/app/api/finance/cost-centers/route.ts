import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeFinanceApi } from "@/lib/finance-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await authorizeFinanceApi("VIEW");
  if ("response" in auth) return auth.response;
  const items = await prisma.costCenter.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
    include: { responsibleUser: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ data: items });
}
