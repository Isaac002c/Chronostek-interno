"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CampaignChannel, CampaignStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireWrite,
  zodFieldErrors,
  str,
  optStr,
  optNum,
  optInt,
  optDate,
  optEnum,
  type ActionState,
} from "@/lib/actions";

const campaignSchema = z.object({
  name: z.string().min(1, "Informe o nome da campanha."),
  channel: z.nativeEnum(CampaignChannel),
  objective: z.string().nullable(),
  budget: z.number().nonnegative().nullable(),
  actualSpend: z.number().nonnegative().nullable(),
  leadsGenerated: z.number().int().min(0),
  clientsGenerated: z.number().int().min(0),
  attributedRevenue: z.number().nonnegative().nullable(),
  startDate: z.date().nullable(),
  endDate: z.date().nullable(),
  status: z.nativeEnum(CampaignStatus),
  costCenterId: z.string().nullable(),
});

function parseCampaign(fd: FormData) {
  return {
    name: str(fd, "name"),
    channel: (optEnum(fd, "channel") ?? "OUTRO") as CampaignChannel,
    objective: optStr(fd, "objective"),
    budget: optNum(fd, "budget"),
    actualSpend: optNum(fd, "actualSpend"),
    leadsGenerated: optInt(fd, "leadsGenerated") ?? 0,
    clientsGenerated: optInt(fd, "clientsGenerated") ?? 0,
    attributedRevenue: optNum(fd, "attributedRevenue"),
    startDate: optDate(fd, "startDate"),
    endDate: optDate(fd, "endDate"),
    status: (optEnum(fd, "status") ?? "PLANEJADA") as CampaignStatus,
    costCenterId: optStr(fd, "costCenterId"),
  };
}

export async function createCampaign(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = campaignSchema.safeParse(parseCampaign(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.marketingCampaign.create({ data: parsed.data });
  } catch {
    return { error: "Não foi possível salvar a campanha." };
  }

  revalidatePath("/dashboard/marketing");
  redirect("/dashboard/marketing");
}

export async function updateCampaign(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  const parsed = campaignSchema.safeParse(parseCampaign(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    await prisma.marketingCampaign.update({ where: { id }, data: parsed.data });
  } catch {
    return { error: "Não foi possível atualizar a campanha." };
  }

  revalidatePath("/dashboard/marketing");
  redirect("/dashboard/marketing");
}

export async function deleteCampaign(id: string): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;

  try {
    await prisma.marketingCampaign.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } catch {
    return { error: "Não foi possível excluir a campanha." };
  }

  revalidatePath("/dashboard/marketing");
  return { ok: true };
}
