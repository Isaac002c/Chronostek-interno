import type { Prisma, Role, UserStatus } from "@prisma/client";

export class LastActiveSuperAdminError extends Error {
  constructor() {
    super("Mantenha ao menos um superadministrador ativo.");
    this.name = "LastActiveSuperAdminError";
  }
}

type CurrentAdminState = {
  role: Role;
  status: UserStatus;
};

/**
 * Valida a invariante dentro da mesma transação serializável que fará a
 * alteração. Assim, duas remoções/rebaixamentos concorrentes não conseguem
 * deixar o sistema sem um SUPER_ADMIN ativo.
 */
export async function assertActiveSuperAdminInvariant(
  tx: Prisma.TransactionClient,
  userId: string,
  current: CurrentAdminState,
  next: CurrentAdminState,
): Promise<void> {
  const currentlyActiveSuperAdmin =
    current.role === "SUPER_ADMIN" && current.status === "ATIVO";
  const remainsActiveSuperAdmin =
    next.role === "SUPER_ADMIN" && next.status === "ATIVO";
  if (!currentlyActiveSuperAdmin || remainsActiveSuperAdmin) return;

  const otherActiveSuperAdmins = await tx.user.count({
    where: {
      id: { not: userId },
      role: "SUPER_ADMIN",
      status: "ATIVO",
      deletedAt: null,
    },
  });
  if (otherActiveSuperAdmins === 0) throw new LastActiveSuperAdminError();
}
