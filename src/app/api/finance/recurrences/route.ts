import { NextRequest, NextResponse } from "next/server";
import {
  FinancialType,
  PaymentMethod,
  RecurringFrequency,
  RecurringSeriesStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeFinanceApi, apiError, pagination } from "@/lib/finance-api";
import { createRecurringSeries } from "@/lib/finance-recurrence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).optional(),
    description: z.string().trim().min(1),
    type: z.nativeEnum(FinancialType),
    value: z.number().nonnegative(),
    frequency: z.nativeEnum(RecurringFrequency).default("MENSAL"),
    startDate: z.coerce.date(),
    dayOfMonth: z.number().int().min(1).max(31),
    totalOccurrences: z.number().int().positive().max(600).nullable().optional(),
    durationMonths: z.number().int().positive().max(600).nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    competenceMonth: z.number().int().min(1).max(12).nullable().optional(),
    competenceYear: z.number().int().min(2000).max(2100).nullable().optional(),
    categoryId: z.string().nullable().optional(),
    costCenterId: z.string().min(1),
    clientId: z.string().nullable().optional(),
    contractId: z.string().nullable().optional(),
    supplierId: z.string().nullable().optional(),
    projectId: z.string().nullable().optional(),
    productId: z.string().nullable().optional(),
    bankAccountId: z.string().nullable().optional(),
    paymentMethod: z.nativeEnum(PaymentMethod).nullable().optional(),
    paymentMethodConfigId: z.string().nullable().optional(),
    responsibleId: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .refine(
    (value) =>
      Boolean(value.totalOccurrences || value.durationMonths || value.endDate),
    "Informe quantidade, duração ou data final.",
  );

export async function GET(request: NextRequest) {
  const auth = await authorizeFinanceApi("VIEW");
  if ("response" in auth) return auth.response;
  const { page, pageSize, skip } = pagination(request.nextUrl.searchParams);
  const status = request.nextUrl.searchParams.get("status");
  const type = request.nextUrl.searchParams.get("type");
  const where = {
    tenantId: "default",
    deletedAt: null,
    ...(status && status in RecurringSeriesStatus
      ? { status: status as RecurringSeriesStatus }
      : {}),
    ...(type && type in FinancialType ? { type: type as FinancialType } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.recurringEntry.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { id: true, code: true, name: true } },
        costCenter: { select: { id: true, code: true, name: true } },
        _count: { select: { generatedEntries: true, history: true } },
      },
    }),
    prisma.recurringEntry.count({ where }),
  ]);
  return NextResponse.json(
    { data: items, pagination: { page, pageSize, total } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const auth = await authorizeFinanceApi("CREATE_RECURRENCE");
  if ("response" in auth) return auth.response;
  try {
    const body = createSchema.parse(await request.json());
    const idempotencyKey =
      body.idempotencyKey ?? request.headers.get("idempotency-key");
    if (!idempotencyKey || idempotencyKey.length < 8) {
      throw new Error("Envie uma chave idempotente com pelo menos 8 caracteres.");
    }
    const result = await createRecurringSeries(
      { ...body, idempotencyKey },
      auth.user.id,
    );
    return NextResponse.json(
      { data: result },
      { status: result.reused ? 200 : 201 },
    );
  } catch (error) {
    return apiError(error, "Não foi possível criar a recorrência.");
  }
}
