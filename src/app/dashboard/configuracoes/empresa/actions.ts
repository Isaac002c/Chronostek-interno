"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { str, optStr, zodFieldErrors, type ActionState } from "@/lib/actions";

const schema = z.object({
  brandName: z.string().min(1, "Informe a marca exibida."),
  legalName: z.string().nullable(),
  tradeName: z.string().nullable(),
  cnpj: z.string().nullable(),
  email: z.string().email("E-mail inválido.").nullable().or(z.literal(null)),
  phone: z.string().nullable(),
  address: z.string().nullable(),
});

export async function saveOrgSettings(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role))
    return { error: "Você não tem permissão para editar os dados da empresa." };

  const emailRaw = optStr(fd, "email");
  const parsed = schema.safeParse({
    brandName: str(fd, "brandName"),
    legalName: optStr(fd, "legalName"),
    tradeName: optStr(fd, "tradeName"),
    cnpj: optStr(fd, "cnpj"),
    email: emailRaw,
    phone: optStr(fd, "phone"),
    address: optStr(fd, "address"),
  });
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    const existing = await prisma.organizationSettings.findFirst();
    const data = { ...parsed.data, updatedById: user.id };
    const saved = existing
      ? await prisma.organizationSettings.update({ where: { id: existing.id }, data })
      : await prisma.organizationSettings.create({ data });

    await writeAudit({
      userId: user.id,
      action: existing ? "update" : "create",
      entity: "OrganizationSettings",
      entityId: saved.id,
      before: existing,
      after: saved,
      origin: "configuracoes/empresa",
    });
  } catch {
    return { error: "Não foi possível salvar os dados da empresa." };
  }

  revalidatePath("/dashboard/configuracoes/empresa");
  return { ok: true };
}
