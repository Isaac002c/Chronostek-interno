import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { prisma } from "./lib/prisma";
import {
  buildLoginThrottleBuckets,
  clearLoginFailures,
  loginBlockedUntil,
  recordLoginFailure,
} from "./lib/auth-throttle";
import { writeAudit } from "./lib/audit";

// Mantém o custo de bcrypt equivalente quando o e-mail não existe.
const DUMMY_PASSWORD_HASH =
  "$2a$12$jAQfstZctexrirXl/gEmpO3.PkxQ.5crNdPDl/aIz594BkIqpQCFm";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();
        const { password } = parsed.data;
        const throttleBuckets = buildLoginThrottleBuckets(email, request);
        if (await loginBlockedUntil(throttleBuckets)) return null;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        const validPassword = await bcrypt.compare(
          password,
          user?.passwordHash ?? DUMMY_PASSWORD_HASH,
        );
        const validUser =
          user != null && user.deletedAt == null && user.status === "ATIVO";
        if (!validPassword || !validUser) {
          const failure = await recordLoginFailure(throttleBuckets);
          if (failure.newlyBlocked) {
            await writeAudit({
              userId: validUser ? user.id : null,
              action: "login_blocked",
              entity: "User",
              entityId: validUser ? user.id : null,
              origin: "auth",
            });
          }
          return null;
        }

        await clearLoginFailures(throttleBuckets);
        await writeAudit({
          userId: user.id,
          action: "login_success",
          entity: "User",
          entityId: user.id,
          origin: "auth",
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});
