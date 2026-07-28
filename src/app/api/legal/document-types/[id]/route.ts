import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { authorizeLegalApi, legalApiError } from "@/lib/legal-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  requiresExpiration: z.boolean().optional(),
  requiresContract: z.boolean().optional(),
  requiresSignature: z.boolean().optional(),
  requiredFields: z.array(z.string().trim().min(1).max(60)).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeLegalApi("MANAGE_DOCUMENT_TYPES");
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const before = await prisma.documentType.findFirst({
      where: { id, tenantId: "default" },
    });
    if (!before) throw new Error("Tipo não encontrado.");
    const parsed = patchSchema.parse(await request.json());
    const type = await prisma.documentType.update({
      where: { id },
      data: parsed,
    });
    await writeAudit({
      userId: auth.user.id,
      action: parsed.active === false ? "deactivate" : "update",
      entity: "DocumentType",
      entityId: id,
      before,
      after: parsed,
      origin: "api/legal/document-types",
    });
    return NextResponse.json(
      { data: type },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return legalApiError(error, "Não foi possível atualizar o tipo.");
  }
}
