import { NextRequest, NextResponse } from "next/server";
import {
  DocumentPrivacy,
  DocumentStatus,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  authorizeLegalApi,
  legalApiError,
  legalPagination,
} from "@/lib/legal-api";
import {
  canLegal,
  visibleDocumentWhere,
} from "@/lib/legal-permissions";
import {
  createDocument,
  DOCUMENT_ENTITY_TYPES,
  type DocumentEntityType,
} from "@/lib/document-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uploadSchema = z.object({
  displayName: z.string().trim().min(1).max(180),
  description: z.string().trim().max(4000).nullable(),
  documentTypeId: z.string().min(1),
  categoryId: z.string().nullable(),
  status: z.nativeEnum(DocumentStatus).default("ATIVO"),
  privacy: z.nativeEnum(DocumentPrivacy).default("INTERNO"),
  documentDate: z.coerce.date().nullable(),
  validFrom: z.coerce.date().nullable(),
  expirationDate: z.coerce.date().nullable(),
  responsibleId: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  links: z
    .array(
      z.object({
        entityType: z.enum(DOCUMENT_ENTITY_TYPES),
        entityId: z.string().min(1),
      }),
    )
    .min(1),
});

function nullable(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableDate(form: FormData, key: string) {
  const value = nullable(form, key);
  return value ? value : null;
}

function linksFromForm(form: FormData) {
  const mapping: Array<[DocumentEntityType, string]> = [
    ["CLIENT", "clientId"],
    ["CONTRACT", "contractId"],
    ["PROPOSAL", "proposalId"],
    ["PROJECT", "projectId"],
    ["SUPPLIER", "supplierId"],
    ["EVENT", "eventId"],
    ["USER", "userId"],
  ];
  return mapping.flatMap(([entityType, key]) => {
    const entityId = nullable(form, key);
    return entityId ? [{ entityType, entityId }] : [];
  });
}

export async function GET(request: NextRequest) {
  const auth = await authorizeLegalApi("VIEW_DOCUMENTS");
  if ("response" in auth) return auth.response;
  const { page, pageSize, skip } = legalPagination(
    request.nextUrl.searchParams,
  );
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const typeId = params.get("typeId");
  const categoryId = params.get("categoryId");
  const status = params.get("status");
  const clientId = params.get("clientId");
  const contractId = params.get("contractId");
  const tag = params.get("tag")?.trim();
  const where: Prisma.DocumentWhereInput = {
    ...visibleDocumentWhere(auth.user.role, auth.user.id),
    ...(q
      ? {
          OR: [
            { fileName: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { originalName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(typeId ? { documentTypeId: typeId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(status && status in DocumentStatus
      ? { status: status as DocumentStatus }
      : {}),
    ...(clientId
      ? { links: { some: { entityType: "CLIENT", entityId: clientId } } }
      : {}),
    ...(contractId
      ? { links: { some: { entityType: "CONTRACT", entityId: contractId } } }
      : {}),
    ...(tag
      ? {
          tags: {
            some: {
              tag: {
                normalizedName: {
                  contains: tag.toLowerCase(),
                  mode: "insensitive",
                },
              },
            },
          },
        }
      : {}),
  };
  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        originalName: true,
        mimeType: true,
        size: true,
        description: true,
        status: true,
        privacy: true,
        documentDate: true,
        expirationDate: true,
        currentVersion: true,
        createdAt: true,
        updatedAt: true,
        documentType: { select: { id: true, name: true, color: true } },
        category: { select: { id: true, name: true, color: true } },
        responsible: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, name: true } },
        links: true,
        tags: { include: { tag: true } },
        _count: { select: { versions: true } },
      },
    }),
    prisma.document.count({ where }),
  ]);
  return NextResponse.json(
    { data: documents, pagination: { page, pageSize, total } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const auth = await authorizeLegalApi("UPLOAD_DOCUMENT");
  if ("response" in auth) return auth.response;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Selecione um arquivo.");
    const tags = (nullable(form, "tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const parsed = uploadSchema.parse({
      displayName: nullable(form, "displayName"),
      description: nullable(form, "description"),
      documentTypeId: nullable(form, "documentTypeId"),
      categoryId: nullable(form, "categoryId"),
      status: nullable(form, "status") ?? "ATIVO",
      privacy: nullable(form, "privacy") ?? "INTERNO",
      documentDate: nullableDate(form, "documentDate"),
      validFrom: nullableDate(form, "validFrom"),
      expirationDate: nullableDate(form, "expirationDate"),
      responsibleId: nullable(form, "responsibleId"),
      tags,
      links: linksFromForm(form),
    });
    if (
      parsed.privacy === "CONFIDENCIAL" &&
      !canLegal(auth.user.role, "VIEW_CONFIDENTIAL_DOCUMENT")
    ) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Sem permissão." } },
        { status: 403 },
      );
    }
    const document = await createDocument({
      file,
      metadata: parsed,
      userId: auth.user.id,
    });
    return NextResponse.json(
      {
        data: {
          id: document.id,
          displayName: document.fileName,
          currentVersion: document.currentVersion,
        },
      },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return legalApiError(error, "Não foi possível enviar o documento.");
  }
}
