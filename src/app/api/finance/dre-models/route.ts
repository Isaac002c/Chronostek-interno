import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeFinanceApi, apiError, pagination } from "@/lib/finance-api";
import { createDefaultDreModel } from "@/lib/finance-dre-models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await authorizeFinanceApi("VIEW");
  if ("response" in auth) return auth.response;
  const { page, pageSize, skip } = pagination(request.nextUrl.searchParams);
  const [items, total] = await Promise.all([
    prisma.dreModel.findMany({
      where: { tenantId: "default", archivedAt: null },
      skip,
      take: pageSize,
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          include: { _count: { select: { rows: true } } },
        },
      },
    }),
    prisma.dreModel.count({
      where: { tenantId: "default", archivedAt: null },
    }),
  ]);
  return NextResponse.json(
    { data: items, pagination: { page, pageSize, total } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const auth = await authorizeFinanceApi("CONFIGURE_DRE");
  if ("response" in auth) return auth.response;
  try {
    const body = createSchema.parse(await request.json());
    const model = await createDefaultDreModel({
      ...body,
      userId: auth.user.id,
    });
    return NextResponse.json({ data: model }, { status: 201 });
  } catch (error) {
    return apiError(error, "Não foi possível criar o modelo.");
  }
}
