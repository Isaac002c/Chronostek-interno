/**
 * Smoke test de persistência real.
 *
 * Requer um PostgreSQL descartável e ALLOW_INTEGRATION_TESTS=true. Todos os
 * registros são criados dentro de uma transação deliberadamente revertida.
 */
import { randomUUID } from "node:crypto";
import {
  buildLoginThrottleBuckets,
  clearLoginFailures,
  loginBlockedUntil,
  recordLoginFailure,
} from "../src/lib/auth-throttle";
import { runSerializableTransaction } from "../src/lib/transaction";
import {
  assertActiveSuperAdminInvariant,
  LastActiveSuperAdminError,
} from "../src/lib/user-security";
import { prisma } from "../src/lib/prisma";

if (process.env.ALLOW_INTEGRATION_TESTS !== "true") {
  console.error(
    "Recusado: defina ALLOW_INTEGRATION_TESTS=true e use um banco descartável.",
  );
  process.exit(2);
}

const rollback = new Error("ROLLBACK_INTEGRATION_TEST");
const token = randomUUID();
const email = `integration-${token}@test.invalid`;
const costCenterCode = 900_000 + Math.floor(Math.random() * 90_000);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Falha: ${message}`);
}

async function testTransactionalCrud() {
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: "Integration Test",
          email,
          passwordHash: "not-a-login-credential",
          role: "BDR",
          status: "ATIVO",
        },
      });
      const costCenter = await tx.costCenter.create({
        data: {
          code: costCenterCode,
          name: `Integration ${token}`,
          type: "OUTRO",
        },
      });
      const category = await tx.financialCategory.create({
        data: {
          code: `IT-${token}`,
          name: "Integration Test",
          type: "RECEITA",
        },
      });
      const lead = await tx.lead.create({
        data: {
          name: "Integration Lead",
          origin: "OUTRO",
          responsibleId: user.id,
        },
      });
      const goal = await tx.goal.create({
        data: {
          title: "Integration Goal",
          type: "MANUAL",
          period: "MENSAL",
          hierarchyLevel: "MENSAL",
          year: 2099,
          month: 1,
          targetValue: 10,
          responsibleId: user.id,
          assignees: {
            create: {
              userId: user.id,
              isPrimary: true,
            },
          },
        },
      });
      const task = await tx.task.create({
        data: {
          title: "Integration Task",
          assigneeId: user.id,
          createdById: user.id,
          costCenterId: costCenter.id,
          leadId: lead.id,
          goalId: goal.id,
        },
      });
      const entry = await tx.financialEntry.create({
        data: {
          description: "Integration Entry",
          type: "RECEITA",
          value: 10,
          competenceMonth: 1,
          competenceYear: 2099,
          costCenterId: costCenter.id,
          categoryId: category.id,
          createdById: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "integration-test",
          entity: "FinancialEntry",
          entityId: entry.id,
          metadata: { taskId: task.id },
        },
      });

      const loaded = await tx.lead.findFirst({
        where: { id: lead.id, responsibleId: user.id },
        include: { tasks: true },
      });
      assert(loaded, "lead deve ser consultável pelo responsável");
      assert(loaded.tasks.some((item) => item.id === task.id), "relação lead→tarefa");
      assert(
        (await tx.goalAssignee.count({
          where: { goalId: goal.id, userId: user.id },
        })) === 1,
        "relação meta→responsável",
      );
      assert(
        (await tx.financialEntry.count({
          where: { id: entry.id, costCenterId: costCenter.id },
        })) === 1,
        "relação lançamento→centro de custo",
      );

      throw rollback;
    });
  } catch (error) {
    if (error !== rollback && (error as Error).message !== rollback.message)
      throw error;
  }

  assert(
    (await prisma.user.count({ where: { email } })) === 0,
    "a transação de teste deve ser revertida",
  );
  console.log("✓ transação, CRUD e relações validados; rollback confirmado");
}

async function testLoginThrottle() {
  const request = new Request(
    "https://integration.test/api/auth/callback/credentials",
    { headers: { "x-forwarded-for": "203.0.113.50" } },
  );
  const buckets = buildLoginThrottleBuckets(email, request, {
    secret: `integration-secret-${token}`,
    trustProxy: true,
  });
  const now = new Date();

  await clearLoginFailures(buckets);
  try {
    for (let attempt = 1; attempt < 5; attempt += 1) {
      const result = await recordLoginFailure(buckets, now);
      assert(!result.newlyBlocked, `tentativa ${attempt} não deve bloquear`);
    }
    assert(
      (await loginBlockedUntil(buckets, now)) === null,
      "quatro falhas não devem bloquear",
    );

    const fifth = await recordLoginFailure(buckets, now);
    assert(fifth.newlyBlocked, "a quinta falha deve iniciar o bloqueio");
    assert(
      (await loginBlockedUntil(buckets, now)) != null,
      "o bloqueio deve ser persistido",
    );
  } finally {
    await clearLoginFailures(buckets);
  }

  assert(
    (await loginBlockedUntil(buckets, now)) === null,
    "sucesso/limpeza deve remover o bloqueio",
  );
  console.log("✓ rate limiting persistente e limpeza validados");
}

async function testConcurrentSuperAdminInvariant() {
  const existingUsers = await prisma.user.count();
  if (existingUsers !== 0) {
    console.log(
      "↷ concorrência de SUPER_ADMIN ignorada: o banco descartável não está vazio",
    );
    return;
  }

  const emails = [
    `super-a-${token}@test.invalid`,
    `super-b-${token}@test.invalid`,
  ];
  const created = await prisma.user.createManyAndReturn({
    data: emails.map((adminEmail, index) => ({
      name: `Concurrent Admin ${index + 1}`,
      email: adminEmail,
      passwordHash: "not-a-login-credential",
      role: "SUPER_ADMIN" as const,
      status: "ATIVO" as const,
    })),
    select: { id: true },
  });

  try {
    const demotions = await Promise.allSettled(
      created.map((admin) =>
        runSerializableTransaction(async (tx) => {
          const current = await tx.user.findUniqueOrThrow({
            where: { id: admin.id },
            select: { role: true, status: true },
          });
          await assertActiveSuperAdminInvariant(tx, admin.id, current, {
            role: "VIEWER",
            status: "ATIVO",
          });
          await tx.user.update({
            where: { id: admin.id },
            data: { role: "VIEWER" },
          });
        }),
      ),
    );

    const fulfilled = demotions.filter(
      (result) => result.status === "fulfilled",
    ).length;
    const rejected = demotions.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof LastActiveSuperAdminError,
    ).length;
    assert(fulfilled === 1, "somente um rebaixamento concorrente deve concluir");
    assert(
      rejected === 1,
      "o segundo rebaixamento deve preservar o último SUPER_ADMIN",
    );
    assert(
      (await prisma.user.count({
        where: {
          email: { in: emails },
          role: "SUPER_ADMIN",
          status: "ATIVO",
          deletedAt: null,
        },
      })) === 1,
      "deve restar exatamente um SUPER_ADMIN ativo",
    );
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
  }

  console.log("✓ invariante concorrente de SUPER_ADMIN validada");
}

async function main() {
  await testTransactionalCrud();
  await testLoginThrottle();
  await testConcurrentSuperAdminInvariant();
  console.log("✓ migrations e controles de autenticação validados");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
