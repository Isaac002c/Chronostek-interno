import { daysInMonth, SP_TZ, spDayEnd, spDayStart } from "@/lib/tz";

export type SanitizedAuditValue =
  | string
  | number
  | boolean
  | null
  | SanitizedAuditValue[]
  | { [key: string]: SanitizedAuditValue };

const REDACTED = "[redigido]";
const OMITTED = "[conteúdo omitido]";
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 30;
const MAX_STRING_LENGTH = 300;

const SENSITIVE_KEY =
  /password|passwd|senha|hash|secret|segredo|token|credential|credencial|authorization|cookie|session|otp|totp|private.?key|api.?key/i;

const AUDIT_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: SP_TZ,
});

/**
 * Prepara metadados de auditoria para exibição, inclusive registros legados.
 * React ainda faz o escape de HTML; esta função evita a exposição de segredos
 * e limita estruturas que poderiam tornar a página excessivamente pesada.
 */
export function sanitizeAuditMetadata(
  value: unknown,
  depth = 0,
): SanitizedAuditValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…`
      : value;
  }
  if (depth >= MAX_DEPTH) return OMITTED;

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeAuditMetadata(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`[mais ${value.length - MAX_ARRAY_ITEMS} item(ns) omitido(s)]`);
    }
    return items;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const output: Record<string, SanitizedAuditValue> = {};
    for (const [key, item] of entries.slice(0, MAX_OBJECT_KEYS)) {
      output[key] = SENSITIVE_KEY.test(key)
        ? REDACTED
        : sanitizeAuditMetadata(item, depth + 1);
    }
    if (entries.length > MAX_OBJECT_KEYS) {
      output._itensOmitidos = entries.length - MAX_OBJECT_KEYS;
    }
    return output;
  }

  return String(value);
}

export function formatAuditMetadata(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(sanitizeAuditMetadata(value), null, 2);
}

export function formatAuditTimestamp(value: Date): string {
  return AUDIT_TIMESTAMP_FORMATTER.format(value);
}

export function parseAuditDate(
  value: string,
  boundary: "start" | "end",
): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null;
  }

  return boundary === "start"
    ? spDayStart(year, month, day)
    : spDayEnd(year, month, day);
}

const ACTION_LABELS: Record<string, string> = {
  create: "Criação",
  update: "Atualização",
  delete: "Exclusão",
  pay: "Pagamento",
  close: "Fechamento",
  reopen: "Reabertura",
  "generate-recurrences": "Geração de recorrências",
  login_success: "Login bem-sucedido",
  login_blocked: "Login bloqueado",
};

const ENTITY_LABELS: Record<string, string> = {
  User: "Usuário",
  Goal: "Meta",
  FinancialEntry: "Lançamento financeiro",
  MonthlyClosing: "Fechamento mensal",
  OrganizationSettings: "Dados da empresa",
  RecurringEntry: "Recorrência financeira",
};

export function auditActionLabel(action: string): string {
  return (
    ACTION_LABELS[action] ??
    action.replaceAll("_", " ").replaceAll("-", " ")
  );
}

export function auditEntityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? entity;
}
