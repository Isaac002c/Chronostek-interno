import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  decryptCalendarSecret,
  encryptCalendarSecret,
  hashOpaqueToken,
} from "@/lib/calendar/crypto";
import {
  exchangeGoogleAuthorizationCode,
  googleUserInfo,
} from "@/lib/calendar/google-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function frontendRedirect(path: string, result: string) {
  const configured =
    process.env.PUBLIC_FRONTEND_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "https://chronoshub.chronostek.com.br";
  const origin = new URL(configured).origin;
  const safePath = path.startsWith("/dashboard/")
    ? path
    : "/dashboard/calendario";
  const url = new URL(safePath, origin);
  url.searchParams.set("google", result);
  return url;
}

export async function GET(request: NextRequest) {
  const stateValue = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  if (!stateValue) {
    return NextResponse.json(
      { error: { code: "INVALID_STATE", message: "Estado OAuth ausente." } },
      { status: 400 },
    );
  }
  const state = await prisma.googleOAuthState.findUnique({
    where: { stateHash: hashOpaqueToken(stateValue) },
  });
  if (!state || state.usedAt || state.expiresAt <= new Date()) {
    return NextResponse.json(
      { error: { code: "INVALID_STATE", message: "Estado OAuth inválido ou expirado." } },
      { status: 400 },
    );
  }
  const consumed = await prisma.googleOAuthState.updateMany({
    where: { id: state.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) {
    return NextResponse.json(
      { error: { code: "REPLAYED_STATE", message: "Estado OAuth já utilizado." } },
      { status: 400 },
    );
  }
  if (oauthError || !code) {
    return NextResponse.redirect(
      frontendRedirect(state.redirectPath, oauthError ? "cancelled" : "missing_code"),
    );
  }
  try {
    const user = await prisma.user.findFirst({
      where: { id: state.userId, status: "ATIVO", deletedAt: null },
      select: { id: true },
    });
    if (!user || !state.codeVerifierEncrypted) {
      throw new Error("Usuário ou verificador OAuth inválido.");
    }
    const codeVerifier = decryptCalendarSecret(
      state.codeVerifierEncrypted,
      `oauth-verifier:${state.id}`,
    );
    const tokens = await exchangeGoogleAuthorizationCode({ code, codeVerifier });
    const identity = await googleUserInfo(tokens.access_token);
    const existing = await prisma.calendarIntegration.findUnique({
      where: { userId: user.id },
    });
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptCalendarSecret(
          tokens.refresh_token,
          `refresh-token:${user.id}`,
        )
      : existing?.refreshTokenEncrypted;
    if (!refreshTokenEncrypted) {
      throw new Error(
        "O Google não retornou autorização offline. Reconecte a conta.",
      );
    }
    await prisma.calendarIntegration.upsert({
      where: { userId: user.id },
      update: {
        googleAccountId: identity.sub,
        googleEmail: identity.email.toLowerCase(),
        accessTokenEncrypted: encryptCalendarSecret(
          tokens.access_token,
          `access-token:${user.id}`,
        ),
        refreshTokenEncrypted,
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1_000),
        grantedScopes: tokens.scope?.split(" ").filter(Boolean) ?? [],
        status: "CONECTADO",
        disconnectedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        consecutiveFailures: 0,
      },
      create: {
        userId: user.id,
        googleAccountId: identity.sub,
        googleEmail: identity.email.toLowerCase(),
        accessTokenEncrypted: encryptCalendarSecret(
          tokens.access_token,
          `access-token:${user.id}`,
        ),
        refreshTokenEncrypted,
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1_000),
        grantedScopes: tokens.scope?.split(" ").filter(Boolean) ?? [],
        status: "CONECTADO",
      },
    });
    return NextResponse.redirect(
      frontendRedirect(state.redirectPath, "connected"),
    );
  } catch {
    return NextResponse.redirect(frontendRedirect(state.redirectPath, "error"));
  }
}
