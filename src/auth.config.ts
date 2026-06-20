import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Configuração "edge-safe": sem Prisma e sem bcrypt, para poder rodar no
// middleware (edge runtime). O provider Credentials é adicionado em auth.ts.
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
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
