"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, CostCenterType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/rbac";
import {
  zodFieldErrors,
  str,
  optStr,
  optInt,
  optNum,
  optBool,
  optEnum,
  type ActionState,
} from "@/lib/actions";

async function requireAdmin(): Promise<{ ok: true } | { error: string }> {
  const u = await getCurrentUser();
  if (!u) return { error: "Sessão expirada." };
  if (!isAdmin(u.role)) return { error: "Apenas administradores." };
  return { ok: true };
}

const schema = z.object({
  code: z.number().int().positive("Código inválido."),
  name: z.string().min(1, "Informe o nome."),
  description: z.string().nullable(),
  type: z.nativeEnum(CostCenterType),
  responsibleUserId: z.string().nullable(),
  parentCostCenterId: z.string().nullable(),
  active: z.boolean(),
  monthlyBudgetDefault: z.number().nonnegative().nullable(),
  annualBudgetDefault: z.number().nonnegative().nullable(),
});

function parse(fd: FormData) {
  return {
    code: optInt(fd, "code") ?? 0,
    name: str(fd, "name"),
    description: optStr(fd, "description"),
    type: (optEnum(fd, "type") ?? "OUTRO") as CostCenterType,
    responsibleUserId: optStr(fd, "responsibleUserId"),
    parentCostCenterId: optStr(fd, "parentCostCenterId"),
    active: fd.has("active") ? optBool(fd, "active") : true,
    monthlyBudgetDefault: optNum(fd, "monthlyBudgetDefault"),
    annualBudgetDefault: optNum(fd, "annualBudgetDefault"),
  };
}

export async function createCostCenter(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const parsed = schema.safeParse(parse(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.costCenter.create({ data: parsed.data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { fieldErrors: { code: ["Já existe um centro de custo com este código."] } };
    }
    return { error: "Não foi possível salvar o centro de custo." };
  }

  revalidatePath("/dashboard/configuracoes/centros-custo");
  redirect("/dashboard/configuracoes/centros-custo");
}

export async function updateCostCenter(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  const parsed = schema.safeParse(parse(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  if (parsed.data.parentCostCenterId === id) {
    return { fieldErrors: { parentCostCenterId: ["Um centro não pode ser pai de si mesmo."] } };
  }

  try {
    await prisma.costCenter.update({ where: { id }, data: parsed.data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { fieldErrors: { code: ["Já existe um centro de custo com este código."] } };
    }
    return { error: "Não foi possível atualizar o centro de custo." };
  }

  revalidatePath("/dashboard/configuracoes/centros-custo");
  redirect("/dashboard/configuracoes/centros-custo");
}

export async function toggleCostCenterActive(id: string): Promise<ActionState> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;

  try {
    const cc = await prisma.costCenter.findUnique({ where: { id }, select: { active: true } });
    if (!cc) return { error: "Centro de custo não encontrado." };
    await prisma.costCenter.update({ where: { id }, data: { active: !cc.active } });
  } catch {
    return { error: "Não foi possível alterar o status." };
  }

  revalidatePath("/dashboard/configuracoes/centros-custo");
  return { ok: true };
}
