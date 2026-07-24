import { NextRequest, NextResponse } from "next/server";
import { FinancialProductType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeFinanceApi, apiError, pagination } from "@/lib/finance-api";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  id: z.string().optional(),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: z.nativeEnum(FinancialProductType).default("SERVICO"),
  notes: z.string().nullable().optional(),
  active: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const auth = await authorizeFinanceApi("VIEW");
  if ("response" in auth) return auth.response;
  const { page, pageSize, skip } = pagination(request.nextUrl.searchParams);
  const where = { tenantId: "default", deletedAt: null };
  const [items, total] = await Promise.all([
    prisma.financialProduct.findMany({ where, skip, take: pageSize, orderBy: { name: "asc" } }),
    prisma.financialProduct.count({ where }),
  ]);
  return NextResponse.json({ data: items, pagination: { page, pageSize, total } });
}

export async function POST(request: NextRequest) {
  const auth = await authorizeFinanceApi("MANAGE_REGISTRIES");
  if ("response" in auth) return auth.response;
  try {
    const body = schema.parse(await request.json());
    const { id, code: rawCode, ...rest } = body;
    const data = { ...rest, code: rawCode.toUpperCase().replace(/[^A-Z0-9_]/g, "_") };
    const before = id ? await prisma.financialProduct.findUnique({ where: { id } }) : null;
    const item = id
      ? await prisma.financialProduct.update({ where: { id }, data })
      : await prisma.financialProduct.create({ data: { ...data, createdById: auth.user.id } });
    await writeAudit({
      userId: auth.user.id,
      action: id ? "update" : "create",
      entity: "FinancialProduct",
      entityId: item.id,
      before,
      after: data,
      origin: "api/finance/products",
    });
    return NextResponse.json({ data: item }, { status: id ? 200 : 201 });
  } catch (error) {
    return apiError(error, "Não foi possível salvar o produto/serviço.");
  }
}
