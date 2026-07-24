import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { prisma } from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/transaction";

export const LOGIN_THROTTLE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_THROTTLE_BLOCK_MS = 15 * 60 * 1000;
export const LOGIN_THROTTLE_RETENTION_MS = 24 * 60 * 60 * 1000;

export type LoginThrottleBucket = {
  key: string;
  limit: number;
};

type ThrottleKeyOptions = {
  secret?: string;
  trustProxy?: boolean;
};

function trustedClientIp(request: Request, trustProxy: boolean): string {
  if (!trustProxy) return "direct";
  const candidate =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "";
  return isIP(candidate) ? candidate : "unknown";
}

function hmac(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

/**
 * Gera dois baldes: par identidade+origem (limite baixo) e identidade global
 * (limite mais alto contra ataques distribuídos). Só HMACs chegam ao banco.
 */
export function buildLoginThrottleBuckets(
  email: string,
  request: Request,
  options: ThrottleKeyOptions = {},
): LoginThrottleBucket[] {
  const secret = options.secret ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET é obrigatória para o rate limiting.");

  const normalizedEmail = email.trim().toLowerCase();
  const trustProxy =
    options.trustProxy ?? process.env.AUTH_TRUST_PROXY === "true";
  const ip = trustedClientIp(request, trustProxy);

  return [
    {
      key: `pair:${hmac(`${normalizedEmail}\0${ip}`, secret)}`,
      limit: 5,
    },
    {
      key: `identity:${hmac(normalizedEmail, secret)}`,
      limit: 20,
    },
  ];
}

export async function loginBlockedUntil(
  buckets: readonly LoginThrottleBucket[],
  now = new Date(),
): Promise<Date | null> {
  const record = await prisma.loginThrottle.findFirst({
    where: {
      key: { in: buckets.map((bucket) => bucket.key) },
      blockedUntil: { gt: now },
    },
    orderBy: { blockedUntil: "desc" },
    select: { blockedUntil: true },
  });
  return record?.blockedUntil ?? null;
}

export async function recordLoginFailure(
  buckets: readonly LoginThrottleBucket[],
  now = new Date(),
): Promise<{ newlyBlocked: boolean; blockedUntil: Date | null }> {
  return runSerializableTransaction(async (tx) => {
    const windowCutoff = new Date(now.getTime() - LOGIN_THROTTLE_WINDOW_MS);
    const blockUntil = new Date(now.getTime() + LOGIN_THROTTLE_BLOCK_MS);
    let newlyBlocked = false;
    let latestBlock: Date | null = null;

    await tx.loginThrottle.deleteMany({
      where: {
        updatedAt: {
          lt: new Date(now.getTime() - LOGIN_THROTTLE_RETENTION_MS),
        },
      },
    });

    for (const bucket of buckets) {
      const existing = await tx.loginThrottle.findUnique({
        where: { key: bucket.key },
      });
      const windowExpired =
        !existing || existing.windowStartedAt < windowCutoff;
      const failureCount = windowExpired ? 1 : existing.failureCount + 1;
      const shouldBlock = failureCount >= bucket.limit;
      const wasBlocked =
        existing?.blockedUntil != null && existing.blockedUntil > now;
      const nextBlockedUntil = shouldBlock ? blockUntil : null;

      await tx.loginThrottle.upsert({
        where: { key: bucket.key },
        create: {
          key: bucket.key,
          failureCount,
          windowStartedAt: now,
          blockedUntil: nextBlockedUntil,
        },
        update: {
          failureCount,
          windowStartedAt: windowExpired
            ? now
            : existing?.windowStartedAt ?? now,
          blockedUntil: nextBlockedUntil,
        },
      });

      if (shouldBlock && !wasBlocked) newlyBlocked = true;
      if (
        nextBlockedUntil &&
        (!latestBlock || nextBlockedUntil > latestBlock)
      )
        latestBlock = nextBlockedUntil;
    }

    return { newlyBlocked, blockedUntil: latestBlock };
  });
}

export async function clearLoginFailures(
  buckets: readonly LoginThrottleBucket[],
): Promise<void> {
  await prisma.loginThrottle.deleteMany({
    where: { key: { in: buckets.map((bucket) => bucket.key) } },
  });
}
