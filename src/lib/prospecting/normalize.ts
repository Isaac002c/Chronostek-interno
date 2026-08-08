import { isIP } from "node:net";

export function normalizeDigits(value?: string | null): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits || null;
}

export function normalizeCnpj(value?: string | null): string | null {
  const digits = normalizeDigits(value);
  return digits?.length === 14 ? digits : null;
}

export function normalizePhone(value?: string | null): string | null {
  const digits = normalizeDigits(value);
  if (!digits) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return withCountry.length >= 12 && withCountry.length <= 13 ? withCountry : null;
}

export function normalizeEmail(value?: string | null): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function normalizeDomain(value?: string | null): string | null {
  if (!value) return null;
  try {
    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const hostname = new URL(candidate).hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    return hostname && !isIP(hostname) ? hostname : null;
  } catch {
    return null;
  }
}

export function normalizeCompanyName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(ltda|me|eireli|sa|s a|servicos?|comercio)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeSocial(value?: string | null): string | null {
  if (!value) return null;
  return value.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") || null;
}
