import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { defineTool, EMPTY_OBJECT_SCHEMA, type ToolDefinition } from "./types";

// Ferramentas compartilhadas por todos os agentes (§19). Todas seguras: leem o
// contexto do próprio agente ou criam registros internos (tarefa/aprovação) —
// nunca acessam banco/SQL/infra diretamente.

const getCurrentUserContext = defineTool({
  slug: "get_current_user_context",
  name: "Contexto do usuário",
  description:
    "Retorna quem é o usuário humano com quem você conversa (nome, papel), a empresa e a data atual. Use para se situar antes de responder.",
  category: "shared",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consultando contexto do usuário",
  handler: async (_args, ctx) => ({
    user: { name: ctx.user.name, role: ctx.user.role },
    company: "Telun",
    today: new Date().toISOString().slice(0, 10),
  }),
});

const getAgentTasks = defineTool({
  slug: "get_agent_tasks",
  name: "Minhas tarefas",
  description: "Lista as tarefas atribuídas a você (o agente), com status e prioridade.",
  category: "shared",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consultando suas tarefas",
  handler: async (_args, ctx) => {
    const tasks = await prisma.agentTask.findMany({
      where: { agentId: ctx.agent.id, tenantId: ctx.tenantId },
      orderBy: [{ createdAt: "desc" }],
      take: 25,
      select: { title: true, status: true, priority: true, createdAt: true, completedAt: true },
    });
    return {
      count: tasks.length,
      tasks: tasks.map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt.toISOString().slice(0, 10),
      })),
    };
  },
});

const getAgentActivity = defineTool({
  slug: "get_agent_activity",
  name: "Meu histórico",
  description: "Lista as atividades recentes registradas por você (o agente).",
  category: "shared",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consultando seu histórico de atividades",
  handler: async (_args, ctx) => {
    const logs = await prisma.agentActivityLog.findMany({
      where: { agentId: ctx.agent.id, tenantId: ctx.tenantId },
      orderBy: [{ createdAt: "desc" }],
      take: 20,
      select: { type: true, title: true, createdAt: true },
    });
    return {
      count: logs.length,
      activities: logs.map((l) => ({ type: l.type, title: l.title, at: l.createdAt.toISOString() })),
    };
  },
});

const createInternalTaskArgs = z.object({
  title: z.string().min(3).max(160),
  description: z.string().max(2000).optional(),
  priority: z.enum(["BAIXA", "MEDIA", "ALTA", "CRITICA"]).optional(),
});

const createInternalTask = defineTool({
  slug: "create_internal_task",
  name: "Criar tarefa interna",
  description:
    "Cria uma tarefa interna segura para você (o agente) acompanhar. Use para registrar um acompanhamento ou próximo passo operacional. Não executa ações críticas.",
  category: "shared",
  requiresApproval: false,
  jsonSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Título curto e objetivo da tarefa." },
      description: { type: "string", description: "Detalhe opcional do que fazer." },
      priority: { type: "string", enum: ["BAIXA", "MEDIA", "ALTA", "CRITICA"] },
    },
    required: ["title"],
    additionalProperties: false,
  },
  schema: createInternalTaskArgs,
  runningLabel: (a) => `Criando tarefa interna: ${a.title}`,
  handler: async (args, ctx) => {
    const task = await prisma.agentTask.create({
      data: {
        tenantId: ctx.tenantId,
        agentId: ctx.agent.id,
        title: args.title,
        description: args.description ?? null,
        priority: args.priority ?? "MEDIA",
        status: "PENDING",
        source: "agent",
        createdById: ctx.user.id,
      },
      select: { id: true, title: true, status: true },
    });
    return { created: true, task };
  },
});

const requestApprovalArgs = z.object({
  title: z.string().min(3).max(160),
  description: z.string().max(2000).optional(),
  proposedAction: z.string().min(3).max(2000),
});

const requestApproval = defineTool({
  slug: "request_approval",
  name: "Solicitar aprovação",
  description:
    "Solicita aprovação humana para uma ação que você NÃO tem autonomia para executar (ex.: enviar cobrança externa, conceder desconto, alterar contrato). Descreve claramente a ação proposta. Não executa a ação — apenas registra o pedido para um humano decidir.",
  category: "shared",
  requiresApproval: false,
  jsonSchema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Resumo do que precisa de aprovação." },
      description: { type: "string", description: "Contexto e justificativa." },
      proposedAction: { type: "string", description: "A ação concreta proposta, em uma frase." },
    },
    required: ["title", "proposedAction"],
    additionalProperties: false,
  },
  schema: requestApprovalArgs,
  runningLabel: (a) => `Solicitando aprovação: ${a.title}`,
  handler: async (args, ctx) => {
    const approval = await prisma.agentApproval.create({
      data: {
        tenantId: ctx.tenantId,
        agentId: ctx.agent.id,
        conversationId: ctx.conversationId ?? null,
        taskId: ctx.taskId ?? null,
        requestedById: ctx.user.id,
        type: "AGENT_REQUEST",
        title: args.title,
        description: args.description ?? null,
        proposedAction: args.proposedAction,
        status: "PENDING",
      },
      select: { id: true, title: true, status: true },
    });
    return {
      requested: true,
      approval,
      note: "Pedido registrado. Um humano precisa aprovar antes de qualquer execução.",
    };
  },
});

const getPendingApprovals = defineTool({
  slug: "get_pending_approvals",
  name: "Aprovações pendentes",
  description: "Lista as solicitações de aprovação pendentes (aguardando decisão humana).",
  category: "shared",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consultando aprovações pendentes",
  handler: async (_args, ctx) => {
    // Atlas (executivo) vê todas; demais veem as próprias.
    const scopeAll = ctx.agent.department.toLowerCase().includes("executivo");
    const approvals = await prisma.agentApproval.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: "PENDING",
        ...(scopeAll ? {} : { agentId: ctx.agent.id }),
      },
      orderBy: [{ requestedAt: "asc" }],
      take: 25,
      select: { title: true, proposedAction: true, requestedAt: true, agent: { select: { name: true } } },
    });
    return {
      count: approvals.length,
      approvals: approvals.map((a) => ({
        title: a.title,
        proposedAction: a.proposedAction,
        agent: a.agent.name,
        requestedAt: a.requestedAt.toISOString().slice(0, 10),
      })),
    };
  },
});

export const SHARED_TOOLS: ToolDefinition[] = [
  getCurrentUserContext,
  getAgentTasks,
  getAgentActivity,
  createInternalTask,
  requestApproval,
  getPendingApprovals,
];
