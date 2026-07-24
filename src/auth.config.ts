import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

const cookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim();
const sharedCookies = cookieDomain
  ? {
      sessionToken: {
        name: "__Secure-authjs.session-token",
        options: {
          httpOnly: true,
          sameSite: "lax" as const,
          path: "/",
          secure: true,
          domain: cookieDomain,
        },
      },
      callbackUrl: {
        name: "__Secure-authjs.callback-url",
        options: {
          httpOnly: true,
          sameSite: "lax" as const,
          path: "/",
          secure: true,
          domain: cookieDomain,
        },
      },
      csrfToken: {
        name: "__Secure-authjs.csrf-token",
        options: {
          httpOnly: true,
          sameSite: "lax" as const,
          path: "/",
          secure: true,
          domain: cookieDomain,
        },
      },
    }
  : undefined;

// Configuração "edge-safe": sem Prisma e sem bcrypt, para poder rodar no
// middleware (edge runtime). O provider Credentials é adicionado em auth.ts.
export const authConfig = {
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  cookies: sharedCookies,
  logger: {
    error(error) {
      // Credenciais inválidas são um resultado esperado, já protegido pelo
      // rate limiter. Evita stack traces por tentativa sem ocultar falhas reais.
      if ((error as Error & { type?: string }).type === "CredentialsSignin")
        return;
      console.error("[auth]", error);
    },
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;
      const isOnDashboard = pathname.startsWith("/dashboard");
      const isOnLogin = pathname === "/login";

      if (isOnDashboard) {
        return isLoggedIn; // não logado -> redireciona para /login
      }
      if (isLoggedIn && isOnLogin) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: Role }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
