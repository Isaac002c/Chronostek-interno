/**
 * Smoke test de persistência real.
 *
 * Requer um PostgreSQL descartável e ALLOW_INTEGRATION_TESTS=true. Todos os
 * registros são criados dentro de uma transação deliberadamente revertida.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

if (process.env.ALLOW_INTEGRATION_TESTS !== "true") {
  console.error(
    "Recusado: defina ALLOW_INTEGRATION_TESTS=true e use um banco descartável.",
  );
  process.exit(2);
}

const prisma = new PrismaClient();
const rollback = new Error("ROLLBACK_INTEGRATION_TEST");
const token = randomUUID();
const email = `integration-${token}@test.invalid`;
const costCenterCode = 900_000 + Math.floor(Math.random() * 90_000);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Falha: ${message}`);
}

async function main() {
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
  console.log("✓ migrations, transação, CRUD e relações validados; rollback confirmado");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
