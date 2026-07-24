import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeFinanceApi, apiError, pagination } from "@/lib/finance-api";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  legalName: z.string().nullable().optional(),
  document: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  defaultCategoryId: z.string().nullable().optional(),
  defaultCostCenterId: z.string().nullable().optional(),
  responsibleId: z.string().nullable().optional(),
  bankDetailsMasked: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  active: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const auth = await authorizeFinanceApi("VIEW");
  if ("response" in auth) return auth.response;
  const { page, pageSize, skip } = pagination(request.nextUrl.searchParams);
  const where = { tenantId: "default", deletedAt: null };
  const [items, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { name: "asc" },
    }),
    prisma.supplier.count({ where }),
  ]);
  return NextResponse.json({ data: items, pagination: { page, pageSize, total } });
}

export async function POST(request: NextRequest) {
  const auth = await authorizeFinanceApi("MANAGE_REGISTRIES");
  if ("response" in auth) return auth.response;
  try {
    const body = schema.parse(await request.json());
    const { id, ...data } = body;
    const before = id ? await prisma.supplier.findUnique({ where: { id } }) : null;
    const supplier = id
      ? await prisma.supplier.update({ where: { id }, data })
      : await prisma.supplier.create({ data });
    await writeAudit({
      userId: auth.user.id,
      action: id ? "update" : "create",
      entity: "Supplier",
      entityId: supplier.id,
      before,
      after: { ...data, bankDetailsMasked: data.bankDetailsMasked ? "***" : null },
      origin: "api/finance/suppliers",
    });
    return NextResponse.json({ data: supplier }, { status: id ? 200 : 201 });
  } catch (error) {
    return apiError(error, "Não foi possível salvar o fornecedor.");
  }
}
