import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAccessModule, type NavModule } from "@/lib/rbac";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: import("@prisma/client").Role;
};

/** Retorna o usuário logado ou null (sem redirecionar). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
  };
}

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
