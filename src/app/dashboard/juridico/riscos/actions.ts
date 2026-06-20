"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LegalRiskType, LegalRiskStatus, RiskScale, RiskLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireWrite,
  zodFieldErrors,
  str,
  optStr,
  optEnum,
  type ActionState,
} from "@/lib/actions";

const SCALE: Record<string, number> = { BAIXO: 1, MEDIO: 2, ALTO: 3 };

function computeRiskLevel(probability: RiskScale, impact: RiskScale): RiskLevel {
  const score = SCALE[probability] * SCALE[impact];
  if (score <= 2) return "BAIXO";
  if (score <= 4) return "MEDIO";
  if (score <= 6) return "ALTO";
  return "CRITICO";
}

async function defaultLegalCostCenter(value: string | null): Promise<string | null> {
  if (value) return value;
  const cc = await prisma.costCenter.findUnique({ where: { code: 5000 }, select: { id: true } });
  return cc?.id ?? null;
}

const schema = z.object({
  title: z.string().min(1, "Informe o título do risco."),
  description: z.string().nullable(),
  type: z.nativeEnum(LegalRiskType),
  probability: z.nativeEnum(RiskScale),
  impact: z.nativeEnum(RiskScale),
  mitigationPlan: z.string().nullable(),
  status: z.nativeEnum(LegalRiskStatus),
  responsibleId: z.string().nullable(),
  costCenterId: z.string().nullable(),
});

function parse(fd: FormData) {
  return {
    title: str(fd, "title"),
    description: optStr(fd, "description"),
    type: (optEnum(fd, "type") ?? "CONTRATUAL") as LegalRiskType,
    probability: (optEnum(fd, "probability") ?? "MEDIO") as RiskScale,
    impact: (optEnum(fd, "impact") ?? "MEDIO") as RiskScale,
    mitigationPlan: optStr(fd, "mitigationPlan"),
    status: (optEnum(fd, "status") ?? "ABERTO") as LegalRiskStatus,
    responsibleId: optStr(fd, "responsibleId"),
    costCenterId: optStr(fd, "costCenterId"),
  };
}

export async function createLegalRisk(_p: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;
  const parsed = schema.safeParse(parse(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;
  try {
    await prisma.legalRisk.create({
      data: {
        ...d,
        costCenterId: await defaultLegalCostCenter(d.costCenterId),
        riskLevel: computeRiskLevel(d.probability, d.impact),
      },
    });
  } catch {
    return { error: "Não foi possível salvar o risco." };
  }
  revalidatePath("/dashboard/juridico/riscos");
  redirect("/dashboard/juridico/riscos");
}

export async function updateLegalRisk(id: string, _p: ActionState, fd: FormData): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;
  const parsed = schema.safeParse(parse(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  const d = parsed.data;
  try {
    await prisma.legalRisk.update({
      where: { id },
      data: { ...d, riskLevel: computeRiskLevel(d.probability, d.impact) },
    });
  } catch {
    return { error: "Não foi possível atualizar o risco." };
  }
  revalidatePath("/dashboard/juridico/riscos");
  redirect("/dashboard/juridico/riscos");
}

export async function deleteLegalRisk(id: string): Promise<ActionState> {
  const auth = await requireWrite();
  if ("error" in auth) return auth;
  try {
    await prisma.legalRisk.update({ where: { id }, data: { deletedAt: new Date() } });
  } catch {
    return { error: "Não foi possível excluir o risco." };
  }
  revalidatePath("/dashboard/juridico/riscos");
  return { ok: true };
}
