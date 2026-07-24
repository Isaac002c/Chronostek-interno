"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/rbac";
import { runSerializableTransaction } from "@/lib/transaction";
import {
  assertActiveSuperAdminInvariant,
  LastActiveSuperAdminError,
} from "@/lib/user-security";
import {
  zodFieldErrors,
  str,
  optStr,
  optEnum,
  type ActionState,
} from "@/lib/actions";

async function requireAdmin(): Promise<
  { userId: string } | { error: string }
> {
  const u = await getCurrentUser();
  if (!u) return { error: "Sessão expirada." };
  if (!isAdmin(u.role)) return { error: "Apenas administradores." };
  return { userId: u.id };
}

class UserNotFoundError extends Error {}

const auditedUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  costCenterId: true,
} satisfies Prisma.UserSelect;

const baseSchema = {
  name: z.string().min(1, "Informe o nome."),
  email: z.string().email("E-mail inválido."),
  role: z.nativeEnum(Role),
  status: z.nativeEnum(UserStatus),
  costCenterId: z.string().nullable(),
};

const createSchema = z.object({
  ...baseSchema,
  password: z.string().min(12, "Mínimo de 12 caracteres."),
});

const updateSchema = z.object({
  ...baseSchema,
  password: z
    .string()
    .min(12, "Mínimo de 12 caracteres.")
    .optional()
    .or(z.literal("")),
});

function parseUser(fd: FormData) {
  return {
    name: str(fd, "name"),
    email: str(fd, "email").toLowerCase(),
    role: (optEnum(fd, "role") ?? "VIEWER") as Role,
    status: (optEnum(fd, "status") ?? "ATIVO") as UserStatus,
    costCenterId: optStr(fd, "costCenterId"),
    password: str(fd, "password"),
  };
}

export async function createUser(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const parsed = createSchema.safeParse(parseUser(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  const { password, ...rest } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { ...rest, passwordHash },
        select: auditedUserSelect,
      });
      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: "create",
          entity: "User",
          entityId: created.id,
          metadata: {
            before: null,
            after: created,
            passwordChanged: true,
            origin: "app",
          },
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { fieldErrors: { email: ["Já existe um usuário com este e-mail."] } };
    }
    return { error: "Não foi possível criar o usuário." };
  }

  revalidatePath("/dashboard/configuracoes/usuarios");
  redirect("/dashboard/configuracoes/usuarios");
}

export async function updateUser(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const parsed = updateSchema.safeParse(parseUser(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  const { password, ...rest } = parsed.data;
  const data: Prisma.UserUpdateInput = { ...rest };
  if (password && password.length >= 12) {
    data.passwordHash = await bcrypt.hash(password, 12);
  }

  try {
    await runSerializableTransaction(async (tx) => {
      const existing = await tx.user.findFirst({
        where: { id, deletedAt: null },
        select: auditedUserSelect,
      });
      if (!existing) throw new UserNotFoundError();

      await assertActiveSuperAdminInvariant(tx, id, existing, {
        role: rest.role,
        status: rest.status,
      });

      const updated = await tx.user.update({
        where: { id },
        data,
        select: auditedUserSelect,
      });
      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: "update",
          entity: "User",
          entityId: id,
          metadata: {
            before: existing,
            after: updated,
            passwordChanged: Boolean(password),
            origin: "app",
          },
        },
      });
    });
  } catch (e) {
    if (e instanceof UserNotFoundError)
      return { error: "Usuário não encontrado." };
    if (e instanceof LastActiveSuperAdminError) return { error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { fieldErrors: { email: ["Já existe um usuário com este e-mail."] } };
    }
    return { error: "Não foi possível atualizar o usuário." };
  }

  revalidatePath("/dashboard/configuracoes/usuarios");
  redirect("/dashboard/configuracoes/usuarios");
}

export async function deleteUser(id: string): Promise<ActionState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  if (auth.userId === id)
    return { error: "Você não pode excluir o próprio usuário." };

  try {
    await runSerializableTransaction(async (tx) => {
      const existing = await tx.user.findFirst({
        where: { id, deletedAt: null },
        select: auditedUserSelect,
      });
      if (!existing) throw new UserNotFoundError();

      await assertActiveSuperAdminInvariant(tx, id, existing, {
        role: existing.role,
        status: "INATIVO",
      });

      const deletedAt = new Date();
      const deleted = await tx.user.update({
        where: { id },
        data: { deletedAt, status: "INATIVO" },
        select: auditedUserSelect,
      });
      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: "delete",
          entity: "User",
          entityId: id,
          metadata: {
            before: existing,
            after: { ...deleted, deletedAt: deletedAt.toISOString() },
            origin: "app",
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof UserNotFoundError)
      return { error: "Usuário não encontrado." };
    if (error instanceof LastActiveSuperAdminError)
      return { error: error.message };
    return { error: "Não foi possível excluir o usuário." };
  }

  revalidatePath("/dashboard/configuracoes/usuarios");
  return { ok: true };
}
