import { createHash, randomBytes } from "node:crypto";
import type { CalendarIntegration } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  decryptCalendarSecret,
  encryptCalendarSecret,
} from "@/lib/calendar/crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_USERINFO_URL =
  "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
] as const;

export class GoogleCalendarNotConfiguredError extends Error {
  constructor() {
    super("A integração Google Calendar ainda não foi configurada.");
    this.name = "GoogleCalendarNotConfiguredError";
  }
}

export class GoogleCalendarApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "GoogleCalendarApiError";
  }
}

export function googleCalendarConfiguration() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new GoogleCalendarNotConfiguredError();
  }
  return {
    clientId,
    clientSecret,
    redirectUri,
    webhookUrl: process.env.GOOGLE_CALENDAR_WEBHOOK_URL?.trim() || null,
  };
}

export function isGoogleCalendarConfigured() {
  try {
    googleCalendarConfiguration();
    return true;
  } catch {
    return false;
  }
}

export function createGoogleOAuthValues() {
  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(48).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { state, codeVerifier, codeChallenge };
}

export function googleAuthorizationUrl(params: {
  state: string;
  codeChallenge: string;
}) {
  const config = googleCalendarConfiguration();
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
  id_token?: string;
};

async function parseGoogleResponse<T>(response: Response): Promise<T> {
  if (response.ok) return (await response.json()) as T;
  let code = `HTTP_${response.status}`;
  let message = "O Google Calendar recusou a solicitação.";
  try {
    const payload = (await response.json()) as {
      error?: string | { code?: number; message?: string; status?: string };
      error_description?: string;
    };
    if (typeof payload.error === "string") {
      code = payload.error;
      message = payload.error_description || message;
    } else if (payload.error) {
      code = payload.error.status || String(payload.error.code || code);
      message = payload.error.message || message;
    }
  } catch {
    // Corpo inválido não é refletido para logs/respostas.
  }
  throw new GoogleCalendarApiError(message, response.status, code);
}

export async function exchangeGoogleAuthorizationCode(params: {
  code: string;
  codeVerifier: string;
}) {
  const config = googleCalendarConfiguration();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      code_verifier: params.codeVerifier,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  return parseGoogleResponse<GoogleTokenResponse>(response);
}

async function refreshGoogleAccessToken(integration: CalendarIntegration) {
  if (!integration.refreshTokenEncrypted) {
    throw new GoogleCalendarApiError(
      "A autorização do Google precisa ser refeita.",
      401,
      "MISSING_REFRESH_TOKEN",
    );
  }
  const config = googleCalendarConfiguration();
  const refreshToken = decryptCalendarSecret(
    integration.refreshTokenEncrypted,
    `refresh-token:${integration.userId}`,
  );
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const tokens = await parseGoogleResponse<GoogleTokenResponse>(response);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1_000);
  return prisma.calendarIntegration.update({
    where: { id: integration.id },
    data: {
      accessTokenEncrypted: encryptCalendarSecret(
        tokens.access_token,
        `access-token:${integration.userId}`,
      ),
      accessTokenExpiresAt: expiresAt,
      grantedScopes: tokens.scope?.split(" ").filter(Boolean) ?? undefined,
      status: "CONECTADO",
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });
}

async function integrationAccessToken(integration: CalendarIntegration) {
  let current = integration;
  const expiring =
    !current.accessTokenExpiresAt ||
    current.accessTokenExpiresAt.getTime() <= Date.now() + 60_000;
  if (!current.accessTokenEncrypted || expiring) {
    current = await refreshGoogleAccessToken(current);
  }
  if (!current.accessTokenEncrypted) {
    throw new GoogleCalendarApiError(
      "Token de acesso indisponível.",
      401,
      "MISSING_ACCESS_TOKEN",
    );
  }
  return {
    current,
    token: decryptCalendarSecret(
      current.accessTokenEncrypted,
      `access-token:${current.userId}`,
    ),
  };
}

export async function googleCalendarRequest<T>(
  integration: CalendarIntegration,
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; integration: CalendarIntegration }> {
  const { current, token } = await integrationAccessToken(integration);
  const response = await fetch(
    path.startsWith("https://") ? path : `${GOOGLE_CALENDAR_API}${path}`,
    {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );
  return { data: await parseGoogleResponse<T>(response), integration: current };
}

export async function googleUserInfo(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return parseGoogleResponse<{ sub: string; email: string }>(response);
}

export async function revokeGoogleToken(encryptedToken: string, userId: string) {
  const token = decryptCalendarSecret(
    encryptedToken,
    `refresh-token:${userId}`,
  );
  const response = await fetch(
    `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
    },
  );
  if (!response.ok && response.status !== 400) {
    throw new GoogleCalendarApiError(
      "Não foi possível revogar a autorização no Google.",
      response.status,
      `HTTP_${response.status}`,
    );
  }
}
