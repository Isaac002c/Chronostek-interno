import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { authorizeLegalApi, legalApiError } from "@/lib/legal-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const typeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  requiresExpiration: z.boolean().default(false),
  requiresContract: z.boolean().default(false),
  requiresSignature: z.boolean().default(false),
  requiredFields: z.array(z.string().trim().min(1).max(60)).default([]),
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
  const types = await prisma.documentType.findMany({
    where: { tenantId: "default" },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      color: true,
      icon: true,
      requiresExpiration: true,
      requiresContract: true,
      requiresSignature: true,
      requiredFields: true,
      active: true,
      _count: { select: { documents: true } },
    },
  });
  return NextResponse.json(
    { data: types },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const auth = await authorizeLegalApi("MANAGE_DOCUMENT_TYPES");
  if ("response" in auth) return auth.response;
  try {
    const parsed = typeSchema.parse(await request.json());
    const slug = slugify(parsed.name);
    if (!slug) throw new Error("Nome de tipo inválido.");
    const type = await prisma.documentType.create({
      data: {
        tenantId: "default",
        name: parsed.name,
        slug,
        description: parsed.description,
        color: parsed.color,
        icon: parsed.icon,
        requiresExpiration: parsed.requiresExpiration,
        requiresContract: parsed.requiresContract,
        requiresSignature: parsed.requiresSignature,
        requiredFields: parsed.requiredFields,
        createdById: auth.user.id,
      },
    });
    await writeAudit({
      userId: auth.user.id,
      action: "create",
      entity: "DocumentType",
      entityId: type.id,
      after: parsed,
      origin: "api/legal/document-types",
    });
    return NextResponse.json(
      { data: type },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return legalApiError(error, "Não foi possível criar o tipo.");
  }
}
