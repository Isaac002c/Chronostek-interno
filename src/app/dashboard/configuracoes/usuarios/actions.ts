"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/rbac";
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
  try {
    await prisma.user.create({
      data: { ...rest, passwordHash: await bcrypt.hash(password, 12) },
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
  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { role: true, status: true },
  });
  if (!existing) return { error: "Usuário não encontrado." };
  if (
    existing.role === "SUPER_ADMIN" &&
    existing.status === "ATIVO" &&
    (rest.role !== "SUPER_ADMIN" || rest.status !== "ATIVO")
  ) {
    const otherSuperAdmins = await prisma.user.count({
      where: {
        id: { not: id },
        role: "SUPER_ADMIN",
        status: "ATIVO",
        deletedAt: null,
      },
    });
    if (otherSuperAdmins === 0)
      return { error: "Mantenha ao menos um superadministrador ativo." };
  }
  const data: Prisma.UserUpdateInput = { ...rest };
  if (password && password.length >= 12) {
    data.passwordHash = await bcrypt.hash(password, 12);
  }

  try {
    await prisma.user.update({ where: { id }, data });
  } catch (e) {
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
    const existing = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { role: true, status: true },
    });
    if (!existing) return { error: "Usuário não encontrado." };
    if (existing.role === "SUPER_ADMIN" && existing.status === "ATIVO") {
      const otherSuperAdmins = await prisma.user.count({
        where: {
          id: { not: id },
          role: "SUPER_ADMIN",
          status: "ATIVO",
          deletedAt: null,
        },
      });
      if (otherSuperAdmins === 0)
        return { error: "Mantenha ao menos um superadministrador ativo." };
    }
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INATIVO" },
    });
  } catch {
    return { error: "Não foi possível excluir o usuário." };
  }

  revalidatePath("/dashboard/configuracoes/usuarios");
  return { ok: true };
}
