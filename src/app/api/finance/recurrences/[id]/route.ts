import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeFinanceApi, apiError } from "@/lib/finance-api";
import {
  cancelRecurringOccurrences,
  updateRecurringOccurrences,
} from "@/lib/finance-recurrence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const scope = z.enum(["OCCURRENCE", "FUTURE", "SERIES"]);
const patchSchema = z.object({
  occurrenceNumber: z.number().int().positive(),
  scope,
  patch: z
    .object({
      description: z.string().trim().min(1).optional(),
      value: z.number().nonnegative().optional(),
      categoryId: z.string().nullable().optional(),
      costCenterId: z.string().nullable().optional(),
      clientId: z.string().nullable().optional(),
      contractId: z.string().nullable().optional(),
      supplierId: z.string().nullable().optional(),
      projectId: z.string().nullable().optional(),
      productId: z.string().nullable().optional(),
      bankAccountId: z.string().nullable().optional(),
      paymentMethodConfigId: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    })
    .strict(),
  confirmSettled: z.boolean().default(false),
  reason: z.string().nullable().optional(),
});
const cancelSchema = z.object({
  occurrenceNumber: z.number().int().positive(),
  scope,
  confirmSettled: z.boolean().default(false),
  reason: z.string().trim().min(1),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeFinanceApi("VIEW");
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const item = await prisma.recurringEntry.findFirst({
    where: { id, tenantId: "default", deletedAt: null },
    include: {
      generatedEntries: {
        where: { deletedAt: null },
        orderBy: { recurrenceSequence: "asc" },
      },
      history: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!item) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Série não encontrada." } },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { data: item },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeFinanceApi("EDIT_RECURRENCE");
  if ("response" in auth) return auth.response;
  try {
    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());
    const affected = await updateRecurringOccurrences({
      seriesId: id,
      ...body,
      reason: body.reason ?? null,
      userId: auth.user.id,
    });
    return NextResponse.json({ data: { affected } });
  } catch (error) {
    return apiError(error, "Não foi possível editar a série.");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeFinanceApi("CANCEL_RECURRENCE");
  if ("response" in auth) return auth.response;
  try {
    const { id } = await context.params;
    const body = cancelSchema.parse(await request.json());
    const affected = await cancelRecurringOccurrences({
      seriesId: id,
      ...body,
      userId: auth.user.id,
    });
    return NextResponse.json({ data: { affected } });
  } catch (error) {
    return apiError(error, "Não foi possível cancelar a série.");
  }
}
