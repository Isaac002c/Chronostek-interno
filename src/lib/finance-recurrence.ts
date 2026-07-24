import {
  FinancialStatus,
  type FinancialType,
  type PaymentMethod,
  type Prisma,
  type RecurringFrequency,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildRecurrencePlan,
  competenceIndex,
  competenceOf,
  recurrenceIdempotencyKey,
  recurrenceOccurrences,
  recurrenceScopeSequences,
  type RecurrenceScope,
} from "@/lib/finance-rules";

export type RecurringSeriesInput = {
  idempotencyKey: string;
  description: string;
  type: FinancialType;
  value: number;
  frequency: RecurringFrequency;
  startDate: Date;
  dayOfMonth: number;
  totalOccurrences?: number | null;
  durationMonths?: number | null;
  endDate?: Date | null;
  competenceMonth?: number | null;
  competenceYear?: number | null;
  categoryId?: string | null;
  costCenterId: string;
  clientId?: string | null;
  contractId?: string | null;
  supplierId?: string | null;
  projectId?: string | null;
  productId?: string | null;
  bankAccountId?: string | null;
  paymentMethod?: PaymentMethod | null;
  paymentMethodConfigId?: string | null;
  responsibleId?: string | null;
  notes?: string | null;
};

export type RecurrenceResult = {
  seriesId: string;
  occurrences: number;
  reused: boolean;
};

export class RecurrenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecurrenceError";
  }
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function shiftedCompetence(
  dueDate: Date,
  startDate: Date,
  firstMonth?: number | null,
  firstYear?: number | null,
) {
  const due = competenceOf(dueDate);
  if (!firstMonth || !firstYear) return due;
  const source = competenceOf(startDate);
  const offset =
    competenceIndex({ month: firstMonth, year: firstYear }) -
    competenceIndex(source);
  const absolute = competenceIndex(due) + offset;
  return { year: Math.floor(absolute / 12), month: (absolute % 12) + 1 };
}

function occurrenceData(
  seriesId: string,
  input: RecurringSeriesInput,
  dueDate: Date,
  sequence: number,
  total: number,
  userId: string,
) {
  const competence = shiftedCompetence(
    dueDate,
    input.startDate,
    input.competenceMonth,
    input.competenceYear,
  );
  return {
    description: input.description,
    type: input.type,
    value: input.value,
    paidValue: null,
    dueDate,
    originalDueDate: dueDate,
    competenceMonth: competence.month,
    competenceYear: competence.year,
    status: FinancialStatus.PREVISTO,
    costCenterId: input.costCenterId,
    categoryId: input.categoryId ?? null,
    clientId: input.clientId ?? null,
    contractId: input.contractId ?? null,
    supplierId: input.supplierId ?? null,
    projectId: input.projectId ?? null,
    productId: input.productId ?? null,
    bankAccountId: input.bankAccountId ?? null,
    paymentMethod: input.paymentMethod ?? null,
    paymentMethodConfigId: input.paymentMethodConfigId ?? null,
    recurring: true,
    recurringEntryId: seriesId,
    recurrenceSequence: sequence,
    recurrenceKey: recurrenceIdempotencyKey(seriesId, sequence),
    installments: total,
    installmentNumber: sequence,
    createdById: userId,
    responsibleId: input.responsibleId ?? userId,
    notes: input.notes ?? null,
  };
}

async function assertOpenCompetences(
  tx: Prisma.TransactionClient,
  occurrences: { competenceYear: number; competenceMonth: number }[],
) {
  const keys = [
    ...new Map(
      occurrences.map((entry) => [
        `${entry.competenceYear}-${entry.competenceMonth}`,
        { year: entry.competenceYear, month: entry.competenceMonth },
      ]),
    ).values(),
  ];
  if (keys.length === 0) return;
  const closed = await tx.monthlyClosing.findFirst({
    where: { status: "FECHADO", OR: keys },
    select: { month: true, year: true },
  });
  if (closed) {
    throw new RecurrenceError(
      `A competência ${closed.month}/${closed.year} está fechada.`,
    );
  }
}

/**
 * Cria a série e todas as ocorrências imediatamente, na mesma transação.
 * O idempotencyKey protege duplo clique/reenvio; recurrenceKey protege rotinas.
 */
export async function createRecurringSeries(
  input: RecurringSeriesInput,
  userId: string,
): Promise<RecurrenceResult> {
  const existing = await prisma.recurringEntry.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true, generatedOccurrences: true },
  });
  if (existing) {
    return {
      seriesId: existing.id,
      occurrences: existing.generatedOccurrences,
      reused: true,
    };
  }

  if (!input.description.trim()) throw new RecurrenceError("Informe a descrição.");
  if (!Number.isFinite(input.value) || input.value < 0) {
    throw new RecurrenceError("Informe um valor válido.");
  }
  if (!input.costCenterId) {
    throw new RecurrenceError("Selecione o centro de custo.");
  }

  const plan = buildRecurrencePlan(input);
  if (plan.length === 0) {
    throw new RecurrenceError("A configuração não gerou nenhuma ocorrência.");
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const series = await tx.recurringEntry.create({
          data: {
            tenantId: "default",
            idempotencyKey: input.idempotencyKey,
            description: input.description,
            type: input.type,
            value: input.value,
            frequency: input.frequency,
            dayOfMonth: input.dayOfMonth,
            startDate: input.startDate,
            endDate: input.endDate ?? null,
            status: "ATIVA",
            active: true,
            totalOccurrences: plan.length,
            durationMonths: input.durationMonths ?? null,
            startCompetenceMonth: input.competenceMonth ?? null,
            startCompetenceYear: input.competenceYear ?? null,
            categoryId: input.categoryId ?? null,
            costCenterId: input.costCenterId,
            clientId: input.clientId ?? null,
            contractId: input.contractId ?? null,
            supplierId: input.supplierId ?? null,
            projectId: input.projectId ?? null,
            productId: input.productId ?? null,
            bankAccountId: input.bankAccountId ?? null,
            paymentMethod: input.paymentMethod ?? null,
            paymentMethodConfigId: input.paymentMethodConfigId ?? null,
            responsibleId: input.responsibleId ?? userId,
            notes: input.notes ?? null,
            createdById: userId,
            updatedById: userId,
          },
        });

        const occurrences = plan.map((dueDate, index) =>
          occurrenceData(
            series.id,
            input,
            dueDate,
            index + 1,
            plan.length,
            userId,
          ),
        );
        await assertOpenCompetences(tx, occurrences);
        const created = await tx.financialEntry.createMany({
          data: occurrences,
          skipDuplicates: true,
        });
        const primary = await tx.financialEntry.findFirst({
          where: {
            recurringEntryId: series.id,
            recurrenceSequence: 1,
          },
          select: { id: true },
        });
        const last = occurrences.at(-1);
        await tx.recurringEntry.update({
          where: { id: series.id },
          data: {
            primaryEntryId: primary?.id,
            generatedOccurrences: created.count,
            lastGeneratedMonth: last?.competenceMonth,
            lastGeneratedYear: last?.competenceYear,
            nextGenerationDate: null,
          },
        });
        await tx.recurringEntryHistory.create({
          data: {
            recurringEntryId: series.id,
            userId,
            action: "create",
            scope: "SERIES",
            after: asJson({
              ...input,
              totalOccurrences: plan.length,
              generatedOccurrences: created.count,
            }),
          },
        });
        await tx.auditLog.create({
          data: {
            userId,
            action: "create-series",
            entity: "RecurringEntry",
            entityId: series.id,
            metadata: {
              after: {
                frequency: input.frequency,
                occurrences: created.count,
                type: input.type,
                value: input.value,
              },
              origin: "financeiro/lancamentos",
            },
          },
        });
        return {
          seriesId: series.id,
          occurrences: created.count,
          reused: false,
        };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const reused = await prisma.recurringEntry.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { id: true, generatedOccurrences: true },
      });
      if (reused) {
        return {
          seriesId: reused.id,
          occurrences: reused.generatedOccurrences,
          reused: true,
        };
      }
    }
    throw error;
  }
}

type OccurrencePatch = {
  description?: string;
  value?: number;
  categoryId?: string | null;
  costCenterId?: string | null;
  clientId?: string | null;
  contractId?: string | null;
  supplierId?: string | null;
  projectId?: string | null;
  productId?: string | null;
  bankAccountId?: string | null;
  paymentMethodConfigId?: string | null;
  notes?: string | null;
};

export async function updateRecurringOccurrences(params: {
  seriesId: string;
  occurrenceNumber: number;
  scope: RecurrenceScope;
  patch: OccurrencePatch;
  confirmSettled: boolean;
  reason?: string | null;
  userId: string;
}): Promise<number> {
  return prisma.$transaction(
    async (tx) => {
      const series = await tx.recurringEntry.findUnique({
        where: { id: params.seriesId },
        include: {
          generatedEntries: {
            where: { deletedAt: null, recurrenceSequence: { not: null } },
            orderBy: { recurrenceSequence: "asc" },
          },
        },
      });
      if (!series) throw new RecurrenceError("Série não encontrada.");
      const sequences = series.generatedEntries.flatMap((entry) =>
        entry.recurrenceSequence ? [entry.recurrenceSequence] : [],
      );
      const selected = recurrenceScopeSequences(
        sequences,
        params.occurrenceNumber,
        params.scope,
      );
      const targets = series.generatedEntries.filter(
        (entry) =>
          entry.recurrenceSequence &&
          selected.includes(entry.recurrenceSequence),
      );
      if (targets.length === 0) {
        throw new RecurrenceError("Nenhuma ocorrência foi selecionada.");
      }
      const settled = targets.filter(
        (entry) => entry.status === "PAGO" || entry.status === "PARCIAL",
      );
      if (settled.length > 0 && !params.confirmSettled) {
        throw new RecurrenceError(
          "Existem ocorrências liquidadas. Confirme explicitamente a alteração.",
        );
      }
      await assertOpenCompetences(tx, targets);

      await tx.financialEntry.updateMany({
        where: {
          recurringEntryId: params.seriesId,
          recurrenceSequence: { in: selected },
        },
        data: {
          ...params.patch,
          recurrenceException: params.scope === "OCCURRENCE",
        },
      });
      if (params.scope !== "OCCURRENCE") {
        await tx.recurringEntry.update({
          where: { id: params.seriesId },
          data: {
            ...params.patch,
            updatedById: params.userId,
            version: { increment: 1 },
          },
        });
      }
      await tx.recurringEntryHistory.create({
        data: {
          recurringEntryId: params.seriesId,
          userId: params.userId,
          action: "update",
          scope: params.scope,
          occurrenceNumber: params.occurrenceNumber,
          reason: params.reason ?? null,
          before: asJson(targets),
          after: asJson(params.patch),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: params.userId,
          action: "update-series",
          entity: "RecurringEntry",
          entityId: params.seriesId,
          metadata: {
            after: asJson({ scope: params.scope, affected: targets.length }),
            reason: params.reason ?? null,
            origin: "financeiro/contratos",
          },
        },
      });
      return targets.length;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function cancelRecurringOccurrences(params: {
  seriesId: string;
  occurrenceNumber: number;
  scope: RecurrenceScope;
  confirmSettled: boolean;
  reason: string;
  userId: string;
}): Promise<number> {
  if (!params.reason.trim()) {
    throw new RecurrenceError("Informe o motivo do cancelamento.");
  }
  return prisma.$transaction(
    async (tx) => {
      const series = await tx.recurringEntry.findUnique({
        where: { id: params.seriesId },
        include: {
          generatedEntries: {
            where: { deletedAt: null, recurrenceSequence: { not: null } },
            orderBy: { recurrenceSequence: "asc" },
          },
        },
      });
      if (!series) throw new RecurrenceError("Série não encontrada.");
      const sequences = series.generatedEntries.flatMap((entry) =>
        entry.recurrenceSequence ? [entry.recurrenceSequence] : [],
      );
      const selected = recurrenceScopeSequences(
        sequences,
        params.occurrenceNumber,
        params.scope,
      );
      const targets = series.generatedEntries.filter(
        (entry) =>
          entry.recurrenceSequence &&
          selected.includes(entry.recurrenceSequence),
      );
      const settled = targets.filter(
        (entry) => entry.status === "PAGO" || entry.status === "PARCIAL",
      );
      if (settled.length > 0 && !params.confirmSettled) {
        throw new RecurrenceError(
          "Existem ocorrências liquidadas. Confirme explicitamente o cancelamento.",
        );
      }
      await assertOpenCompetences(tx, targets);

      await tx.financialEntry.updateMany({
        where: {
          recurringEntryId: params.seriesId,
          recurrenceSequence: { in: selected },
        },
        data: { status: "CANCELADO" },
      });
      if (params.scope === "SERIES") {
        await tx.recurringEntry.update({
          where: { id: params.seriesId },
          data: {
            status: "CANCELADA",
            active: false,
            updatedById: params.userId,
            version: { increment: 1 },
          },
        });
      }
      await tx.recurringEntryHistory.create({
        data: {
          recurringEntryId: params.seriesId,
          userId: params.userId,
          action: "cancel",
          scope: params.scope,
          occurrenceNumber: params.occurrenceNumber,
          reason: params.reason,
          before: asJson(targets),
          after: asJson({ status: "CANCELADO" }),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: params.userId,
          action: "cancel-series",
          entity: "RecurringEntry",
          entityId: params.seriesId,
          metadata: {
            after: asJson({ scope: params.scope, affected: targets.length }),
            reason: params.reason,
            origin: "financeiro/contratos",
          },
        },
      });
      return targets.length;
    },
    { isolationLevel: "Serializable" },
  );
}

/**
 * Repara/gera ocorrências ausentes de séries existentes. Pode ser executada
 * repetidamente: as chaves únicas da série + sequência tornam a rotina idempotente.
 */
export async function generateMissingRecurringOccurrences(
  seriesId: string,
  userId: string,
  horizon: Date = new Date(),
): Promise<number> {
  return prisma.$transaction(
    async (tx) => {
      const series = await tx.recurringEntry.findUnique({
        where: { id: seriesId },
        include: {
          generatedEntries: {
            where: { deletedAt: null },
            select: { recurrenceSequence: true },
          },
        },
      });
      if (!series || !series.active || series.status !== "ATIVA") return 0;
      const input: RecurringSeriesInput = {
        idempotencyKey: series.idempotencyKey ?? series.id,
        description: series.description,
        type: series.type,
        value: series.value,
        frequency: series.frequency,
        startDate: series.startDate,
        dayOfMonth: series.dayOfMonth,
        totalOccurrences: series.totalOccurrences,
        durationMonths: series.durationMonths,
        endDate: series.endDate,
        competenceMonth: series.startCompetenceMonth,
        competenceYear: series.startCompetenceYear,
        categoryId: series.categoryId,
        costCenterId: series.costCenterId ?? "",
        clientId: series.clientId,
        contractId: series.contractId,
        supplierId: series.supplierId,
        projectId: series.projectId,
        productId: series.productId,
        bankAccountId: series.bankAccountId,
        paymentMethod: series.paymentMethod,
        paymentMethodConfigId: series.paymentMethodConfigId,
        responsibleId: series.responsibleId,
        notes: series.notes,
      };
      if (!input.costCenterId) {
        throw new RecurrenceError("A série não possui centro de custo.");
      }
      const hasFiniteRule = Boolean(
        series.totalOccurrences || series.durationMonths || series.endDate,
      );
      const plan = hasFiniteRule
        ? buildRecurrencePlan(input)
        : recurrenceOccurrences(
            series.startDate,
            horizon,
            series.frequency,
            series.dayOfMonth,
          );
      const existing = new Set(
        series.generatedEntries.flatMap((entry) =>
          entry.recurrenceSequence ? [entry.recurrenceSequence] : [],
        ),
      );
      const missing = plan.flatMap((dueDate, index) =>
        existing.has(index + 1)
          ? []
          : [
              occurrenceData(
                series.id,
                input,
                dueDate,
                index + 1,
                plan.length,
                userId,
              ),
            ],
      );
      await assertOpenCompetences(tx, missing);
      const created =
        missing.length === 0
          ? { count: 0 }
          : await tx.financialEntry.createMany({
              data: missing,
              skipDuplicates: true,
            });
      const last = plan.at(-1);
      const lastCompetence = last
        ? shiftedCompetence(
            last,
            series.startDate,
            series.startCompetenceMonth,
            series.startCompetenceYear,
          )
        : null;
      await tx.recurringEntry.update({
        where: { id: series.id },
        data: {
          ...(series.primaryEntryId
            ? {}
            : {
                primaryEntryId: (
                  await tx.financialEntry.findFirst({
                    where: {
                      recurringEntryId: series.id,
                      recurrenceSequence: 1,
                    },
                    select: { id: true },
                  })
                )?.id,
              }),
          generatedOccurrences: { increment: created.count },
          lastGeneratedMonth: lastCompetence?.month,
          lastGeneratedYear: lastCompetence?.year,
          nextGenerationDate: null,
        },
      });
      if (created.count > 0) {
        await tx.recurringEntryHistory.create({
          data: {
            recurringEntryId: series.id,
            userId,
            action: "generate-missing",
            scope: "SERIES",
            after: asJson({ created: created.count }),
          },
        });
        await tx.auditLog.create({
          data: {
            userId,
            action: "generate-recurrences",
            entity: "RecurringEntry",
            entityId: series.id,
            metadata: {
              after: { created: created.count },
              origin: "financeiro/contratos",
            },
          },
        });
      }
      return created.count;
    },
    { isolationLevel: "Serializable" },
  );
}
