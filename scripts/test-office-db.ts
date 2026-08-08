import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { seedOffice } from "../src/lib/office/seed";
import { getAllowedToolSlugs } from "../src/lib/office/agents";
import { executeToolCall } from "../src/lib/office/tool-runner";

function assertIsolatedDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (
    process.env.ALLOW_OFFICE_DB_TEST !== "true" ||
    !databaseUrl ||
    !new URL(databaseUrl).pathname.includes("office_rehearsal")
  ) {
    throw new Error(
      "Teste recusado: use banco isolado com 'office_rehearsal' no nome e ALLOW_OFFICE_DB_TEST=true.",
    );
  }
}

async function main() {
  assertIsolatedDatabase();
  const marker = randomUUID();
  const emails = {
    ti: `office-ti-${marker}@example.invalid`,
    finance: `office-finance-${marker}@example.invalid`,
    viewer: `office-viewer-${marker}@example.invalid`,
  };
  const createdUserIds: string[] = [];

  try {
    process.env.AI_PROVIDER = "groq";
    await seedOffice(prisma);
    await seedOffice(prisma);

    const [agents, toolCount, permissionCount] = await Promise.all([
      prisma.agent.findMany({
        where: { tenantId: "default", isActive: true },
        orderBy: { slug: "asc" },
      }),
      prisma.agentTool.count({ where: { tenantId: "default", isActive: true } }),
      prisma.agentToolPermission.count({
        where: { agent: { tenantId: "default", isActive: true }, access: "ALLOW" },
      }),
    ]);
    assert.deepEqual(agents.map((agent) => agent.slug), ["atlas", "clara", "lucas", "theo"]);
    assert(agents.every((agent) => agent.autonomyLevel === 1));
    assert(agents.every((agent) => agent.aiProvider === "groq"));
    assert.equal(toolCount, 21);
    assert.equal(permissionCount, 39);

    const users = await Promise.all([
      prisma.user.create({
        data: {
          name: `TI Office ${marker}`,
          email: emails.ti,
          passwordHash: "$2a$12$fixture.only.not.a.production.credential.0000000000000000000",
          role: "TI",
          status: "ATIVO",
        },
      }),
      prisma.user.create({
        data: {
          name: `Finance Office ${marker}`,
          email: emails.finance,
          passwordHash: "$2a$12$fixture.only.not.a.production.credential.0000000000000000000",
          role: "FINANCEIRO",
          status: "ATIVO",
        },
      }),
      prisma.user.create({
        data: {
          name: `Viewer Office ${marker}`,
          email: emails.viewer,
          passwordHash: "$2a$12$fixture.only.not.a.production.credential.0000000000000000000",
          role: "VIEWER",
          status: "ATIVO",
        },
      }),
    ]);
    createdUserIds.push(...users.map((user) => user.id));
    const [tiUser, financeUser, viewerUser] = users;
    const clara = agents.find((agent) => agent.slug === "clara");
    const theo = agents.find((agent) => agent.slug === "theo");
    assert(clara && theo);
    const [claraAllowed, theoAllowed] = await Promise.all([
      getAllowedToolSlugs(clara.id),
      getAllowedToolSlugs(theo.id),
    ]);

    // A Clara possui a tool financeira, mas a sessão TI não: o RBAC humano
    // deve bloquear antes de qualquer serviço financeiro ser consultado.
    const crossDepartment = await executeToolCall(
      { id: "cross-1", name: "get_financial_summary", arguments: {} },
      { user: tiUser, agent: clara, tenantId: "default" },
      claraAllowed,
    );
    assert.equal(crossDepartment.ok, false);
    assert.match(crossDepartment.error ?? "", /perfil não possui acesso/i);

    const forbiddenTool = await executeToolCall(
      { id: "forbidden-1", name: "get_financial_summary", arguments: {} },
      { user: tiUser, agent: theo, tenantId: "default" },
      theoAllowed,
    );
    assert.equal(forbiddenTool.ok, false);
    assert.match(forbiddenTool.error ?? "", /Sem permissão/i);

    const viewerTaskCountBefore = await prisma.agentTask.count({
      where: { agentId: clara.id, createdById: viewerUser.id },
    });
    const viewerMutation = await executeToolCall(
      {
        id: "viewer-1",
        name: "create_internal_task",
        arguments: { title: "Mudar dado via perfil somente leitura" },
      },
      { user: viewerUser, agent: clara, tenantId: "default" },
      claraAllowed,
    );
    assert.equal(viewerMutation.ok, false);
    assert.match(viewerMutation.error ?? "", /somente para leitura/i);
    assert.equal(
      await prisma.agentTask.count({ where: { agentId: clara.id, createdById: viewerUser.id } }),
      viewerTaskCountBefore,
    );

    const approvalFlow = await executeToolCall(
      {
        id: "approval-1",
        name: "request_approval",
        arguments: {
          title: "Autorizar desconto de 50%",
          description: "Solicitação controlada do ensaio do Office.",
          proposedAction: "Conceder desconto de 50% ao cliente após decisão humana.",
        },
      },
      { user: financeUser, agent: clara, tenantId: "default" },
      claraAllowed,
    );
    assert.equal(approvalFlow.ok, true);
    assert.equal(
      await prisma.agentApproval.count({
        where: { agentId: clara.id, requestedById: financeUser.id, status: "PENDING" },
      }),
      1,
    );

    const blockedLogs = await prisma.agentActivityLog.count({
      where: {
        userId: { in: [tiUser.id, viewerUser.id] },
        type: "TOOL_ERROR",
      },
    });
    assert(blockedLogs >= 3);

    console.log(JSON.stringify({
      ok: true,
      agents: agents.length,
      tools: toolCount,
      permissions: permissionCount,
      autonomyLevel1: true,
      seedIdempotent: true,
      crossDepartmentBlocked: true,
      forbiddenToolBlocked: true,
      readOnlyMutationBlocked: true,
      approvalCreated: true,
      blockedAttemptsLogged: blockedLogs,
    }));
  } finally {
    await prisma.agentActivityLog.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.agentApproval.deleteMany({ where: { requestedById: { in: createdUserIds } } });
    await prisma.agentTask.deleteMany({ where: { createdById: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : "Erro desconhecido.",
  }));
  process.exit(1);
});
