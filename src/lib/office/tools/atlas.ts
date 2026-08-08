import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMyOperation } from "@/lib/operation";
import { defineTool, EMPTY_OBJECT_SCHEMA, type ToolDefinition } from "./types";

// Ferramentas do Atlas (Chief of Staff) — visão operacional agregada (§23).
// Respeita o RBAC do usuário: getMyOperation já filtra por permissão/escopo.
// Atlas consulta → organiza → prioriza → resume → recomenda (nunca inventa KPIs).

const getCompanyOperationalSummary = defineTool({
  slug: "get_company_operational_summary",
  name: "Resumo operacional",
  description:
    "Consolida o que precisa de atenção na operação da Telun agora: follow-ups comerciais, propostas aguardando, títulos vencidos, contratos a renovar, prazos jurídicos e tarefas atrasadas — respeitando as permissões do usuário. Retorna as contagens por área.",
  category: "executivo",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consolidando o resumo operacional da empresa",
  handler: async (_args, ctx) => {
    const op = await getMyOperation({ id: ctx.user.id, role: ctx.user.role });
    return {
      totalPendencias: op.total,
      porArea: op.sections.map((s) => ({ area: s.label, quantidade: s.count })),
    };
  },
});

const getOperationalAlerts = defineTool({
  slug: "get_operational_alerts",
  name: "Alertas operacionais",
  description:
    "Lista os itens mais urgentes (vencidos ou sem próxima ação) da operação, por área, para priorização. Baseado em dados reais; não inventa alertas.",
  category: "executivo",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Levantando alertas operacionais",
  handler: async (_args, ctx) => {
    const op = await getMyOperation({ id: ctx.user.id, role: ctx.user.role });
    const alerts = op.sections
      .flatMap((s) => s.items.filter((i) => i.overdue).map((i) => ({ area: s.label, item: i.title, detalhe: i.subtitle })))
      .slice(0, 15);
    return { quantidade: alerts.length, alertas: alerts };
  },
});

const getAgentSummary = defineTool({
  slug: "get_agent_summary",
  name: "Resumo dos agentes",
  description:
    "Resumo dos funcionários digitais: quantos existem, status atual, tarefas abertas e agentes em erro. Use para supervisionar a operação digital.",
  category: "executivo",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consultando o resumo dos agentes",
  handler: async (_args, ctx) => {
    const [byStatus, openTasks, pendingApprovals] = await Promise.all([
      prisma.agent.groupBy({
        by: ["status"],
        _count: { _all: true },
        where: { tenantId: ctx.tenantId, isActive: true },
      }),
      prisma.agentTask.count({
        where: { tenantId: ctx.tenantId, status: { in: ["PENDING", "QUEUED", "RUNNING", "WAITING_APPROVAL"] } },
      }),
      prisma.agentApproval.count({ where: { tenantId: ctx.tenantId, status: "PENDING" } }),
    ]);
    return {
      agentesPorStatus: byStatus.map((g) => ({ status: g.status, quantidade: g._count._all })),
      tarefasAbertas: openTasks,
      aprovacoesPendentes: pendingApprovals,
      agentesEmErro: byStatus.find((g) => g.status === "ERROR")?._count._all ?? 0,
    };
  },
});

export const ATLAS_TOOLS: ToolDefinition[] = [
  getCompanyOperationalSummary,
  getOperationalAlerts,
  getAgentSummary,
];
