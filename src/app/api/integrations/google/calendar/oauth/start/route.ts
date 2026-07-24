import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authorizeCalendarApi,
  calendarApiError,
} from "@/lib/calendar-api";
import {
  createGoogleOAuthValues,
  googleAuthorizationUrl,
} from "@/lib/calendar/google-client";
import {
  encryptCalendarSecret,
  hashOpaqueToken,
} from "@/lib/calendar/crypto";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await authorizeCalendarApi("CONNECT_GOOGLE");
  if ("response" in auth) return auth.response;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      redirectPath?: string;
    };
    const redirectPath =
      body.redirectPath?.startsWith("/dashboard/")
        ? body.redirectPath
        : "/dashboard/calendario";
    const values = createGoogleOAuthValues();
    const id = randomUUID();
    await prisma.$transaction([
      prisma.googleOAuthState.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      }),
      prisma.googleOAuthState.create({
        data: {
          id,
          stateHash: hashOpaqueToken(values.state),
          userId: auth.user.id,
          redirectPath,
          codeVerifierEncrypted: encryptCalendarSecret(
            values.codeVerifier,
            `oauth-verifier:${id}`,
          ),
          expiresAt: new Date(Date.now() + 10 * 60 * 1_000),
        },
      }),
    ]);
    return NextResponse.json({
      data: {
        authorizationUrl: googleAuthorizationUrl({
          state: values.state,
          codeChallenge: values.codeChallenge,
        }).toString(),
        expiresInSeconds: 600,
      },
    });
  } catch (error) {
    return calendarApiError(
      error,
      "Não foi possível iniciar a autorização Google.",
    );
  }
}
