import { NextRequest, NextResponse } from "next/server";
import { BankAccountType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeFinanceApi, apiError, pagination } from "@/lib/finance-api";
import { canFinance } from "@/lib/finance-permissions";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  bank: z.string().nullable().optional(),
  agency: z.string().nullable().optional(),
  number: z.string().nullable().optional(),
  type: z.nativeEnum(BankAccountType).default("CORRENTE"),
  initialBalance: z.number().finite().default(0),
  initialBalanceDate: z.coerce.date().nullable().optional(),
  responsibleId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  active: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const auth = await authorizeFinanceApi("VIEW");
  if ("response" in auth) return auth.response;
  const { page, pageSize, skip } = pagination(request.nextUrl.searchParams);
  const where = { tenantId: "default", deletedAt: null };
  const [items, total] = await Promise.all([
    prisma.bankAccount.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { name: "asc" },
    }),
    prisma.bankAccount.count({ where }),
  ]);
  const details = canFinance(auth.user.role, "VIEW_BANK_DETAILS");
  return NextResponse.json({
    data: items.map((item) => ({
      ...item,
      agency: details ? item.agency : item.agency ? "***" : null,
      number: details ? item.number : item.number ? "***" : null,
    })),
    pagination: { page, pageSize, total },
  });
}

export async function POST(request: NextRequest) {
  const auth = await authorizeFinanceApi("MANAGE_REGISTRIES");
  if ("response" in auth) return auth.response;
  try {
    const body = schema.parse(await request.json());
    const { id, ...data } = body;
    const before = id ? await prisma.bankAccount.findUnique({ where: { id } }) : null;
    const account = id
      ? await prisma.bankAccount.update({ where: { id }, data })
      : await prisma.bankAccount.create({ data });
    await writeAudit({
      userId: auth.user.id,
      action: id ? "update" : "create",
      entity: "BankAccount",
      entityId: account.id,
      before: before ? { ...before, agency: "***", number: "***" } : null,
      after: { ...data, agency: data.agency ? "***" : null, number: data.number ? "***" : null },
      origin: "api/finance/bank-accounts",
    });
    return NextResponse.json({ data: account }, { status: id ? 200 : 201 });
  } catch (error) {
    return apiError(error, "Não foi possível salvar a conta.");
  }
}
