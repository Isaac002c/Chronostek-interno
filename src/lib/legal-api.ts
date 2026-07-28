import { NextResponse } from "next/server";
import { getCurrentUser, type SessionUser } from "@/lib/session";
import {
  canLegal,
  type LegalPermission,
} from "@/lib/legal-permissions";

export async function authorizeLegalApi(
  permission: LegalPermission,
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Não autenticado." } },
        { status: 401 },
      ),
    };
  }
  if (!canLegal(user.role, permission)) {
    return {
      response: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Sem permissão." } },
        { status: 403 },
      ),
    };
  }
  return { user };
}

export function legalApiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const duplicate =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002";
  return NextResponse.json(
    {
      error: {
        code: duplicate ? "DUPLICATE" : "INVALID_REQUEST",
        message: duplicate ? "Registro duplicado." : message,
      },
    },
    { status: duplicate ? 409 : 400 },
  );
}

export function legalPagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize")) || 25),
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}
