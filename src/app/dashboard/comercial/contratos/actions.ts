"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ContractStatus,
  ContractType,
  RecurringFrequency,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  requireFinancePermission,
  requireWrite,
  zodFieldErrors,
  str,
  optBool,
  optDate,
  optEnum,
  optInt,
  optNum,
  optStr,
  type ActionState,
} from "@/lib/actions";
import { createRecurringSeries } from "@/lib/finance-recurrence";
import { writeAudit } from "@/lib/audit";

const contractSchema = z.object({
  clientId: z.string().min(1, "Selecione o cliente."),
  title: z.string().min(1, "Informe o título do contrato."),
  type: z.nativeEnum(ContractType),
  totalValue: z.number().nonnegative().nullable(),
  monthlyValue: z.number().nonnegative().nullable(),
  startDate: z.date().nullable(),
  endDate: z.date().nullable(),
  status: z.nativeEnum(ContractStatus),
  costCenterId: z.string().nullable(),
  categoryId: z.string().nullable(),
  recurringEnabled: z.boolean(),
  recurringFrequency: z.nativeEnum(RecurringFrequency).nullable(),
  firstDueDate: z.date().nullable(),
  installmentCount: z.number().int().positive().max(600).nullable(),
  recurringDurationMonths: z.number().int().positive().max(600).nullable(),
  adjustmentRate: z.number().nonnegative().nullable(),
  renewalDate: z.date().nullable(),
  financialProductId: z.string().nullable(),
  paymentMethodConfigId: z.string().nullable(),
  financialResponsibleId: z.string().nullable(),
  notes: z.string().nullable(),
});

function parseContract(fd: FormData) {
  return {
    clientId: str(fd, "clientId"),
    title: str(fd, "title"),
    type: (optEnum(fd, "type") ?? "PROJETO_FECHADO") as ContractType,
    totalValue: optNum(fd, "totalValue"),
    monthlyValue: optNum(fd, "monthlyValue"),
    startDate: optDate(fd, "startDate"),
    endDate: optDate(fd, "endDate"),
    status: (optEnum(fd, "status") ?? "ATIVO") as ContractStatus,
    costCenterId: optStr(fd, "costCenterId"),
    categoryId: optStr(fd, "categoryId"),
    recurringEnabled: optBool(fd, "recurringEnabled"),
    recurringFrequency: (optEnum(fd, "recurringFrequency") ??
      null) as RecurringFrequency | null,
    firstDueDate: optDate(fd, "firstDueDate"),
    installmentCount: optInt(fd, "installmentCount"),
    recurringDurationMonths: optInt(fd, "recurringDurationMonths"),
    adjustmentRate: optNum(fd, "adjustmentRate"),
    renewalDate: optDate(fd, "renewalDate"),
    financialProductId: optStr(fd, "financialProductId"),
    paymentMethodConfigId: optStr(fd, "paymentMethodConfigId"),
    financialResponsibleId: optStr(fd, "financialResponsibleId"),
    notes: optStr(fd, "notes"),
  };
}

type ParsedContract = z.infer<typeof contractSchema>;

function monthlyCompetences(start: Date, end: Date) {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    end.getMonth() -
    start.getMonth() +
    1
  );
}

async function ensureContractRecurrence(
  contract: ParsedContract & { id: string },
  userId: string,
) {
  if (!contract.recurringEnabled || contract.status !== "ATIVO") return;
  if (!contract.monthlyValue || contract.monthlyValue <= 0) {
    throw new Error("Informe o valor mensal para ativar a cobrança recorrente.");
  }
  const firstDueDate = contract.firstDueDate ?? contract.startDate;
  if (!firstDueDate) {
    throw new Error("Informe o primeiro vencimento da cobrança.");
  }
  if (!contract.costCenterId) {
    throw new Error("Informe o centro de custo da cobrança.");
  }
  const totalOccurrences =
    contract.installmentCount ??
    (contract.endDate && firstDueDate <= contract.endDate
      ? monthlyCompetences(firstDueDate, contract.endDate)
      : null);
  if (
    !totalOccurrences &&
    !contract.recurringDurationMonths &&
    !contract.endDate
  ) {
    throw new Error(
      "Informe quantidade de mensalidades, duração ou fim do contrato.",
    );
  }
  await createRecurringSeries(
    {
      idempotencyKey: `contract:${contract.id}:billing:v1`,
      description: `Contrato · ${contract.title}`,
      type: "RECEITA",
      value: contract.monthlyValue,
      frequency: contract.recurringFrequency ?? "MENSAL",
      startDate: firstDueDate,
      dayOfMonth: firstDueDate.getDate(),
      totalOccurrences,
      durationMonths: contract.recurringDurationMonths,
      endDate: contract.endDate,
      competenceMonth: firstDueDate.getMonth() + 1,
      competenceYear: firstDueDate.getFullYear(),
      categoryId: contract.categoryId,
      costCenterId: contract.costCenterId,
      clientId: contract.clientId,
      contractId: contract.id,
      productId: contract.financialProductId,
      paymentMethodConfigId: contract.paymentMethodConfigId,
      responsibleId: contract.financialResponsibleId ?? userId,
      notes: contract.notes,
    },
    userId,
  );
}

function revalidateContracts() {
  revalidatePath("/dashboard/comercial/contratos");
  revalidatePath("/dashboard/financeiro/contratos");
  revalidatePath("/dashboard/financeiro/lancamentos");
  revalidatePath("/dashboard/financeiro/mes-a-mes");
  revalidatePath("/dashboard/financeiro/projecoes");
}

export async function createContract(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite("COMERCIAL");
  if ("error" in auth) return auth;
  const parsed = contractSchema.safeParse(parseContract(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  if (parsed.data.recurringEnabled) {
    const financeAuth = await requireFinancePermission("CREATE_RECURRENCE");
    if ("error" in financeAuth) return financeAuth;
  }

  let contractId: string | null = null;
  try {
    const contract = await prisma.contract.create({ data: parsed.data });
    contractId = contract.id;
    await ensureContractRecurrence(
      { ...parsed.data, id: contract.id },
      auth.user.id,
    );
    await writeAudit({
      userId: auth.user.id,
      action: "create",
      entity: "Contract",
      entityId: contract.id,
      after: parsed.data,
      origin: "comercial/contratos",
    });
  } catch (error) {
    if (contractId) {
      const generated = await prisma.recurringEntry.count({
        where: { contractId },
      });
      if (generated === 0) {
        await prisma.contract.delete({ where: { id: contractId } });
      }
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o contrato.",
    };
  }

  revalidateContracts();
  redirect("/dashboard/comercial/contratos");
}

export async function updateContract(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireWrite("COMERCIAL");
  if ("error" in auth) return auth;
  const parsed = contractSchema.safeParse(parseContract(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  if (parsed.data.recurringEnabled) {
    const financeAuth = await requireFinancePermission("CREATE_RECURRENCE");
    if ("error" in financeAuth) return financeAuth;
  }

  try {
    const before = await prisma.contract.findFirst({
      where: { id, deletedAt: null },
    });
    if (!before) return { error: "Contrato não encontrado." };
    const contract = await prisma.contract.update({
      where: { id },
      data: parsed.data,
    });
    await ensureContractRecurrence(
      { ...parsed.data, id: contract.id },
      auth.user.id,
    );
    await writeAudit({
      userId: auth.user.id,
      action: "update",
      entity: "Contract",
      entityId: contract.id,
      before,
      after: parsed.data,
      origin: "comercial/contratos",
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o contrato.",
    };
  }

  revalidateContracts();
  redirect("/dashboard/comercial/contratos");
}

export async function deleteContract(id: string): Promise<ActionState> {
  const auth = await requireWrite("COMERCIAL");
  if ("error" in auth) return auth;
  try {
    const activeSeries = await prisma.recurringEntry.count({
      where: { contractId: id, active: true, status: "ATIVA", deletedAt: null },
    });
    if (activeSeries > 0) {
      return {
        error:
          "Cancele a série de cobranças no Financeiro antes de excluir o contrato.",
      };
    }
    const before = await prisma.contract.findFirst({
      where: { id, deletedAt: null },
    });
    if (!before) return { error: "Contrato não encontrado." };
    await prisma.contract.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await writeAudit({
      userId: auth.user.id,
      action: "delete",
      entity: "Contract",
      entityId: id,
      before,
      origin: "comercial/contratos",
    });
  } catch {
    return { error: "Não foi possível excluir o contrato." };
  }
  revalidateContracts();
  return { ok: true };
}
