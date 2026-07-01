import { z } from "zod";
import { getCurrentUser, type SessionUser } from "@/lib/session";
import { canWrite } from "@/lib/rbac";

export type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialActionState: ActionState = {};

/** Garante sessão + permissão de escrita. Retorna o usuário ou um erro. */
export async function requireWrite(): Promise<
  { user: SessionUser } | { error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };
  if (!canWrite(user.role))
    return { error: "Você não tem permissão para esta ação." };
  return { user };
}

export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

// ───────────────────────── Parsers de FormData ─────────────────────────

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(fd: FormData, key: string): string | null {
  const s = str(fd, key);
  return s === "" ? null : s;
}

export function optNum(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s === "") return null;
  // Se houver vírgula, é formato pt-BR ("1.234,56"): ponto = milhar, vírgula = decimal.
  // Sem vírgula, é o formato de <input type="number"> ("1234.56" ou "1234"): ponto = decimal.
  const n = s.includes(",")
    ? Number(s.replace(/\./g, "").replace(",", "."))
    : Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Aceita tanto "1234.56" (input number) quanto "1.234,56" (pt-BR). */
export function num(fd: FormData, key: string, fallback = 0): number {
  return optNum(fd, key) ?? fallback;
}

export function optInt(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s === "") return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export function optDate(fd: FormData, key: string): Date | null {
  const s = str(fd, key);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function optBool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

/** Converte "" em undefined para enums opcionais. */
export function optEnum(fd: FormData, key: string): string | undefined {
  const s = str(fd, key);
  return s === "" ? undefined : s;
}
