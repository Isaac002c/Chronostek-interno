import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { authorizeLegalApi, legalApiError } from "@/lib/legal-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
});

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  const auth = await authorizeLegalApi("VIEW_DOCUMENTS");
  if ("response" in auth) return auth.response;
  const categories = await prisma.documentCategory.findMany({
    where: { tenantId: "default", active: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(
    { data: categories },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const auth = await authorizeLegalApi("MANAGE_DOCUMENT_TYPES");
  if ("response" in auth) return auth.response;
  try {
    const parsed = categorySchema.parse(await request.json());
    const slug = slugify(parsed.name);
    if (!slug) throw new Error("Nome de categoria inválido.");
    const category = await prisma.documentCategory.create({
      data: {
        tenantId: "default",
        slug,
        ...parsed,
        createdById: auth.user.id,
      },
    });
    await writeAudit({
      userId: auth.user.id,
      action: "create",
      entity: "DocumentCategory",
      entityId: category.id,
      after: parsed,
      origin: "api/legal/document-categories",
    });
    return NextResponse.json(
      { data: category },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return legalApiError(error, "Não foi possível criar a categoria.");
  }
}
