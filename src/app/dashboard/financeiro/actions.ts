"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  FinancialStatus,
  FinancialType,
  PaymentMethod,
  RecurringFrequency,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { maybeRequestExpenseApproval } from "@/lib/approvals";
import { writeAudit } from "@/lib/audit";
import { isCompetenceClosed } from "@/lib/closing";
import {
  requireFinancePermission,
  zodFieldErrors,
  str,
  optStr,
  num,
  optInt,
  optDate,
  optBool,
  optEnum,
  type ActionState,
} from "@/lib/actions";
import {
  cancelRecurringOccurrences,
  createRecurringSeries,
  deleteRecurringSeries,
  updateRecurringOccurrences,
} from "@/lib/finance-recurrence";
import type { RecurrenceScope } from "@/lib/finance-rules";

const now = () => new Date();

const entrySchema = z.object({
  description: z.string().min(1, "Informe a descrição."),
  type: z.nativeEnum(FinancialType),
  value: z.number().nonnegative("Valor inválido."),
  dueDate: z.date().nullable(),
  paymentDate: z.date().nullable(),
  competenceMonth: z.number().int().min(1).max(12),
  competenceYear: z.number().int().min(2000).max(2100),
  status: z.nativeEnum(FinancialStatus),
  costCenterId: z.string().min(1, "Selecione o centro de custo."),
  categoryId: z.string().nullable(),
  clientId: z.string().nullable(),
  contractId: z.string().nullable(),
  projectId: z.string().nullable(),
  supplierId: z.string().nullable(),
  productId: z.string().nullable(),
  bankAccountId: z.string().nullable(),
  paymentMethodConfigId: z.string().nullable(),
  recurring: z.boolean(),
  installments: z.number().int().positive().nullable(),
  installmentNumber: z.number().int().positive().nullable(),
  paymentMethod: z.nativeEnum(PaymentMethod).nullable(),
  notes: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  frequency: z.nativeEnum(RecurringFrequency),
  recurrenceStartDate: z.date().nullable(),
  recurrenceEndDate: z.date().nullable(),
  totalOccurrences: z.number().int().positive().max(600).nullable(),
  durationMonths: z.number().int().positive().max(600).nullable(),
  dayOfMonth: z.number().int().min(1).max(31),
  recurrenceScope: z.enum(["OCCURRENCE", "FUTURE", "SERIES"]),
  confirmSettled: z.boolean(),
  changeReason: z.string().nullable(),
});

function parseEntry(fd: FormData) {
  return {
    description: str(fd, "description"),
    type: (optEnum(fd, "type") ?? "RECEITA") as FinancialType,
    value: num(fd, "value"),
    dueDate: optDate(fd, "dueDate"),
    paymentDate: optDate(fd, "paymentDate"),
    competenceMonth: optInt(fd, "competenceMonth") ?? now().getMonth() + 1,
    competenceYear: optInt(fd, "competenceYear") ?? now().getFullYear(),
    status: (optEnum(fd, "status") ?? "PENDENTE") as FinancialStatus,
    costCenterId: optStr(fd, "costCenterId"),
    categoryId: optStr(fd, "categoryId"),
    clientId: optStr(fd, "clientId"),
    contractId: optStr(fd, "contractId"),
    projectId: optStr(fd, "projectId"),
    supplierId: optStr(fd, "supplierId"),
    productId: optStr(fd, "productId"),
    bankAccountId: optStr(fd, "bankAccountId"),
    paymentMethodConfigId: optStr(fd, "paymentMethodConfigId"),
    recurring: optBool(fd, "recurring"),
    installments: optInt(fd, "installments"),
    installmentNumber: optInt(fd, "installmentNumber"),
    paymentMethod: (optEnum(fd, "paymentMethod") ?? null) as PaymentMethod | null,
    notes: optStr(fd, "notes"),
    idempotencyKey: optStr(fd, "idempotencyKey"),
    frequency: (optEnum(fd, "frequency") ?? "MENSAL") as RecurringFrequency,
    recurrenceStartDate: optDate(fd, "recurrenceStartDate"),
    recurrenceEndDate: optDate(fd, "recurrenceEndDate"),
    totalOccurrences: optInt(fd, "totalOccurrences"),
    durationMonths: optInt(fd, "durationMonths"),
    dayOfMonth: optInt(fd, "dayOfMonth") ?? 1,
    recurrenceScope: (optEnum(fd, "recurrenceScope") ??
      "OCCURRENCE") as RecurrenceScope,
    confirmSettled: optBool(fd, "confirmSettled"),
    changeReason: optStr(fd, "changeReason"),
  };
}

type ParsedEntry = z.infer<typeof entrySchema>;

function entryData(parsed: ParsedEntry) {
  return {
    description: parsed.description,
    type: parsed.type,
    value: parsed.value,
    dueDate: parsed.dueDate,
    paymentDate: parsed.paymentDate,
    competenceMonth: parsed.competenceMonth,
    competenceYear: parsed.competenceYear,
    status: parsed.status,
    costCenterId: parsed.costCenterId,
    categoryId: parsed.categoryId,
    clientId: parsed.clientId,
    contractId: parsed.contractId,
    projectId: parsed.projectId,
    supplierId: parsed.supplierId,
    productId: parsed.productId,
    bankAccountId: parsed.bankAccountId,
    paymentMethodConfigId: parsed.paymentMethodConfigId,
    recurring: parsed.recurring,
    installments: parsed.installments,
    installmentNumber: parsed.installmentNumber,
    paymentMethod: parsed.paymentMethod,
    notes: parsed.notes,
  };
}

function revalidateFinance() {
  revalidatePath("/dashboard/financeiro");
  revalidatePath("/dashboard/financeiro/lancamentos");
  revalidatePath("/dashboard/financeiro/contratos");
  revalidatePath("/dashboard/financeiro/mes-a-mes");
  revalidatePath("/dashboard/financeiro/projecoes");
  revalidatePath("/dashboard/financeiro/dre");
}

export async function createEntry(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("CREATE_ENTRY");
  if ("error" in auth) return auth;

  const parsed = entrySchema.safeParse(parseEntry(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  if (
    await isCompetenceClosed(
      parsed.data.competenceMonth,
      parsed.data.competenceYear,
    )
  ) {
    return {
      error: "Mês fechado. Reabra o período para lançar nesta competência.",
    };
  }

  try {
    if (parsed.data.recurring) {
      const recurrenceAuth = await requireFinancePermission("CREATE_RECURRENCE");
      if ("error" in recurrenceAuth) return recurrenceAuth;
      if (!parsed.data.idempotencyKey || !parsed.data.recurrenceStartDate) {
        return { error: "Configure a data inicial da recorrência." };
      }
      if (
        !parsed.data.totalOccurrences &&
        !parsed.data.durationMonths &&
        !parsed.data.recurrenceEndDate
      ) {
        return {
          error: "Informe quantidade, duração ou data final da recorrência.",
        };
      }
      await createRecurringSeries(
        {
          idempotencyKey: parsed.data.idempotencyKey,
          description: parsed.data.description,
          type: parsed.data.type,
          value: parsed.data.value,
          frequency: parsed.data.frequency,
          startDate: parsed.data.recurrenceStartDate,
          dayOfMonth: parsed.data.dayOfMonth,
          totalOccurrences: parsed.data.totalOccurrences,
          durationMonths: parsed.data.durationMonths,
          endDate: parsed.data.recurrenceEndDate,
          competenceMonth: parsed.data.competenceMonth,
          competenceYear: parsed.data.competenceYear,
          costCenterId: parsed.data.costCenterId,
          categoryId: parsed.data.categoryId,
          clientId: parsed.data.clientId,
          contractId: parsed.data.contractId,
          supplierId: parsed.data.supplierId,
          projectId: parsed.data.projectId,
          productId: parsed.data.productId,
          bankAccountId: parsed.data.bankAccountId,
          paymentMethod: parsed.data.paymentMethod,
          paymentMethodConfigId: parsed.data.paymentMethodConfigId,
          notes: parsed.data.notes,
          responsibleId: auth.user.id,
        },
        auth.user.id,
      );
    } else {
      const data = entryData(parsed.data);
      const entry = await prisma.financialEntry.create({
        data: {
          ...data,
          createdById: auth.user.id,
          responsibleId: auth.user.id,
        },
      });
      await maybeRequestExpenseApproval({
        entryId: entry.id,
        type: parsed.data.type,
        value: parsed.data.value,
        requestedById: auth.user.id,
      });
      await writeAudit({
        userId: auth.user.id,
        action: "create",
        entity: "FinancialEntry",
        entityId: entry.id,
        after: data,
      });
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o lançamento.",
    };
  }

  revalidateFinance();
  redirect("/dashboard/financeiro/lancamentos");
}

export async function updateEntry(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("EDIT_ENTRY");
  if ("error" in auth) return auth;

  const parsed = entrySchema.safeParse(parseEntry(fd));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    const before = await prisma.financialEntry.findFirst({
      where: { id, deletedAt: null },
    });
    if (!before) return { error: "Lançamento não encontrado." };

    if (before.recurringEntryId && before.recurrenceSequence) {
      const recurrenceAuth = await requireFinancePermission("EDIT_RECURRENCE");
      if ("error" in recurrenceAuth) return recurrenceAuth;
      await updateRecurringOccurrences({
        seriesId: before.recurringEntryId,
        occurrenceNumber: before.recurrenceSequence,
        scope: parsed.data.recurrenceScope,
        patch: {
          description: parsed.data.description,
          value: parsed.data.value,
          categoryId: parsed.data.categoryId,
          costCenterId: parsed.data.costCenterId,
          clientId: parsed.data.clientId,
          contractId: parsed.data.contractId,
          supplierId: parsed.data.supplierId,
          projectId: parsed.data.projectId,
          productId: parsed.data.productId,
          bankAccountId: parsed.data.bankAccountId,
          paymentMethodConfigId: parsed.data.paymentMethodConfigId,
          notes: parsed.data.notes,
        },
        confirmSettled: parsed.data.confirmSettled,
        reason: parsed.data.changeReason,
        userId: auth.user.id,
      });
    } else {
      if (
        await isCompetenceClosed(
          parsed.data.competenceMonth,
          parsed.data.competenceYear,
        )
      ) {
        return {
          error:
            "Mês fechado. Reabra o período para editar esta competência.",
        };
      }
      const data = entryData(parsed.data);
      await prisma.financialEntry.update({ where: { id }, data });
      await writeAudit({
        userId: auth.user.id,
        action: "update",
        entity: "FinancialEntry",
        entityId: id,
        before,
        after: data,
      });
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o lançamento.",
    };
  }

  revalidateFinance();
  redirect("/dashboard/financeiro/lancamentos");
}

export async function deleteEntry(id: string): Promise<ActionState> {
  const auth = await requireFinancePermission("EDIT_ENTRY");
  if ("error" in auth) return auth;

  try {
    const before = await prisma.financialEntry.findFirst({
      where: { id, deletedAt: null },
    });
    if (!before) return { error: "Lançamento não encontrado." };
    if (before.recurringEntryId) {
      const deleteAuth = await requireFinancePermission("DELETE_RECURRENCE");
      if ("error" in deleteAuth) return deleteAuth;
      await deleteRecurringSeries({
        seriesId: before.recurringEntryId,
        confirmation: "EXCLUIR",
      });
      revalidateFinance();
      return { ok: true };
    }
    await prisma.financialEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await writeAudit({
      userId: auth.user.id,
      action: "delete",
      entity: "FinancialEntry",
      entityId: id,
      before,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o lançamento.",
    };
  }

  revalidateFinance();
  return { ok: true };
}

/** Atalho: marcar um lançamento como pago/recebido hoje. */
export async function markEntryPaid(id: string): Promise<ActionState> {
  const auth = await requireFinancePermission("SETTLE_ENTRY");
  if ("error" in auth) return auth;

  try {
    const before = await prisma.financialEntry.findFirst({
      where: { id, deletedAt: null },
    });
    if (!before) return { error: "Lançamento não encontrado." };
    await prisma.financialEntry.update({
      where: { id },
      data: {
        status: "PAGO",
        paymentDate: new Date(),
        paidValue: before.value,
        approvedById: auth.user.id,
      },
    });
    await writeAudit({
      userId: auth.user.id,
      action: before.type === "RECEITA" ? "receive" : "pay",
      entity: "FinancialEntry",
      entityId: id,
      before,
      reason: "Baixa integral",
    });
  } catch {
    return { error: "Não foi possível baixar o lançamento." };
  }
  revalidateFinance();
  return { ok: true };
}

export async function registerPartialSettlement(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("SETTLE_ENTRY");
  if ("error" in auth) return auth;
  const amount = num(fd, "amount");
  if (amount <= 0) return { error: "Informe um valor de baixa maior que zero." };
  try {
    const before = await prisma.financialEntry.findFirst({
      where: { id, deletedAt: null },
    });
    if (!before) return { error: "Lançamento não encontrado." };
    if (before.status === "CANCELADO") {
      return { error: "Um lançamento cancelado não pode ser baixado." };
    }
    const previousPaid = before.paidValue ?? 0;
    const paidValue = Math.round((previousPaid + amount + Number.EPSILON) * 100) / 100;
    if (paidValue > before.value) {
      return { error: "A baixa supera o valor em aberto." };
    }
    const updated = await prisma.financialEntry.update({
      where: { id },
      data: {
        paidValue,
        status: paidValue === before.value ? "PAGO" : "PARCIAL",
        paymentDate: optDate(fd, "settlementDate") ?? new Date(),
        approvedById: auth.user.id,
      },
    });
    await writeAudit({
      userId: auth.user.id,
      action:
        before.type === "RECEITA" ? "receive-partial" : "pay-partial",
      entity: "FinancialEntry",
      entityId: id,
      before: { paidValue: before.paidValue, status: before.status },
      after: { paidValue: updated.paidValue, status: updated.status },
      reason: optStr(fd, "settlementReason"),
      origin: "financeiro/lancamentos",
    });
    revalidateFinance();
    return { ok: true };
  } catch {
    return { error: "Não foi possível registrar a baixa parcial." };
  }
}

export async function cancelRecurringEntry(
  id: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("CANCEL_RECURRENCE");
  if ("error" in auth) return auth;
  const entry = await prisma.financialEntry.findFirst({
    where: { id, deletedAt: null },
    select: { recurringEntryId: true, recurrenceSequence: true },
  });
  if (!entry?.recurringEntryId || !entry.recurrenceSequence) {
    return { error: "Este lançamento não pertence a uma série recorrente." };
  }
  const scope = (optEnum(fd, "scope") ?? "OCCURRENCE") as RecurrenceScope;
  if (!["OCCURRENCE", "FUTURE", "SERIES"].includes(scope)) {
    return { error: "Escopo de cancelamento inválido." };
  }
  try {
    await cancelRecurringOccurrences({
      seriesId: entry.recurringEntryId,
      occurrenceNumber: entry.recurrenceSequence,
      scope,
      confirmSettled: optBool(fd, "confirmSettled"),
      reason: str(fd, "reason"),
      userId: auth.user.id,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Falha ao cancelar.",
    };
  }
  revalidateFinance();
  return { ok: true };
}
