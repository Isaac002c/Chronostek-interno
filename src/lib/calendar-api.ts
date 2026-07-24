import { NextResponse } from "next/server";
import { getCurrentUser, type SessionUser } from "@/lib/session";
import {
  canCalendar,
  type CalendarPermission,
} from "@/lib/calendar-permissions";

export async function authorizeCalendarApi(
  permission: CalendarPermission,
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
  if (!canCalendar(user.role, permission)) {
    return {
      response: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Sem permissão." } },
        { status: 403 },
      ),
    };
  }
  return { user };
}

export function calendarApiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const prismaCode =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  const status =
    prismaCode === "P2002" ? 409 : prismaCode === "P2025" ? 404 : 400;
  return NextResponse.json(
    {
      error: {
        code:
          prismaCode === "P2002"
            ? "DUPLICATE"
            : prismaCode === "P2025"
              ? "NOT_FOUND"
              : "INVALID_REQUEST",
        message:
          prismaCode === "P2002"
            ? "Registro duplicado."
            : prismaCode === "P2025"
              ? "Evento não encontrado."
              : message,
      },
    },
    { status },
  );
}
