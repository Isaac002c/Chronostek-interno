import { NextRequest, NextResponse } from "next/server";
import { ProjectionScenarioType, ProjectionStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeFinanceApi, apiError, pagination } from "@/lib/finance-api";
import { createProjection } from "@/lib/finance-projections";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  year: z.number().int().min(2000).max(2100),
  periodStartMonth: z.number().int().min(1).max(12).default(1),
  periodEndMonth: z.number().int().min(1).max(12).default(12),
  scenarioType: z.nativeEnum(ProjectionScenarioType).default("PERSONALIZADO"),
  responsibleId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  seedKind: z
    .enum([
      "VAZIA",
      "AUTOMATICA",
      "ORCAMENTO",
      "REALIZADO_ANTERIOR",
      "CONTRATOS_ATIVOS",
      "OUTRA_PROJECAO",
    ])
    .default("VAZIA"),
  sourceProjectionId: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await authorizeFinanceApi("VIEW");
  if ("response" in auth) return auth.response;
  const { page, pageSize, skip } = pagination(request.nextUrl.searchParams);
  const year = Number(request.nextUrl.searchParams.get("year")) || undefined;
  const status = request.nextUrl.searchParams.get("status");
  const where = {
    tenantId: "default",
    ...(year ? { year } : {}),
    ...(status && status in ProjectionStatus
      ? { status: status as ProjectionStatus }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.financialProjection.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { updatedAt: "desc" },
      include: {
        responsible: { select: { id: true, name: true } },
        _count: { select: { lines: true, copies: true } },
      },
    }),
    prisma.financialProjection.count({ where }),
  ]);
  return NextResponse.json(
    { data: items, pagination: { page, pageSize, total } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const auth = await authorizeFinanceApi("EDIT_PROJECTION");
  if ("response" in auth) return auth.response;
  try {
    const body = createSchema.parse(await request.json());
    const projection = await createProjection(body, auth.user.id);
    return NextResponse.json({ data: projection }, { status: 201 });
  } catch (error) {
    return apiError(error, "Não foi possível criar a projeção.");
  }
}
