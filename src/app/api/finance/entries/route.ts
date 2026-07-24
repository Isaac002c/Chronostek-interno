import { NextRequest, NextResponse } from "next/server";
import { FinancialStatus, FinancialType, PaymentMethod, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeFinanceApi, apiError, pagination } from "@/lib/finance-api";
import { isCompetenceClosed } from "@/lib/closing";
import { writeAudit } from "@/lib/audit";
import { maybeRequestExpenseApproval } from "@/lib/approvals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  description: z.string().trim().min(1),
  type: z.nativeEnum(FinancialType),
  value: z.number().nonnegative(),
  paidValue: z.number().nonnegative().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  paymentDate: z.coerce.date().nullable().optional(),
  competenceMonth: z.number().int().min(1).max(12),
  competenceYear: z.number().int().min(2000).max(2100),
  status: z.nativeEnum(FinancialStatus).default("PENDENTE"),
  costCenterId: z.string().min(1),
  categoryId: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  contractId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  bankAccountId: z.string().nullable().optional(),
  paymentMethodConfigId: z.string().nullable().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await authorizeFinanceApi("VIEW");
  if ("response" in auth) return auth.response;
  const { page, pageSize, skip } = pagination(request.nextUrl.searchParams);
  const type = request.nextUrl.searchParams.get("type");
  const status = request.nextUrl.searchParams.get("status");
  const year = Number(request.nextUrl.searchParams.get("year")) || undefined;
  const month = Number(request.nextUrl.searchParams.get("month")) || undefined;
  const q = request.nextUrl.searchParams.get("q");
  const where: Prisma.FinancialEntryWhereInput = {
    deletedAt: null,
    ...(type && type in FinancialType ? { type: type as FinancialType } : {}),
    ...(status && status in FinancialStatus
      ? { status: status as FinancialStatus }
      : {}),
    ...(year ? { competenceYear: year } : {}),
    ...(month ? { competenceMonth: month } : {}),
    ...(q ? { description: { contains: q, mode: "insensitive" } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.financialEntry.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ competenceYear: "desc" }, { competenceMonth: "desc" }, { createdAt: "desc" }],
      include: {
        category: { select: { id: true, code: true, name: true } },
        costCenter: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.financialEntry.count({ where }),
  ]);
  return NextResponse.json(
    { data: items, pagination: { page, pageSize, total } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const auth = await authorizeFinanceApi("CREATE_ENTRY");
  if ("response" in auth) return auth.response;
  try {
    const data = createSchema.parse(await request.json());
    if (await isCompetenceClosed(data.competenceMonth, data.competenceYear)) {
      throw new Error("A competência está fechada.");
    }
    const entry = await prisma.financialEntry.create({
      data: {
        ...data,
        paidValue: data.paidValue ?? null,
        dueDate: data.dueDate ?? null,
        paymentDate: data.paymentDate ?? null,
        categoryId: data.categoryId ?? null,
        clientId: data.clientId ?? null,
        contractId: data.contractId ?? null,
        projectId: data.projectId ?? null,
        supplierId: data.supplierId ?? null,
        productId: data.productId ?? null,
        bankAccountId: data.bankAccountId ?? null,
        paymentMethodConfigId: data.paymentMethodConfigId ?? null,
        paymentMethod: data.paymentMethod ?? null,
        notes: data.notes ?? null,
        createdById: auth.user.id,
        responsibleId: auth.user.id,
      },
    });
    await maybeRequestExpenseApproval({
      entryId: entry.id,
      type: entry.type,
      value: entry.value,
      requestedById: auth.user.id,
    });
    await writeAudit({
      userId: auth.user.id,
      action: "create",
      entity: "FinancialEntry",
      entityId: entry.id,
      after: data,
      origin: "api/finance/entries",
    });
    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (error) {
    return apiError(error, "Não foi possível criar o lançamento.");
  }
}
