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
  requireLegalPermission,
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
  contractNumber: z.string().nullable(),
  legalResponsibleId: z.string().nullable(),
  commercialResponsibleId: z.string().nullable(),
  signedAt: z.date().nullable(),
  autoRenewal: z.boolean(),
  renewalNoticeDays: z.number().int().min(0).max(3650).nullable(),
  billingMethod: z.string().nullable(),
  relevantClauses: z.string().nullable(),
  signatories: z.string().nullable(),
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
    contractNumber: optStr(fd, "contractNumber"),
    legalResponsibleId: optStr(fd, "legalResponsibleId"),
    commercialResponsibleId: optStr(fd, "commercialResponsibleId"),
    signedAt: optDate(fd, "signedAt"),
    autoRenewal: optBool(fd, "autoRenewal"),
    renewalNoticeDays: optInt(fd, "renewalNoticeDays"),
    billingMethod: optStr(fd, "billingMethod"),
    relevantClauses: optStr(fd, "relevantClauses"),
    signatories: optStr(fd, "signatories"),
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
  revalidatePath("/dashboard/juridico");
  revalidatePath("/dashboard/juridico/contratos");
  revalidatePath("/dashboard/juridico/renovacoes");
  revalidatePath("/dashboard/juridico/prazos");
  revalidatePath("/dashboard/financeiro/contratos");
  revalidatePath("/dashboard/financeiro/lancamentos");
  revalidatePath("/dashboard/financeiro/mes-a-mes");
  revalidatePath("/dashboard/financeiro/projecoes");
}

async function syncContractCalendar(contract: {
  id: string;
  title: string;
  endDate: Date | null;
  renewalDate: Date | null;
  legalResponsibleId: string | null;
  clientId: string;
}) {
  const sources = [
    {
      kind: "expiration",
      date: contract.endDate,
      title: `Vencimento de contrato: ${contract.title}`,
      category: "Jurídico · Contrato",
    },
    {
      kind: "renewal",
      date: contract.renewalDate,
      title: `Renovação de contrato: ${contract.title}`,
      category: "Jurídico · Renovação",
    },
  ] as const;
  for (const source of sources) {
    const sourceKey = `contract:${contract.id}:${source.kind}`;
    if (!source.date) {
      await prisma.calendarEvent.updateMany({
        where: { tenantId: "default", sourceKey, deletedAt: null },
        data: { deletedAt: new Date(), syncPending: true },
      });
      continue;
    }
    await prisma.calendarEvent.upsert({
      where: {
        tenantId_sourceKey: { tenantId: "default", sourceKey },
      },
      create: {
        tenantId: "default",
        title: source.title,
        description:
          "Prazo automático. Abra o contrato de origem no Jurídico para alterar.",
        type: "PRAZO",
        status: "AGENDADO",
        priority: "ALTA",
        privacy: "INTERNO",
        origin: "AUTOMACAO",
        startAt: source.date,
        endAt: new Date(source.date.getTime() + 60 * 60 * 1000),
        allDay: true,
        timezone: "America/Sao_Paulo",
        category: source.category,
        color: "#7c3aed",
        department: "JURIDICO",
        clientId: contract.clientId,
        responsibleId: contract.legalResponsibleId,
        sourceEntityType: "CONTRACT",
        sourceEntityId: contract.id,
        sourceKey,
        syncPending: true,
      },
      update: {
        title: source.title,
        startAt: source.date,
        endAt: new Date(source.date.getTime() + 60 * 60 * 1000),
        clientId: contract.clientId,
        responsibleId: contract.legalResponsibleId,
        deletedAt: null,
        syncPending: true,
      },
    });
  }
}

export async function createContract(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireLegalPermission("CREATE_CONTRACT");
  if ("error" in auth) return auth;
  const parsed = contractSchema.safeParse(parseContract(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  if (parsed.data.recurringEnabled) {
    const financeAuth = await requireFinancePermission("CREATE_RECURRENCE");
    if ("error" in financeAuth) return financeAuth;
  }

  let contractId: string | null = null;
  try {
    const contract = await prisma.contract.create({
      data: {
        ...parsed.data,
        createdById: auth.user.id,
        updatedById: auth.user.id,
      },
    });
    contractId = contract.id;
    await ensureContractRecurrence(
      { ...parsed.data, id: contract.id },
      auth.user.id,
    );
    await syncContractCalendar(contract);
    await writeAudit({
      userId: auth.user.id,
      action: "create",
      entity: "Contract",
      entityId: contract.id,
      after: parsed.data,
      origin: "juridico/contratos",
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
  redirect("/dashboard/juridico/contratos");
}

export async function updateContract(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireLegalPermission("EDIT_CONTRACT");
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
      data: { ...parsed.data, updatedById: auth.user.id },
    });
    await ensureContractRecurrence(
      { ...parsed.data, id: contract.id },
      auth.user.id,
    );
    await syncContractCalendar(contract);
    await writeAudit({
      userId: auth.user.id,
      action: "update",
      entity: "Contract",
      entityId: contract.id,
      before,
      after: parsed.data,
      origin: "juridico/contratos",
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
  redirect("/dashboard/juridico/contratos");
}

export async function deleteContract(id: string): Promise<ActionState> {
  const auth = await requireLegalPermission("ARCHIVE_CONTRACT");
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
      data: {
        status: "ARQUIVADO",
        archivedAt: new Date(),
        updatedById: auth.user.id,
      },
    });
    await writeAudit({
      userId: auth.user.id,
      action: "archive",
      entity: "Contract",
      entityId: id,
      before,
      origin: "juridico/contratos",
    });
  } catch {
    return { error: "Não foi possível excluir o contrato." };
  }
  revalidateContracts();
  return { ok: true };
}

export async function terminateContract(id: string): Promise<ActionState> {
  const auth = await requireLegalPermission("TERMINATE_CONTRACT");
  if ("error" in auth) return auth;
  try {
    const before = await prisma.contract.findFirst({
      where: { id, deletedAt: null },
    });
    if (!before) return { error: "Contrato não encontrado." };
    const updated = await prisma.contract.update({
      where: { id },
      data: {
        status: "RESCINDIDO",
        endDate: new Date(),
        autoRenewal: false,
        updatedById: auth.user.id,
      },
    });
    await syncContractCalendar(updated);
    await writeAudit({
      userId: auth.user.id,
      action: "terminate",
      entity: "Contract",
      entityId: id,
      before,
      after: { status: updated.status, endDate: updated.endDate },
      origin: "juridico/contratos",
    });
    revalidateContracts();
    return { ok: true };
  } catch {
    return { error: "Não foi possível rescindir o contrato." };
  }
}

export async function duplicateContract(id: string): Promise<ActionState> {
  const auth = await requireLegalPermission("CREATE_CONTRACT");
  if ("error" in auth) return auth;
  try {
    const source = await prisma.contract.findFirst({
      where: { id, deletedAt: null },
    });
    if (!source) return { error: "Contrato não encontrado." };
    const duplicate = await prisma.contract.create({
      data: {
        clientId: source.clientId,
        title: `${source.title} · Cópia`,
        type: source.type,
        totalValue: source.totalValue,
        monthlyValue: source.monthlyValue,
        startDate: source.startDate,
        endDate: source.endDate,
        contractNumber: null,
        status: "RASCUNHO",
        costCenterId: source.costCenterId,
        categoryId: source.categoryId,
        recurringEnabled: false,
        recurringFrequency: source.recurringFrequency,
        firstDueDate: source.firstDueDate,
        installmentCount: source.installmentCount,
        recurringDurationMonths: source.recurringDurationMonths,
        adjustmentRate: source.adjustmentRate,
        renewalDate: source.renewalDate,
        financialProductId: source.financialProductId,
        paymentMethodConfigId: source.paymentMethodConfigId,
        financialResponsibleId: source.financialResponsibleId,
        legalResponsibleId: source.legalResponsibleId,
        commercialResponsibleId: source.commercialResponsibleId,
        signedAt: source.signedAt,
        autoRenewal: source.autoRenewal,
        renewalNoticeDays: source.renewalNoticeDays,
        billingMethod: source.billingMethod,
        relevantClauses: source.relevantClauses,
        signatories: source.signatories,
        notes: source.notes,
        createdById: auth.user.id,
        updatedById: auth.user.id,
      },
    });
    await writeAudit({
      userId: auth.user.id,
      action: "duplicate",
      entity: "Contract",
      entityId: duplicate.id,
      after: { sourceContractId: source.id },
      origin: "juridico/contratos",
    });
    revalidateContracts();
    return { ok: true };
  } catch {
    return { error: "Não foi possível duplicar o contrato." };
  }
}

const renewalSchema = z.object({
  mode: z.enum(["VERSION", "NEW_CONTRACT"]),
  startDate: z.date(),
  endDate: z.date(),
  renewalDate: z.date().nullable(),
  totalValue: z.number().nonnegative().nullable(),
  monthlyValue: z.number().nonnegative().nullable(),
  notes: z.string().nullable(),
});

export async function renewContract(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireLegalPermission("RENEW_CONTRACT");
  if ("error" in auth) return auth;
  const parsed = renewalSchema.safeParse({
    mode: str(fd, "mode"),
    startDate: optDate(fd, "startDate"),
    endDate: optDate(fd, "endDate"),
    renewalDate: optDate(fd, "renewalDate"),
    totalValue: optNum(fd, "totalValue"),
    monthlyValue: optNum(fd, "monthlyValue"),
    notes: optStr(fd, "notes"),
  });
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };
  if (parsed.data.endDate < parsed.data.startDate) {
    return { error: "O fim da renovação deve ser posterior ao início." };
  }
  try {
    const source = await prisma.contract.findFirst({
      where: { id, deletedAt: null },
    });
    if (!source) return { error: "Contrato não encontrado." };
    if (parsed.data.mode === "VERSION") {
      const updated = await prisma.contract.update({
        where: { id },
        data: {
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
          renewalDate: parsed.data.renewalDate,
          totalValue: parsed.data.totalValue,
          monthlyValue: parsed.data.monthlyValue,
          notes: parsed.data.notes ?? source.notes,
          status: "ATIVO",
          updatedById: auth.user.id,
        },
      });
      await syncContractCalendar(updated);
      await writeAudit({
        userId: auth.user.id,
        action: "renew",
        entity: "Contract",
        entityId: id,
        before: source,
        after: parsed.data,
        origin: "juridico/contratos",
      });
      revalidateContracts();
      redirect(`/dashboard/juridico/contratos/${id}/edit`);
    }
    const renewal = await prisma.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id },
        data: { status: "RENOVADO", updatedById: auth.user.id },
      });
      return tx.contract.create({
        data: {
          clientId: source.clientId,
          title: `${source.title} · Renovação`,
          type: source.type,
          totalValue: parsed.data.totalValue,
          monthlyValue: parsed.data.monthlyValue,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
          status: "RASCUNHO",
          costCenterId: source.costCenterId,
          categoryId: source.categoryId,
          renewalDate: parsed.data.renewalDate,
          financialProductId: source.financialProductId,
          paymentMethodConfigId: source.paymentMethodConfigId,
          financialResponsibleId: source.financialResponsibleId,
          legalResponsibleId: source.legalResponsibleId,
          commercialResponsibleId: source.commercialResponsibleId,
          autoRenewal: source.autoRenewal,
          renewalNoticeDays: source.renewalNoticeDays,
          billingMethod: source.billingMethod,
          relevantClauses: source.relevantClauses,
          signatories: source.signatories,
          previousContractId: source.id,
          createdById: auth.user.id,
          updatedById: auth.user.id,
          notes: parsed.data.notes ?? source.notes,
        },
      });
    });
    await syncContractCalendar(renewal);
    await writeAudit({
      userId: auth.user.id,
      action: "renew",
      entity: "Contract",
      entityId: renewal.id,
      before: { sourceContractId: source.id },
      after: parsed.data,
      origin: "juridico/contratos",
    });
    revalidateContracts();
    redirect(`/dashboard/juridico/contratos/${renewal.id}/edit`);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String(error.digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return { error: "Não foi possível renovar o contrato." };
  }
}
