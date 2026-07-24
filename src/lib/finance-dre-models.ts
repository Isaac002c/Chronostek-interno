import {
  DreModelStatus,
  DreRowKind,
  FinancialType,
  Prisma,
} from "@prisma/client";
import {
  evaluateDreFormulas,
  parseDreFormula,
  validateDreFormulaRows,
  type DreFormula,
} from "@/lib/dre-formula";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/finance-rules";

type DefaultRow = {
  code: string;
  name: string;
  kind: DreRowKind;
  sign?: number;
  formula?: DreFormula;
};

export const DEFAULT_DRE_MODEL_ROWS: DefaultRow[] = [
  { code: "RB", name: "Receita bruta", kind: "CONTA", sign: 1 },
  { code: "DED", name: "Deduções", kind: "CONTA", sign: -1 },
  {
    code: "RL",
    name: "Receita líquida",
    kind: "FORMULA",
    formula: { op: "subtract", left: { op: "ref", row: "RB" }, right: { op: "ref", row: "DED" } },
  },
  { code: "CD", name: "Custos diretos", kind: "CONTA", sign: -1 },
  {
    code: "MB",
    name: "Margem bruta",
    kind: "FORMULA",
    formula: { op: "subtract", left: { op: "ref", row: "RL" }, right: { op: "ref", row: "CD" } },
  },
  { code: "DC", name: "Despesas comerciais", kind: "CONTA", sign: -1 },
  { code: "DM", name: "Despesas de marketing", kind: "CONTA", sign: -1 },
  { code: "DT", name: "Despesas de tecnologia", kind: "CONTA", sign: -1 },
  { code: "DA", name: "Despesas administrativas", kind: "CONTA", sign: -1 },
  { code: "DP", name: "Despesas com pessoas", kind: "CONTA", sign: -1 },
  {
    code: "RO",
    name: "Resultado operacional",
    kind: "FORMULA",
    formula: {
      op: "subtract",
      left: { op: "ref", row: "MB" },
      right: { op: "sum", rows: ["DC", "DM", "DT", "DA", "DP"] },
    },
  },
  { code: "RF", name: "Resultado financeiro", kind: "CONTA", sign: 1 },
  {
    code: "RLQ",
    name: "Resultado líquido",
    kind: "FORMULA",
    formula: { op: "sum", rows: ["RO", "RF"] },
  },
];

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function createDefaultDreModel(params: {
  name?: string;
  description?: string | null;
  userId: string;
}) {
  const name = params.name?.trim() || "DRE Gerencial padrão";
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.dreModel.findUnique({
        where: { tenantId_name: { tenantId: "default", name } },
      });
      if (existing) throw new Error("Já existe um modelo de DRE com este nome.");
      const hasDefault = await tx.dreModel.count({
        where: { tenantId: "default", isDefault: true, archivedAt: null },
      });
      const categories = await tx.financialCategory.findMany({
        where: { active: true },
        select: { id: true, dreGroup: true },
      });
      const groupByCode: Record<string, string | null> = {
        RB: "RECEITA_BRUTA",
        DED: "DEDUCOES",
        CD: "CUSTOS_DIRETOS",
        DC: "DESPESAS_COMERCIAIS",
        DM: "DESPESAS_MARKETING",
        DT: "DESPESAS_TECNOLOGIA",
        DA: "DESPESAS_ADMINISTRATIVAS",
        DP: "DESPESAS_PESSOAS",
        RF: "DESPESAS_FINANCEIRAS",
      };
      const model = await tx.dreModel.create({
        data: {
          name,
          description:
            params.description ??
            "Estrutura inicial versionada. Configure os vínculos contábeis antes de publicar.",
          isDefault: hasDefault === 0,
          createdById: params.userId,
          versions: {
            create: {
              version: 1,
              notes: "Versão inicial",
              rows: {
                create: DEFAULT_DRE_MODEL_ROWS.map((row, order) => ({
                  code: row.code,
                  name: row.name,
                  kind: row.kind,
                  order,
                  sign: row.sign ?? 1,
                  formula: row.formula ? json(row.formula) : undefined,
                  mappings: groupByCode[row.code]
                    ? {
                        create: categories
                          .filter(
                            (category) =>
                              category.dreGroup === groupByCode[row.code],
                          )
                          .map((category) => ({
                            categoryId: category.id,
                            includeDescendants: true,
                          })),
                      }
                    : undefined,
                })),
              },
            },
          },
        },
        include: { versions: { include: { rows: true } } },
      });
      await tx.auditLog.create({
        data: {
          userId: params.userId,
          action: "create",
          entity: "DreModel",
          entityId: model.id,
          metadata: json({
            origin: "finance-dre",
            after: { name: model.name, version: 1, isDefault: model.isDefault },
          }),
        },
      });
      return model;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function createDreVersion(modelId: string, userId: string) {
  const model = await prisma.dreModel.findUnique({
    where: { id: modelId },
    include: {
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: { rows: { include: { mappings: true } } },
      },
    },
  });
  if (!model || !model.versions[0]) throw new Error("Modelo de DRE não encontrado.");
  const source = model.versions[0];
  return prisma.$transaction(async (tx) => {
    const version = await tx.dreModelVersion.create({
      data: {
        modelId,
        version: source.version + 1,
        notes: `Cópia da versão ${source.version}`,
      },
    });
    const rowIds = new Map<string, string>();
    const copiedRows = [];
    for (const row of source.rows) {
      const copied = await tx.dreRow.create({
        data: {
          versionId: version.id,
          code: row.code,
          name: row.name,
          kind: row.kind,
          order: row.order,
          sign: row.sign,
          hidden: row.hidden,
          formula:
            row.formula === null
              ? undefined
              : (row.formula as Prisma.InputJsonValue),
          mappings: {
            create: row.mappings.map((mapping) => ({
              categoryId: mapping.categoryId,
              costCenterId: mapping.costCenterId,
              includeDescendants: mapping.includeDescendants,
            })),
          },
        },
      });
      rowIds.set(row.id, copied.id);
      copiedRows.push(copied);
    }
    for (const row of source.rows) {
      if (!row.parentId) continue;
      const copiedId = rowIds.get(row.id);
      const copiedParentId = rowIds.get(row.parentId);
      if (copiedId && copiedParentId) {
        await tx.dreRow.update({
          where: { id: copiedId },
          data: { parentId: copiedParentId },
        });
      }
    }
    await tx.dreModel.update({
      where: { id: modelId },
      data: { currentVersion: version.version },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "create_version",
        entity: "DreModel",
        entityId: modelId,
        metadata: json({
          origin: "finance-dre",
          before: source.version,
          after: version.version,
        }),
      },
    });
    return { ...version, rows: copiedRows };
  });
}

export async function saveDreRow(params: {
  versionId: string;
  rowId?: string | null;
  parentId?: string | null;
  code: string;
  name: string;
  kind: DreRowKind;
  order: number;
  sign: number;
  hidden: boolean;
  formula?: unknown;
  userId: string;
}) {
  const version = await prisma.dreModelVersion.findUnique({
    where: { id: params.versionId },
    include: { model: true },
  });
  if (!version) throw new Error("Versão da DRE não encontrada.");
  if (version.status !== "RASCUNHO") {
    throw new Error("Crie uma nova versão para alterar uma DRE publicada.");
  }
  const parsedFormula =
    params.kind === "FORMULA" || params.kind === "SUBTOTAL"
      ? parseDreFormula(params.formula)
      : null;
  const code = params.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  if (!code || !params.name.trim()) throw new Error("Código e nome são obrigatórios.");
  if (![1, -1].includes(params.sign)) throw new Error("O sinal deve ser 1 ou -1.");

  return prisma.$transaction(async (tx) => {
    const before = params.rowId
      ? await tx.dreRow.findUnique({ where: { id: params.rowId } })
      : null;
    const row = params.rowId
      ? await tx.dreRow.update({
          where: { id: params.rowId },
          data: {
            code,
            parentId: params.parentId,
            name: params.name.trim(),
            kind: params.kind,
            order: params.order,
            sign: params.sign,
            hidden: params.hidden,
            formula: parsedFormula ? json(parsedFormula) : Prisma.JsonNull,
          },
        })
      : await tx.dreRow.create({
          data: {
            versionId: params.versionId,
            parentId: params.parentId,
            code,
            name: params.name.trim(),
            kind: params.kind,
            order: params.order,
            sign: params.sign,
            hidden: params.hidden,
            formula: parsedFormula ? json(parsedFormula) : undefined,
          },
        });
    await tx.auditLog.create({
      data: {
        userId: params.userId,
        action: before ? "update_row" : "create_row",
        entity: "DreModel",
        entityId: version.modelId,
        metadata: json({
          origin: "finance-dre",
          version: version.version,
          before,
          after: row,
        }),
      },
    });
    return row;
  });
}

export async function archiveDreModel(
  modelId: string,
  userId: string,
  reason: string,
) {
  if (!reason.trim()) throw new Error("Informe o motivo do arquivamento.");
  return prisma.$transaction(async (tx) => {
    const before = await tx.dreModel.findUnique({ where: { id: modelId } });
    if (!before) throw new Error("Modelo de DRE não encontrado.");
    const updated = await tx.dreModel.update({
      where: { id: modelId },
      data: {
        status: "ARQUIVADO",
        archivedAt: new Date(),
        isDefault: false,
      },
    });
    await tx.dreModelVersion.updateMany({
      where: { modelId, status: { not: "ARQUIVADO" } },
      data: { status: "ARQUIVADO" },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "archive",
        entity: "DreModel",
        entityId: modelId,
        metadata: json({
          origin: "finance-dre",
          before: { status: before.status, isDefault: before.isDefault },
          after: { status: updated.status, isDefault: false },
          reason,
        }),
      },
    });
    return updated;
  });
}

export async function replaceDreRowMappings(params: {
  rowId: string;
  categoryIds: string[];
  costCenterIds: string[];
  userId: string;
}) {
  const row = await prisma.dreRow.findUnique({
    where: { id: params.rowId },
    include: { version: true, mappings: true },
  });
  if (!row) throw new Error("Linha da DRE não encontrada.");
  if (row.version.status !== "RASCUNHO") {
    throw new Error("Mapeamentos publicados não podem ser alterados retroativamente.");
  }
  const categoryIds = [...new Set(params.categoryIds.filter(Boolean))];
  const costCenterIds = [...new Set(params.costCenterIds.filter(Boolean))];
  return prisma.$transaction(async (tx) => {
    await tx.dreRowMapping.deleteMany({ where: { rowId: row.id } });
    if (categoryIds.length || costCenterIds.length) {
      await tx.dreRowMapping.createMany({
        data: [
          ...categoryIds.map((categoryId) => ({
            rowId: row.id,
            categoryId,
            includeDescendants: true,
          })),
          ...costCenterIds.map((costCenterId) => ({
            rowId: row.id,
            costCenterId,
            includeDescendants: true,
          })),
        ],
      });
    }
    await tx.auditLog.create({
      data: {
        userId: params.userId,
        action: "map_rows",
        entity: "DreModel",
        entityId: row.version.modelId,
        metadata: json({
          origin: "finance-dre",
          version: row.version.version,
          rowId: row.id,
          before: row.mappings,
          after: { categoryIds, costCenterIds },
        }),
      },
    });
  });
}

export async function publishDreVersion(params: {
  versionId: string;
  effectiveFrom: Date;
  userId: string;
  notes?: string | null;
}) {
  const version = await prisma.dreModelVersion.findUnique({
    where: { id: params.versionId },
    include: { model: true, rows: { orderBy: { order: "asc" } } },
  });
  if (!version) throw new Error("Versão da DRE não encontrada.");
  if (version.status !== "RASCUNHO") throw new Error("Esta versão já foi publicada.");
  const formulaRows = version.rows.map((row) => ({
    code: row.code,
    formula: row.formula === null ? null : parseDreFormula(row.formula),
  }));
  validateDreFormulaRows(formulaRows);

  return prisma.$transaction(
    async (tx) => {
      await tx.dreModelVersion.updateMany({
        where: { modelId: version.modelId, status: "PUBLICADO" },
        data: { status: "ARQUIVADO" },
      });
      const published = await tx.dreModelVersion.update({
        where: { id: version.id },
        data: {
          status: "PUBLICADO",
          effectiveFrom: params.effectiveFrom,
          publishedById: params.userId,
          publishedAt: new Date(),
          notes: params.notes ?? version.notes,
        },
      });
      await tx.dreModel.update({
        where: { id: version.modelId },
        data: {
          status: DreModelStatus.PUBLICADO,
          currentVersion: version.version,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: params.userId,
          action: "publish",
          entity: "DreModel",
          entityId: version.modelId,
          metadata: json({
            origin: "finance-dre",
            version: version.version,
            effectiveFrom: params.effectiveFrom.toISOString(),
          }),
        },
      });
      return published;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function setDefaultDreModel(modelId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const model = await tx.dreModel.findUnique({ where: { id: modelId } });
    if (!model) throw new Error("Modelo de DRE não encontrado.");
    await tx.dreModel.updateMany({
      where: { tenantId: model.tenantId, isDefault: true },
      data: { isDefault: false },
    });
    const updated = await tx.dreModel.update({
      where: { id: modelId },
      data: { isDefault: true },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "set_default",
        entity: "DreModel",
        entityId: modelId,
        metadata: json({ origin: "finance-dre", after: { isDefault: true } }),
      },
    });
    return updated;
  });
}

function descendants(
  rootId: string,
  parentById: ReadonlyMap<string, string | null>,
): Set<string> {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, parentId] of parentById) {
      if (parentId && ids.has(parentId) && !ids.has(id)) {
        ids.add(id);
        changed = true;
      }
    }
  }
  return ids;
}

export async function getConfiguredDre(params: {
  month: number;
  year: number;
  modelId?: string | null;
  costCenterId?: string | null;
}) {
  const periodEnd = new Date(params.year, params.month, 0, 23, 59, 59, 999);
  const model = await prisma.dreModel.findFirst({
    where: params.modelId
      ? { id: params.modelId, archivedAt: null }
      : { tenantId: "default", isDefault: true, archivedAt: null },
    include: {
      versions: {
        where: {
          status: "PUBLICADO",
          OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: periodEnd } }],
        },
        orderBy: [{ effectiveFrom: "desc" }, { version: "desc" }],
        take: 1,
        include: {
          rows: {
            orderBy: { order: "asc" },
            include: { mappings: true },
          },
        },
      },
    },
  });
  const version = model?.versions[0];
  if (!model || !version) return null;

  const [entries, categories] = await Promise.all([
    prisma.financialEntry.findMany({
      where: {
        deletedAt: null,
        status: { not: "CANCELADO" },
        competenceMonth: params.month,
        competenceYear: params.year,
        ...(params.costCenterId ? { costCenterId: params.costCenterId } : {}),
      },
      select: {
        type: true,
        value: true,
        categoryId: true,
        costCenterId: true,
      },
    }),
    prisma.financialCategory.findMany({
      select: { id: true, parentId: true },
    }),
  ]);
  const parentById = new Map(categories.map((category) => [category.id, category.parentId]));
  const baseValues: Record<string, number> = {};
  const formulaRows = version.rows.map((row) => ({
    code: row.code,
    formula: row.formula === null ? null : parseDreFormula(row.formula),
  }));

  for (const row of version.rows) {
    if (row.formula !== null) continue;
    const prepared = row.mappings.map((mapping) => ({
      costCenterId: mapping.costCenterId,
      categoryIds: mapping.categoryId
        ? mapping.includeDescendants
          ? descendants(mapping.categoryId, parentById)
          : new Set([mapping.categoryId])
        : null,
    }));
    const total = entries.reduce((sum, entry) => {
      const included = prepared.some(
        (mapping) =>
          (!mapping.categoryIds ||
            (entry.categoryId && mapping.categoryIds.has(entry.categoryId))) &&
          (!mapping.costCenterId ||
            entry.costCenterId === mapping.costCenterId),
      );
      if (!included) return sum;
      const naturalSign = entry.type === FinancialType.RECEITA ? 1 : -1;
      return sum + entry.value * naturalSign * row.sign;
    }, 0);
    baseValues[row.code] = round2(total);
  }
  const values = evaluateDreFormulas(formulaRows, baseValues);
  return {
    model: { id: model.id, name: model.name },
    version: {
      id: version.id,
      version: version.version,
      effectiveFrom: version.effectiveFrom,
    },
    rows: version.rows
      .filter((row) => !row.hidden)
      .map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        kind: row.kind,
        order: row.order,
        value: round2(values[row.code] ?? 0),
      })),
  };
}
