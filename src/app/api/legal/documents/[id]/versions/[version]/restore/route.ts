import { NextRequest, NextResponse } from "next/server";
import { authorizeLegalApi, legalApiError } from "@/lib/legal-api";
import { restoreDocumentVersion } from "@/lib/document-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; version: string }> },
) {
  const auth = await authorizeLegalApi("CREATE_DOCUMENT_VERSION");
  if ("response" in auth) return auth.response;
  try {
    const { id, version: rawVersion } = await params;
    const version = Number(rawVersion);
    if (!Number.isInteger(version) || version < 1) {
      throw new Error("Versão inválida.");
    }
    const document = await restoreDocumentVersion({
      documentId: id,
      version,
      userId: auth.user.id,
    });
    return NextResponse.json(
      { data: { id: document.id, currentVersion: document.currentVersion } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return legalApiError(error, "Não foi possível restaurar a versão.");
  }
}
