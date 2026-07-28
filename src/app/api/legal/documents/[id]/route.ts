import { NextRequest, NextResponse } from "next/server";
import {
  DocumentPrivacy,
  DocumentStatus,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { authorizeLegalApi, legalApiError } from "@/lib/legal-api";
import {
  canAccessDocument,
  canLegal,
} from "@/lib/legal-permissions";
import {
  documentInclude,
  syncDocumentExpirationArtifacts,
} from "@/lib/document-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchSchema = z.object({
  displayName: z.string().trim().min(1).max(180).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  documentTypeId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  status: z.nativeEnum(DocumentStatus).optional(),
  privacy: z.nativeEnum(DocumentPrivacy).optional(),
  documentDate: z.coerce.date().nullable().optional(),
  validFrom: z.coerce.date().nullable().optional(),
  expirationDate: z.coerce.date().nullable().optional(),
  responsibleId: z.string().nullable().optional(),
});

async function findDocument(id: string) {
  return prisma.document.findFirst({
    where: { id, tenantId: "default", deletedAt: null },
    include: documentInclude(),
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeLegalApi("VIEW_DOCUMENTS");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const document = await findDocument(id);
  if (!document) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Documento não encontrado." } },
      { status: 404 },
    );
  }
  if (!canAccessDocument(auth.user.role, auth.user.id, document)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Sem permissão." } },
      { status: 403 },
    );
  }
  const safeDocument = {
    ...document,
    fileUrl: undefined,
    sha256: undefined,
    versions: document.versions.map((version) => ({
      ...version,
      fileUrl: undefined,
      sha256: undefined,
    })),
  };
  return NextResponse.json(
    { data: safeDocument },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeLegalApi("EDIT_DOCUMENT");
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const before = await prisma.document.findFirst({
      where: { id, tenantId: "default", deletedAt: null },
    });
    if (!before) throw new Error("Documento não encontrado.");
    if (!canAccessDocument(auth.user.role, auth.user.id, before)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Sem permissão." } },
        { status: 403 },
      );
    }
    const parsed = patchSchema.parse(await request.json());
    if (
      parsed.privacy === "CONFIDENCIAL" &&
      !canLegal(auth.user.role, "VIEW_CONFIDENTIAL_DOCUMENT")
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Sem permissão." } },
        { status: 403 },
      );
    }
    if ("documentTypeId" in parsed) {
      if (!parsed.documentTypeId) {
        throw new Error("Todo documento deve possuir um tipo.");
      }
      const type = await prisma.documentType.findFirst({
        where: {
          id: parsed.documentTypeId,
          tenantId: "default",
          active: true,
        },
      });
      if (!type) throw new Error("Tipo documental inválido.");
      const resultingExpiration =
        "expirationDate" in parsed
          ? parsed.expirationDate
          : before.expirationDate;
      if (type.requiresExpiration && !resultingExpiration) {
        throw new Error("Este tipo exige uma data de vencimento.");
      }
      if (type.requiresContract) {
        const contractLink = await prisma.documentLink.count({
          where: {
            documentId: id,
            entityType: "CONTRACT",
          },
        });
        if (!contractLink) {
          throw new Error("Este tipo exige vínculo com contrato.");
        }
      }
    }
    if (parsed.categoryId) {
      const category = await prisma.documentCategory.count({
        where: {
          id: parsed.categoryId,
          tenantId: "default",
          active: true,
        },
      });
      if (!category) throw new Error("Categoria documental inválida.");
    }
    if (parsed.responsibleId) {
      const responsible = await prisma.user.count({
        where: {
          id: parsed.responsibleId,
          status: "ATIVO",
          deletedAt: null,
        },
      });
      if (!responsible) throw new Error("Responsável inválido.");
    }
    const data: Prisma.DocumentUpdateInput = {
      ...(parsed.displayName ? { fileName: parsed.displayName } : {}),
      ...("description" in parsed
        ? { description: parsed.description }
        : {}),
      ...("documentTypeId" in parsed
        ? {
            documentType: parsed.documentTypeId
              ? { connect: { id: parsed.documentTypeId } }
              : { disconnect: true },
          }
        : {}),
      ...("categoryId" in parsed
        ? {
            category: parsed.categoryId
              ? { connect: { id: parsed.categoryId } }
              : { disconnect: true },
          }
        : {}),
      ...(parsed.status ? { status: parsed.status } : {}),
      ...(parsed.privacy ? { privacy: parsed.privacy } : {}),
      ...("documentDate" in parsed
        ? { documentDate: parsed.documentDate }
        : {}),
      ...("validFrom" in parsed ? { validFrom: parsed.validFrom } : {}),
      ...("expirationDate" in parsed
        ? { expirationDate: parsed.expirationDate }
        : {}),
      ...("responsibleId" in parsed
        ? {
            responsible: parsed.responsibleId
              ? { connect: { id: parsed.responsibleId } }
              : { disconnect: true },
          }
        : {}),
      updatedBy: { connect: { id: auth.user.id } },
      ...(parsed.status === "ARQUIVADO"
        ? { archivedAt: new Date() }
        : parsed.status
          ? { archivedAt: null }
          : {}),
    };
    const updated = await prisma.document.update({
      where: { id },
      data,
    });
    await syncDocumentExpirationArtifacts(id);
    await writeAudit({
      userId: auth.user.id,
      action: "update",
      entity: "Document",
      entityId: id,
      before: {
        fileName: before.fileName,
        documentTypeId: before.documentTypeId,
        categoryId: before.categoryId,
        status: before.status,
        privacy: before.privacy,
        expirationDate: before.expirationDate,
      },
      after: parsed,
      origin: "api/legal/documents",
    });
    return NextResponse.json(
      { data: { id: updated.id, displayName: updated.fileName } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return legalApiError(error, "Não foi possível atualizar o documento.");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeLegalApi("DELETE_DOCUMENT");
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const before = await prisma.document.findFirst({
      where: { id, tenantId: "default", deletedAt: null },
    });
    if (!before) throw new Error("Documento não encontrado.");
    await prisma.$transaction([
      prisma.document.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: "ARQUIVADO",
          archivedAt: new Date(),
          updatedById: auth.user.id,
        },
      }),
      prisma.calendarEvent.updateMany({
        where: {
          tenantId: "default",
          sourceEntityType: "DOCUMENT",
          sourceEntityId: id,
          deletedAt: null,
        },
        data: { deletedAt: new Date(), syncPending: true },
      }),
    ]);
    await writeAudit({
      userId: auth.user.id,
      action: "soft_delete",
      entity: "Document",
      entityId: id,
      before: { fileName: before.fileName, status: before.status },
      origin: "api/legal/documents",
    });
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return legalApiError(error, "Não foi possível excluir o documento.");
  }
}
