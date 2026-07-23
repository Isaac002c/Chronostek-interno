import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessModule, type NavModule } from "@/lib/rbac";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: import("@prisma/client").Role;
};

/**
 * Retorna o usuário ativo com papel atualizado ou null.
 *
 * O JWT identifica a sessão, mas o banco continua sendo a fonte de verdade:
 * desativação, exclusão ou troca de papel passam a valer na requisição
 * seguinte. `cache` evita repetir a consulta dentro da mesma renderização.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      deletedAt: null,
      status: "ATIVO",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
});

/** Garante autenticação; redireciona para /login se não houver sessão. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Garante acesso a um módulo; redireciona para /dashboard se não tiver. */
export async function requireModule(module: NavModule): Promise<SessionUser> {
  const user = await requireUser();
  if (!canAccessModule(user.role, module)) redirect("/dashboard");
  return user;
}
