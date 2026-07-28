import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeLegalApi, legalApiError } from "@/lib/legal-api";
import { canAccessDocument } from "@/lib/legal-permissions";
import { createDocumentVersion } from "@/lib/document-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeLegalApi("VIEW_HISTORY");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: { id, tenantId: "default", deletedAt: null },
    select: {
      privacy: true,
      uploadedById: true,
      responsibleId: true,
      versions: {
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          originalName: true,
          mimeType: true,
          size: true,
          note: true,
          reason: true,
          status: true,
          createdAt: true,
          uploadedBy: { select: { id: true, name: true } },
        },
      },
    },
  });
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
  return NextResponse.json(
    { data: document.versions },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeLegalApi("CREATE_DOCUMENT_VERSION");
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const document = await prisma.document.findFirst({
      where: { id, tenantId: "default", deletedAt: null },
      select: { privacy: true, uploadedById: true, responsibleId: true },
    });
    if (!document) throw new Error("Documento não encontrado.");
    if (!canAccessDocument(auth.user.role, auth.user.id, document)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Sem permissão." } },
        { status: 403 },
      );
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Selecione um arquivo.");
    const note =
      typeof form.get("note") === "string"
        ? String(form.get("note")).trim() || null
        : null;
    const reason =
      typeof form.get("reason") === "string"
        ? String(form.get("reason")).trim() || null
        : null;
    const updated = await createDocumentVersion({
      documentId: id,
      file,
      userId: auth.user.id,
      note,
      reason,
    });
    return NextResponse.json(
      { data: { id: updated.id, currentVersion: updated.currentVersion } },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return legalApiError(error, "Não foi possível criar a versão.");
  }
}
