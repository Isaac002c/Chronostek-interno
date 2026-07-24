import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Usa apenas a configuração edge-safe (sem Prisma/bcrypt). A lógica de
// proteção fica no callback `authorized` de auth.config.ts.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // Protege tudo, exceto health, rotas internas/estáticas e a API de auth.
    // O health não deve inicializar Auth.js nem emitir cookies.
    "/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp)$).*)",
  ],
};
