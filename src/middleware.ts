import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Usa apenas a configuração edge-safe (sem Prisma/bcrypt). A lógica de
// proteção fica no callback `authorized` de auth.config.ts.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // Protege tudo, exceto rotas internas/estáticas e a API de auth.
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp)$).*)",
  ],
};
