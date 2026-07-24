/**
 * Teste transacional do Financeiro para uma CÓPIA restaurada do banco.
 * Nunca execute contra produção. A URL precisa conter "restore", "test" ou
 * "rehearsal" no nome do banco.
 */
import assert from "node:assert/strict";

const databaseUrl = process.env.FINANCE_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Defina FINANCE_TEST_DATABASE_URL para a cópia restaurada.");
}
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "").toLowerCase();
if (
  !databaseName.includes("restore") &&
  !databaseName.includes("test") &&
  !databaseName.includes("rehearsal")
) {
  throw new Error(
    `Proteção acionada: o banco "${databaseName}" não parece ser uma cópia de teste.`,
  );
}
process.env.DATABASE_URL = databaseUrl;

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const created = {
  seriesId: "",
  projectionIds: [] as string[],
  dreModelId: "",
  supplierId: "",
  bankId: "",
  paymentMethodId: "",
  productId: "",
  taskId: "",
};

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const {
    cancelRecurringOccurrences,
    createRecurringSeries,
    deleteRecurringSeries,
    updateRecurringOccurrences,
  } = await import("../src/lib/finance-recurrence");
  const {
    createProjection,
    duplicateProjection,
    restoreProjectionAutomatic,
    updateProjectionValuesBatch,
  } = await import("../src/lib/finance-projections");
  const {
    createDefaultDreModel,
    getConfiguredDre,
    publishDreVersion,
  } = await import("../src/lib/finance-dre-models");

  const [user, costCenter, contract] = await Promise.all([
    prisma.user.findFirst({
      where: { deletedAt: null, status: "ATIVO" },
      select: { id: true },
    }),
    prisma.costCenter.findFirst({
      where: { active: true },
      select: { id: true },
    }),
    prisma.contract.findFirst({
      where: { deletedAt: null },
      select: { id: true },
    }),
  ]);
  assert.ok(user, "A cópia precisa conter ao menos um usuário ativo.");
  assert.ok(costCenter, "A cópia precisa conter ao menos um centro de custo.");

  try {
    console.log("Finance DB — recorrência transacional/idempotente");
    const recurrenceInput = {
      idempotencyKey: `finance-db-test-${suffix}`,
      description: `Teste recorrência ${suffix}`,
      type: "RECEITA" as const,
      value: 100,
      frequency: "MENSAL" as const,
      startDate: new Date(2037, 0, 31),
      dayOfMonth: 31,
      totalOccurrences: 4,
      competenceMonth: 1,
      competenceYear: 2037,
      costCenterId: costCenter.id,
      contractId: contract?.id ?? null,
    };
    const first = await createRecurringSeries(recurrenceInput, user.id);
    created.seriesId = first.seriesId;
    assert.equal(first.occurrences, 4);
    assert.equal(first.reused, false);
    const second = await createRecurringSeries(recurrenceInput, user.id);
    assert.equal(second.seriesId, first.seriesId);
    assert.equal(second.reused, true);
    assert.equal(
      await prisma.financialEntry.count({
        where: { recurringEntryId: first.seriesId },
      }),
      4,
    );
    const dates = await prisma.financialEntry.findMany({
      where: { recurringEntryId: first.seriesId },
      orderBy: { recurrenceSequence: "asc" },
      select: {
        id: true,
        dueDate: true,
        recurrenceSequence: true,
        contractId: true,
      },
    });
    assert.equal(dates[1].dueDate?.getDate(), 28);
    if (contract) assert.ok(dates.every((entry) => entry.contractId === contract.id));

    const affected = await updateRecurringOccurrences({
      seriesId: first.seriesId,
      occurrenceNumber: 2,
      scope: "FUTURE",
      patch: { value: 900 },
      confirmSettled: false,
      reason: "Teste de escopo futuro",
      userId: user.id,
    });
    assert.equal(affected, 3);
    const values = await prisma.financialEntry.findMany({
      where: { recurringEntryId: first.seriesId },
      orderBy: { recurrenceSequence: "asc" },
      select: { value: true },
    });
    assert.deepEqual(values.map((entry) => entry.value), [100, 900, 900, 900]);

    await cancelRecurringOccurrences({
      seriesId: first.seriesId,
      occurrenceNumber: 3,
      scope: "OCCURRENCE",
      confirmSettled: false,
      reason: "Teste de cancelamento unitário",
      userId: user.id,
    });
    const cancelled = await prisma.financialEntry.findFirstOrThrow({
      where: { recurringEntryId: first.seriesId, recurrenceSequence: 3 },
    });
    assert.equal(cancelled.status, "CANCELADO");

    await prisma.financialEntry.updateMany({
      where: { recurringEntryId: first.seriesId, recurrenceSequence: 1 },
      data: { status: "PAGO", paidValue: 100 },
    });
    await assert.rejects(() =>
      updateRecurringOccurrences({
        seriesId: first.seriesId,
        occurrenceNumber: 1,
        scope: "SERIES",
        patch: { value: 200 },
        confirmSettled: false,
        userId: user.id,
      }),
    );

    const linkedTask = await prisma.task.create({
      data: {
        title: `Tarefa recorrência ${suffix}`,
        module: "FINANCEIRO",
        financialEntryId: dates[0].id,
        createdById: user.id,
      },
    });
    created.taskId = linkedTask.id;
    const deleted = await deleteRecurringSeries({
      seriesId: first.seriesId,
      confirmation: "EXCLUIR",
    });
    assert.equal(deleted.deletedOccurrences, 4);
    assert.ok(deleted.deletedHistory >= 3);
    assert.ok(deleted.removedAuditLogs >= 1);
    assert.equal(deleted.detachedTasks, 1);
    assert.equal(
      await prisma.recurringEntry.count({ where: { id: first.seriesId } }),
      0,
    );
    assert.equal(
      await prisma.financialEntry.count({
        where: { recurringEntryId: first.seriesId },
      }),
      0,
    );
    assert.equal(
      await prisma.recurringEntryHistory.count({
        where: { recurringEntryId: first.seriesId },
      }),
      0,
    );
    assert.equal(
      await prisma.auditLog.count({
        where: { entity: "RecurringEntry", entityId: first.seriesId },
      }),
      0,
    );
    const detachedTask = await prisma.task.findUniqueOrThrow({
      where: { id: linkedTask.id },
      select: { financialEntryId: true },
    });
    assert.equal(detachedTask.financialEntryId, null);
    created.seriesId = "";

    console.log("Finance DB — projeção manual/histórico/restauração");
    const projection = await createProjection(
      {
        name: `Teste projeção ${suffix}`,
        year: 2037,
        scenarioType: "PERSONALIZADO",
        seedKind: "VAZIA",
      },
      user.id,
    );
    created.projectionIds.push(projection.id);
    const value = await prisma.financialProjectionValue.findFirstOrThrow({
      where: { line: { projectionId: projection.id } },
      orderBy: [{ line: { order: "asc" } }, { month: "asc" }],
    });
    assert.equal(value.automaticValue, 0);
    assert.equal(
      await updateProjectionValuesBatch({
        projectionId: projection.id,
        changes: [{ valueId: value.id, value: 123.45, reason: "Teste inline" }],
        userId: user.id,
      }),
      1,
    );
    const manual = await prisma.financialProjectionValue.findUniqueOrThrow({
      where: { id: value.id },
      include: { history: true },
    });
    assert.equal(manual.manualValue, 123.45);
    assert.equal(manual.history.length, 1);
    await restoreProjectionAutomatic(value.id, user.id, "Teste de restauração");
    const restored = await prisma.financialProjectionValue.findUniqueOrThrow({
      where: { id: value.id },
      include: { history: true },
    });
    assert.equal(restored.manualValue, null);
    assert.equal(restored.source, "AUTOMATICO");
    assert.equal(restored.history.length, 2);
    const copy = await duplicateProjection(projection.id, user.id, {
      name: `Teste projeção cópia ${suffix}`,
    });
    created.projectionIds.push(copy.id);
    assert.equal(await prisma.financialProjectionLine.count({ where: { projectionId: copy.id } }), 12);

    console.log("Finance DB — DRE versionada/fórmulas publicadas");
    const dre = await createDefaultDreModel({
      name: `Teste DRE ${suffix}`,
      userId: user.id,
    });
    created.dreModelId = dre.id;
    const versionId = dre.versions[0].id;
    await publishDreVersion({
      versionId,
      effectiveFrom: new Date(2037, 0, 1),
      userId: user.id,
      notes: "Publicação de teste",
    });
    const report = await getConfiguredDre({
      month: 1,
      year: 2037,
      modelId: dre.id,
    });
    assert.ok(report);
    assert.equal(report.version.version, 1);
    assert.equal(report.rows.length, 13);

    console.log("Finance DB — cadastros, vínculos e duplicidade");
    const bank = await prisma.bankAccount.create({
      data: {
        name: `Banco teste ${suffix}`,
        type: "CAIXA",
        initialBalance: 50,
        initialBalanceDate: new Date(2037, 0, 1),
        responsibleId: user.id,
      },
    });
    created.bankId = bank.id;
    const method = await prisma.paymentMethodConfig.create({
      data: {
        code: `TEST_${suffix}`.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
        name: `Pix teste ${suffix}`,
        settlementDays: 1,
        feeRate: 0.5,
        bankAccountId: bank.id,
        createdById: user.id,
      },
    });
    created.paymentMethodId = method.id;
    await assert.rejects(() =>
      prisma.paymentMethodConfig.create({
        data: {
          code: method.code,
          name: "Duplicado",
          createdById: user.id,
        },
      }),
    );
    const product = await prisma.financialProduct.create({
      data: {
        code: `PROD_${suffix}`.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
        name: `Serviço teste ${suffix}`,
        type: "SERVICO",
        createdById: user.id,
      },
    });
    created.productId = product.id;
    const supplier = await prisma.supplier.create({
      data: {
        name: `Fornecedor teste ${suffix}`,
        defaultCostCenterId: costCenter.id,
        responsibleId: user.id,
        bankDetailsMasked: "Banco teste · final 0000",
      },
    });
    created.supplierId = supplier.id;
    assert.equal(method.bankAccountId, bank.id);
    assert.equal(supplier.defaultCostCenterId, costCenter.id);

    console.log("Finance DB — todos os testes passaram.");
  } finally {
    await prisma.$transaction(async (tx) => {
      if (created.taskId) {
        await tx.task.deleteMany({ where: { id: created.taskId } });
      }
      if (created.seriesId) {
        await tx.recurringEntry.updateMany({
          where: { id: created.seriesId },
          data: { primaryEntryId: null },
        });
        await tx.financialEntry.deleteMany({
          where: { recurringEntryId: created.seriesId },
        });
        await tx.recurringEntryHistory.deleteMany({
          where: { recurringEntryId: created.seriesId },
        });
        await tx.recurringEntry.deleteMany({ where: { id: created.seriesId } });
      }
      for (const projectionId of [...created.projectionIds].reverse()) {
        await tx.financialProjection.deleteMany({ where: { id: projectionId } });
      }
      if (created.dreModelId) {
        await tx.dreModel.deleteMany({ where: { id: created.dreModelId } });
      }
      if (created.paymentMethodId) {
        await tx.paymentMethodConfig.deleteMany({
          where: { id: created.paymentMethodId },
        });
      }
      if (created.productId) {
        await tx.financialProduct.deleteMany({ where: { id: created.productId } });
      }
      if (created.supplierId) {
        await tx.supplier.deleteMany({ where: { id: created.supplierId } });
      }
      if (created.bankId) {
        await tx.bankAccount.deleteMany({ where: { id: created.bankId } });
      }
      const ids = [
        created.seriesId,
        ...created.projectionIds,
        created.dreModelId,
        created.paymentMethodId,
        created.productId,
        created.supplierId,
        created.bankId,
      ].filter(Boolean);
      await tx.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
