import {
  Prisma,
  ProjectionLineType,
  ProjectionScenarioType,
  ProjectionStatus,
  ProjectionValueSource,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMonthByMonth } from "@/lib/finance-monthly";
import { round2 } from "@/lib/finance-rules";

export const DEFAULT_PROJECTION_LINES: {
  type: ProjectionLineType;
  label: string;
  automaticSource: string;
}[] = [
  { type: "FATURAMENTO", label: "Faturamento", automaticSource: "expectedRevenue" },
  { type: "RECEBIMENTOS", label: "Recebimentos", automaticSource: "realizedRevenue" },
  { type: "RECEITA_RECORRENTE", label: "Receitas recorrentes", automaticSource: "recurringRevenue" },
  { type: "RECEITA_PONTUAL", label: "Receitas pontuais", automaticSource: "nonRecurringRevenue" },
  { type: "CUSTO_DIRETO", label: "Custos diretos", automaticSource: "directCost" },
  { type: "DESPESA", label: "Despesas", automaticSource: "expectedExpense" },
  { type: "IMPOSTO", label: "Impostos", automaticSource: "tax" },
  { type: "INVESTIMENTO", label: "Investimentos", automaticSource: "investment" },
  { type: "INADIMPLENCIA", label: "Inadimplência estimada", automaticSource: "delinquency" },
  { type: "SALDO_INICIAL", label: "Saldo inicial", automaticSource: "openingBalance" },
  { type: "SALDO_FINAL", label: "Saldo final", automaticSource: "closingBalance" },
  { type: "RESULTADO", label: "Resultado", automaticSource: "expectedResult" },
];

export type ProjectionSeedKind =
  | "VAZIA"
  | "AUTOMATICA"
  | "ORCAMENTO"
  | "REALIZADO_ANTERIOR"
  | "CONTRATOS_ATIVOS"
  | "OUTRA_PROJECAO";

export type ProjectionCreateInput = {
  name: string;
  description?: string | null;
  year: number;
  periodStartMonth?: number;
  periodEndMonth?: number;
  scenarioType: ProjectionScenarioType;
  responsibleId?: string | null;
  notes?: string | null;
  seedKind: ProjectionSeedKind;
  sourceProjectionId?: string | null;
};

function auditMetadata(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function automaticMatrix(
  year: number,
  seedKind: ProjectionSeedKind,
): Promise<Record<string, number[]>> {
  const blank = Object.fromEntries(
    DEFAULT_PROJECTION_LINES.map((line) => [
      line.automaticSource,
      Array.from({ length: 12 }, () => 0),
    ]),
  ) as Record<string, number[]>;
  if (seedKind === "VAZIA") return blank;
  if (seedKind === "CONTRATOS_ATIVOS") {
    const entries = await prisma.financialEntry.findMany({
      where: {
        deletedAt: null,
        status: { not: "CANCELADO" },
        type: "RECEITA",
        recurring: true,
        contractId: { not: null },
        competenceYear: year,
      },
      select: {
        value: true,
        competenceMonth: true,
      },
    });
    for (const entry of entries) {
      const index = entry.competenceMonth - 1;
      blank.expectedRevenue[index] += entry.value;
      blank.recurringRevenue[index] += entry.value;
      blank.expectedResult[index] += entry.value;
    }
    return Object.fromEntries(
      Object.entries(blank).map(([key, months]) => [
        key,
        months.map(round2),
      ]),
    );
  }

  const sourceYear = seedKind === "REALIZADO_ANTERIOR" ? year - 1 : year;
  const result = await getMonthByMonth({
    year: sourceYear,
    regime: seedKind === "REALIZADO_ANTERIOR" ? "CAIXA" : "COMPETENCIA",
  });
  for (const month of result.months) {
    const i = month.month - 1;
    blank.expectedRevenue[i] =
      seedKind === "ORCAMENTO"
        ? Math.max(0, month.budget)
        : seedKind === "REALIZADO_ANTERIOR"
          ? month.realizedRevenue
          : month.expectedRevenue;
    blank.realizedRevenue[i] = month.realizedRevenue;
    blank.recurringRevenue[i] = month.recurringRevenue;
    blank.nonRecurringRevenue[i] = round2(
      Math.max(0, month.expectedRevenue - month.recurringRevenue),
    );
    blank.expectedExpense[i] =
      seedKind === "ORCAMENTO"
        ? Math.max(0, -month.budget)
        : seedKind === "REALIZADO_ANTERIOR"
          ? month.realizedExpense
          : month.expectedExpense;
    blank.delinquency[i] = month.delinquency;
    blank.openingBalance[i] = month.openingBalance;
    blank.closingBalance[i] = month.closingBalance;
    blank.expectedResult[i] =
      seedKind === "REALIZADO_ANTERIOR"
        ? month.realizedResult
        : month.expectedResult;
  }
  return blank;
}

export async function createProjection(
  input: ProjectionCreateInput,
  userId: string,
) {
  if (input.year < 2000 || input.year > 2100) {
    throw new Error("Ano da projeção inválido.");
  }
  const periodStartMonth = input.periodStartMonth ?? 1;
  const periodEndMonth = input.periodEndMonth ?? 12;
  if (
    periodStartMonth < 1 ||
    periodStartMonth > 12 ||
    periodEndMonth < periodStartMonth ||
    periodEndMonth > 12
  ) {
    throw new Error("Período da projeção inválido.");
  }
  if (!input.name.trim()) throw new Error("Informe o nome da projeção.");

  if (input.seedKind === "OUTRA_PROJECAO") {
    if (!input.sourceProjectionId) {
      throw new Error("Selecione a projeção de origem.");
    }
    return duplicateProjection(input.sourceProjectionId, userId, {
      name: input.name.trim(),
      year: input.year,
      periodStartMonth,
      periodEndMonth,
      scenarioType: input.scenarioType,
      description: input.description,
      notes: input.notes,
      responsibleId: input.responsibleId,
    });
  }

  const values = await automaticMatrix(input.year, input.seedKind);
  return prisma.$transaction(
    async (tx) => {
      const projection = await tx.financialProjection.create({
        data: {
          name: input.name.trim(),
          description: input.description,
          year: input.year,
          periodStartMonth,
          periodEndMonth,
          scenarioType: input.scenarioType,
          responsibleId: input.responsibleId,
          createdById: userId,
          sourceKind: input.seedKind,
          notes: input.notes,
          lines: {
            create: DEFAULT_PROJECTION_LINES.map((line, order) => ({
              label: line.label,
              type: line.type,
              order,
              automaticSource: line.automaticSource,
              values: {
                create: Array.from({ length: 12 }, (_, index) => ({
                  month: index + 1,
                  automaticValue: round2(values[line.automaticSource]?.[index] ?? 0),
                  source: ProjectionValueSource.AUTOMATICO,
                })),
              },
            })),
          },
        },
        include: { lines: { include: { values: true } } },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "create",
          entity: "FinancialProjection",
          entityId: projection.id,
          metadata: auditMetadata({
            origin: "finance-projection",
            after: {
              name: projection.name,
              year: projection.year,
              scenarioType: projection.scenarioType,
              sourceKind: input.seedKind,
            },
          }),
        },
      });
      return projection;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateProjectionValue(params: {
  valueId: string;
  value: number;
  reason?: string | null;
  userId: string;
}) {
  if (!Number.isFinite(params.value)) throw new Error("Valor inválido.");
  return prisma.$transaction(async (tx) => {
    const before = await tx.financialProjectionValue.findUnique({
      where: { id: params.valueId },
      include: { line: { include: { projection: true } } },
    });
    if (!before) throw new Error("Valor de projeção não encontrado.");
    if (before.line.projection.status !== "RASCUNHO") {
      throw new Error("Somente projeções em rascunho podem ser alteradas.");
    }
    const nextSource =
      before.automaticValue === params.value
        ? ProjectionValueSource.AUTOMATICO
        : before.manualValue === null
          ? ProjectionValueSource.MANUAL
          : ProjectionValueSource.SOBRESCRITO;
    const updated = await tx.financialProjectionValue.update({
      where: { id: before.id },
      data: {
        manualValue: round2(params.value),
        source: nextSource,
        updatedById: params.userId,
        history: {
          create: {
            userId: params.userId,
            previousValue: before.manualValue ?? before.automaticValue,
            newValue: round2(params.value),
            previousSource: before.source,
            newSource: nextSource,
            reason: params.reason,
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        userId: params.userId,
        action: "update_value",
        entity: "FinancialProjection",
        entityId: before.line.projectionId,
        metadata: auditMetadata({
          origin: "finance-projection",
          valueId: before.id,
          before: before.manualValue ?? before.automaticValue,
          after: updated.manualValue,
          reason: params.reason ?? null,
        }),
      },
    });
    return updated;
  });
}

export async function updateProjectionValuesBatch(params: {
  projectionId: string;
  changes: { valueId: string; value: number; reason?: string | null }[];
  userId: string;
}) {
  if (params.changes.length === 0) return 0;
  if (params.changes.length > 500) throw new Error("Muitas alterações em uma operação.");
  const unique = new Map(
    params.changes.map((change) => [change.valueId, change]),
  );
  for (const change of unique.values()) {
    if (!Number.isFinite(change.value)) throw new Error("Valor inválido.");
  }
  return prisma.$transaction(
    async (tx) => {
      const projection = await tx.financialProjection.findUnique({
        where: { id: params.projectionId },
        select: { id: true, status: true },
      });
      if (!projection) throw new Error("Projeção não encontrada.");
      if (projection.status !== "RASCUNHO") {
        throw new Error("Somente projeções em rascunho podem ser alteradas.");
      }
      const before = await tx.financialProjectionValue.findMany({
        where: {
          id: { in: [...unique.keys()] },
          line: { projectionId: projection.id },
        },
      });
      if (before.length !== unique.size) {
        throw new Error("Um ou mais valores não pertencem à projeção.");
      }
      for (const current of before) {
        const change = unique.get(current.id)!;
        const nextSource =
          current.manualValue === null
            ? ProjectionValueSource.MANUAL
            : ProjectionValueSource.SOBRESCRITO;
        await tx.financialProjectionValue.update({
          where: { id: current.id },
          data: {
            manualValue: round2(change.value),
            source: nextSource,
            updatedById: params.userId,
            history: {
              create: {
                userId: params.userId,
                previousValue: current.manualValue ?? current.automaticValue,
                newValue: round2(change.value),
                previousSource: current.source,
                newSource: nextSource,
                reason: change.reason,
              },
            },
          },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: params.userId,
          action: "update_values",
          entity: "FinancialProjection",
          entityId: projection.id,
          metadata: auditMetadata({
            origin: "finance-projection",
            affected: before.length,
            valueIds: before.map((value) => value.id),
          }),
        },
      });
      return before.length;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function restoreProjectionAutomatic(
  valueId: string,
  userId: string,
  reason?: string | null,
  expectedProjectionId?: string,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.financialProjectionValue.findUnique({
      where: { id: valueId },
      include: { line: { include: { projection: true } } },
    });
    if (!before) throw new Error("Valor de projeção não encontrado.");
    if (
      expectedProjectionId &&
      before.line.projectionId !== expectedProjectionId
    ) {
      throw new Error("Valor não pertence à projeção informada.");
    }
    if (before.line.projection.status !== "RASCUNHO") {
      throw new Error("Somente projeções em rascunho podem ser alteradas.");
    }
    const updated = await tx.financialProjectionValue.update({
      where: { id: valueId },
      data: {
        manualValue: null,
        source: "AUTOMATICO",
        updatedById: userId,
        history: {
          create: {
            userId,
            previousValue: before.manualValue ?? before.automaticValue,
            newValue: before.automaticValue,
            previousSource: before.source,
            newSource: "AUTOMATICO",
            reason: reason ?? "Restauração do valor automático",
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "restore_automatic",
        entity: "FinancialProjection",
        entityId: before.line.projectionId,
        metadata: auditMetadata({
          origin: "finance-projection",
          valueId,
          before: before.manualValue,
          after: before.automaticValue,
          reason: reason ?? null,
        }),
      },
    });
    return updated;
  });
}

/** Recalcula somente a camada automática; sobrescritas manuais são preservadas. */
export async function refreshProjectionAutomatic(
  projectionId: string,
  userId: string,
) {
  const projection = await prisma.financialProjection.findUnique({
    where: { id: projectionId },
    include: {
      lines: {
        include: { values: true },
      },
    },
  });
  if (!projection) throw new Error("Projeção não encontrada.");
  if (projection.status !== "RASCUNHO") {
    throw new Error("Somente projeções em rascunho podem ser recalculadas.");
  }
  const matrix = await automaticMatrix(projection.year, "AUTOMATICA");
  return prisma.$transaction(
    async (tx) => {
      let affected = 0;
      for (const line of projection.lines) {
        const source = line.automaticSource;
        if (!source) continue;
        for (const value of line.values) {
          const automaticValue = round2(
            matrix[source]?.[value.month - 1] ?? 0,
          );
          if (automaticValue === value.automaticValue) continue;
          await tx.financialProjectionValue.update({
            where: { id: value.id },
            data: {
              automaticValue,
              source:
                value.manualValue === null ? "AUTOMATICO" : value.source,
              updatedById: userId,
            },
          });
          affected++;
        }
      }
      await tx.auditLog.create({
        data: {
          userId,
          action: "refresh_automatic",
          entity: "FinancialProjection",
          entityId: projection.id,
          metadata: auditMetadata({
            origin: "finance-projection",
            affected,
            manualValuesPreserved: projection.lines
              .flatMap((line) => line.values)
              .filter((value) => value.manualValue !== null).length,
          }),
        },
      });
      return affected;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateProjectionLineLinks(params: {
  projectionId: string;
  lineId: string;
  categoryId?: string | null;
  costCenterId?: string | null;
  projectId?: string | null;
  productId?: string | null;
  clientId?: string | null;
  supplierId?: string | null;
  contractId?: string | null;
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.financialProjectionLine.findFirst({
      where: { id: params.lineId, projectionId: params.projectionId },
      include: { projection: { select: { status: true } } },
    });
    if (!before) throw new Error("Linha de projeção não encontrada.");
    if (before.projection.status !== "RASCUNHO") {
      throw new Error("Somente projeções em rascunho podem ser alteradas.");
    }
    const data = {
      categoryId: params.categoryId ?? null,
      costCenterId: params.costCenterId ?? null,
      projectId: params.projectId ?? null,
      productId: params.productId ?? null,
      clientId: params.clientId ?? null,
      supplierId: params.supplierId ?? null,
      contractId: params.contractId ?? null,
    };
    const updated = await tx.financialProjectionLine.update({
      where: { id: before.id },
      data,
    });
    await tx.auditLog.create({
      data: {
        userId: params.userId,
        action: "link_line",
        entity: "FinancialProjection",
        entityId: params.projectionId,
        metadata: auditMetadata({
          origin: "finance-projection",
          lineId: before.id,
          before: {
            categoryId: before.categoryId,
            costCenterId: before.costCenterId,
            projectId: before.projectId,
            productId: before.productId,
            clientId: before.clientId,
            supplierId: before.supplierId,
            contractId: before.contractId,
          },
          after: data,
        }),
      },
    });
    return updated;
  });
}

export async function duplicateProjection(
  projectionId: string,
  userId: string,
  overrides: {
    name: string;
    year?: number;
    periodStartMonth?: number;
    periodEndMonth?: number;
    scenarioType?: ProjectionScenarioType;
    description?: string | null;
    notes?: string | null;
    responsibleId?: string | null;
  },
) {
  const source = await prisma.financialProjection.findUnique({
    where: { id: projectionId },
    include: { lines: { orderBy: { order: "asc" }, include: { values: true } } },
  });
  if (!source) throw new Error("Projeção de origem não encontrada.");
  return prisma.$transaction(async (tx) => {
    const copy = await tx.financialProjection.create({
      data: {
        name: overrides.name.trim(),
        description: overrides.description ?? source.description,
        year: overrides.year ?? source.year,
        periodStartMonth:
          overrides.periodStartMonth ?? source.periodStartMonth,
        periodEndMonth: overrides.periodEndMonth ?? source.periodEndMonth,
        scenarioType: overrides.scenarioType ?? source.scenarioType,
        responsibleId: overrides.responsibleId ?? source.responsibleId,
        createdById: userId,
        sourceProjectionId: source.id,
        sourceKind: "OUTRA_PROJECAO",
        notes: overrides.notes ?? source.notes,
        lines: {
          create: source.lines.map((line) => ({
            label: line.label,
            type: line.type,
            order: line.order,
            categoryId: line.categoryId,
            costCenterId: line.costCenterId,
            projectId: line.projectId,
            productId: line.productId,
            clientId: line.clientId,
            supplierId: line.supplierId,
            contractId: line.contractId,
            automaticSource: line.automaticSource,
            values: {
              create: line.values.map((value) => ({
                month: value.month,
                automaticValue: value.automaticValue,
                manualValue: value.manualValue,
                realizedValue: value.realizedValue,
                source: value.source,
              })),
            },
          })),
        },
      },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "duplicate",
        entity: "FinancialProjection",
        entityId: copy.id,
        metadata: auditMetadata({
          origin: "finance-projection",
          sourceProjectionId: source.id,
          after: { name: copy.name, year: copy.year },
        }),
      },
    });
    return copy;
  });
}

export async function setProjectionStatus(
  id: string,
  status: ProjectionStatus,
  userId: string,
  reason?: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.financialProjection.findUnique({ where: { id } });
    if (!before) throw new Error("Projeção não encontrada.");
    const updated = await tx.financialProjection.update({
      where: { id },
      data: {
        status,
        archivedAt: status === "ARQUIVADA" ? new Date() : null,
      },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: status === "PUBLICADA" ? "publish" : "archive",
        entity: "FinancialProjection",
        entityId: id,
        metadata: auditMetadata({
          origin: "finance-projection",
          before: before.status,
          after: status,
          reason: reason ?? null,
        }),
      },
    });
    return updated;
  });
}

export function effectiveProjectionValue(value: {
  automaticValue: number;
  manualValue: number | null;
}) {
  return value.manualValue ?? value.automaticValue;
}
