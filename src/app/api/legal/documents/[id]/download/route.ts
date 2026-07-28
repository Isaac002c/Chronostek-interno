import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { authorizeLegalApi } from "@/lib/legal-api";
import { canAccessDocument } from "@/lib/legal-permissions";
import {
  isInlinePreviewAllowed,
  readDocumentFile,
} from "@/lib/document-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeLegalApi("DOWNLOAD_DOCUMENT");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: { id, tenantId: "default", deletedAt: null },
    select: {
      id: true,
      fileName: true,
      originalName: true,
      fileUrl: true,
      mimeType: true,
      privacy: true,
      uploadedById: true,
      responsibleId: true,
      versions: {
        where: { status: "ATUAL" },
        orderBy: { version: "desc" },
        take: 1,
        select: { fileUrl: true, mimeType: true, originalName: true },
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
  const current = document.versions[0];
  if (!current) {
    return NextResponse.json(
      {
        error: {
          code: "FILE_UNAVAILABLE",
          message: "O registro legado não possui arquivo armazenado na VPS.",
        },
      },
      { status: 409 },
    );
  }
  try {
    const bytes = await readDocumentFile(current.fileUrl);
    const preview =
      request.nextUrl.searchParams.get("preview") === "1" &&
      isInlinePreviewAllowed(current.mimeType);
    const disposition = preview ? "inline" : "attachment";
    const encodedName = encodeURIComponent(
      document.fileName || current.originalName,
    );
    await writeAudit({
      userId: auth.user.id,
      action: preview ? "preview" : "download",
      entity: "Document",
      entityId: document.id,
      origin: "api/legal/documents/download",
    });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": current.mimeType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "FILE_UNAVAILABLE",
          message: "Arquivo indisponível no armazenamento.",
        },
      },
      { status: 404 },
    );
  }
}
