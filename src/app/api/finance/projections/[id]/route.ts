import { NextRequest, NextResponse } from "next/server";
import { ProjectionStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeFinanceApi, apiError } from "@/lib/finance-api";
import {
  duplicateProjection,
  setProjectionStatus,
} from "@/lib/finance-projections";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("status"),
    status: z.nativeEnum(ProjectionStatus),
    reason: z.string().nullable().optional(),
  }),
  z.object({
    operation: z.literal("duplicate"),
    name: z.string().trim().min(1),
    year: z.number().int().min(2000).max(2100).optional(),
  }),
]);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeFinanceApi("VIEW");
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const projection = await prisma.financialProjection.findUnique({
    where: { id },
    include: {
      responsible: { select: { id: true, name: true } },
      lines: {
        orderBy: { order: "asc" },
        include: {
          values: {
            orderBy: { month: "asc" },
            include: {
              history: { orderBy: { createdAt: "desc" }, take: 20 },
            },
          },
        },
      },
    },
  });
  if (!projection) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Projeção não encontrada." } },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { data: projection },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());
    if (body.operation === "duplicate") {
      const auth = await authorizeFinanceApi("EDIT_PROJECTION");
      if ("response" in auth) return auth.response;
      const copy = await duplicateProjection(id, auth.user.id, {
        name: body.name,
        year: body.year,
      });
      return NextResponse.json({ data: copy }, { status: 201 });
    }
    const auth = await authorizeFinanceApi("PUBLISH_PROJECTION");
    if ("response" in auth) return auth.response;
    const projection = await setProjectionStatus(
      id,
      body.status,
      auth.user.id,
      body.reason,
    );
    return NextResponse.json({ data: projection });
  } catch (error) {
    return apiError(error, "Não foi possível alterar a projeção.");
  }
}
