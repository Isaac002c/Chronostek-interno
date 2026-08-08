import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";
import { defineTool, EMPTY_OBJECT_SCHEMA, type ToolDefinition } from "./types";

// Ferramentas do Theo (TI / Inovação) — SOMENTE LEITURA (§22). A Telun não possui
// um módulo dedicado de "chamados/tickets"; usamos Projetos (TI) e Ações
// Corretivas (incidentes/problemas de processo). Quando um dado não existe, o
// prompt orienta o Theo a informar isso — nunca inventar.

const getProjectsStatus = defineTool({
  slug: "get_projects_status",
  name: "Situação dos projetos",
  description:
    "Resumo dos projetos de tecnologia por status (planejado, em andamento, em revisão, entregue etc.), com quantidades.",
  category: "ti",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consultando a situação dos projetos",
  handler: async (_args, ctx) => {
    const scope = isAdmin(ctx.user.role) ? {} : { responsibleId: ctx.user.id };
    const groups = await prisma.project.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { deletedAt: null, ...scope },
    });
    return { porStatus: groups.map((g) => ({ status: g.status, quantidade: g._count._all })) };
  },
});

const getLateProjects = defineTool({
  slug: "get_late_projects",
  name: "Projetos atrasados",
  description:
    "Lista os projetos com prazo (deadline) vencido que ainda não foram entregues nem cancelados. Use para identificar atrasos técnicos.",
  category: "ti",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consultando projetos atrasados",
  handler: async (_args, ctx) => {
    const now = new Date();
    const scope = isAdmin(ctx.user.role) ? {} : { responsibleId: ctx.user.id };
    const projects = await prisma.project.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ["ENTREGUE", "CANCELADO"] },
        deadline: { lt: now },
        ...scope,
      },
      orderBy: [{ deadline: "asc" }],
      take: 20,
      select: { name: true, status: true, deadline: true, type: true },
    });
    return {
      quantidade: projects.length,
      projetos: projects.map((p) => ({
        nome: p.name,
        tipo: p.type,
        status: p.status,
        prazo: p.deadline ? p.deadline.toISOString().slice(0, 10) : "—",
      })),
    };
  },
});

const getOpenIncidents = defineTool({
  slug: "get_open_incidents",
  name: "Incidentes/ações abertas",
  description:
    "Lista as ações corretivas / incidentes em aberto (aberta ou em andamento), destacando as de prioridade alta/crítica. Representa problemas técnicos e operacionais que exigem atenção.",
  category: "ti",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consultando incidentes em aberto",
  handler: async () => {
    const actions = await prisma.correctiveAction.findMany({
      where: { status: { in: ["ABERTA", "EM_ANDAMENTO"] } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 20,
      select: { title: true, problem: true, priority: true, status: true, dueDate: true },
    });
    const criticos = actions.filter((a) => a.priority === "CRITICA" || a.priority === "ALTA").length;
    return {
      quantidade: actions.length,
      criticosOuAltos: criticos,
      itens: actions.map((a) => ({
        titulo: a.title,
        prioridade: a.priority,
        status: a.status,
        prazo: a.dueDate ? a.dueDate.toISOString().slice(0, 10) : "—",
      })),
    };
  },
});

export const THEO_TOOLS: ToolDefinition[] = [getProjectsStatus, getLateProjects, getOpenIncidents];
