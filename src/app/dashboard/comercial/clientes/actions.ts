"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ClientStatus, LeadOrigin } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireWrite,
  zodFieldErrors,
  str,
  optStr,
  optInt,
  optEnum,
  type ActionState,
} from "@/lib/actions";

const clientSchema = z.object({
  name: z.string().min(1, "Informe a razão social / nome."),
  tradeName: z.string().nullable(),
  document: z.string().nullable(),
  email: z.string().email("E-mail inválido.").nullable(),
  phone: z.string().nullable(),
  internalResponsibleId: z.string().nullable(),
  status: z.nativeEnum(ClientStatus),
  origin: z.nativeEnum(LeadOrigin).nullable(),
  healthScore: z.number().int().min(0).max(100),
  notes: z.string().nullable(),
});

function parseClient(fd: FormData) {
  return {
    name: str(fd, "name"),
    tradeName: optStr(fd, "tradeName"),
    document: optStr(fd, "document"),
    email: optStr(fd, "email"),
    phone: optStr(fd, "phone"),
    internalResponsibleId: optStr(fd, "internalResponsibleId"),
    status: (optEnum(fd, "status") ?? "PROSPECT") as ClientStatus,
    origin: (optEnum(fd, "origin") ?? null) as LeadOrigin | null,
    healthScore: Math.min(100, Math.max(0, optInt(fd, "healthScore") ?? 50)),
    notes: optStr(fd, "notes"),
  };
}

export async function createClient(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = clientSchema.safeParse(parseClient(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  let id: string;
  try {
    const client = await prisma.client.create({ data: parsed.data });
    id = client.id;
  } catch {
    return { error: "Não foi possível salvar o cliente." };
  }

  revalidatePath("/dashboard/comercial/clientes");
  redirect(`/dashboard/comercial/clientes/${id}`);
}

export async function updateClient(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = clientSchema.safeParse(parseClient(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.client.update({ where: { id }, data: parsed.data });
  } catch {
    return { error: "Não foi possível atualizar o cliente." };
  }

  revalidatePath("/dashboard/comercial/clientes");
  revalidatePath(`/dashboard/comercial/clientes/${id}`);
  redirect(`/dashboard/comercial/clientes/${id}`);
}

export async function deleteClient(id: string): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  try {
    await prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } catch {
    return { error: "Não foi possível excluir o cliente." };
  }

  revalidatePath("/dashboard/comercial/clientes");
  return { ok: true };
}
