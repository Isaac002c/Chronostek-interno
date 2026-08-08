import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/rbac";
import { defineTool, EMPTY_OBJECT_SCHEMA, type ToolDefinition } from "./types";

// Ferramentas do Lucas (Comercial) — SOMENTE LEITURA (§21) sobre Lead/Proposal.
// Respeitam o escopo do usuário: não-admin vê apenas os próprios registros.

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const getSalesPipeline = defineTool({
  slug: "get_sales_pipeline",
  name: "Funil de vendas",
  description:
    "Resumo do funil comercial: quantidade e valor estimado de leads por estágio (status). Use para entender o pipeline.",
  category: "comercial",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consultando o funil de vendas",
  handler: async (_args, ctx) => {
    const scope = isAdmin(ctx.user.role) ? {} : { responsibleId: ctx.user.id };
    const groups = await prisma.lead.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { estimatedValue: true },
      where: { deletedAt: null, ...scope },
    });
    return {
      estagios: groups.map((g) => ({
        estagio: g.status,
        quantidade: g._count._all,
        valorEstimado: brl(g._sum.estimatedValue ?? 0),
      })),
    };
  },
});

const getOpenLeads = defineTool({
  slug: "get_open_leads",
  name: "Leads em aberto",
  description: "Lista os leads ativos (não ganhos nem perdidos), com estágio e próxima ação.",
  category: "comercial",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consultando leads em aberto",
  handler: async (_args, ctx) => {
    const scope = isAdmin(ctx.user.role) ? {} : { responsibleId: ctx.user.id };
    const leads = await prisma.lead.findMany({
      where: { deletedAt: null, status: { notIn: ["GANHO", "PERDIDO"] }, ...scope },
      orderBy: [{ updatedAt: "desc" }],
      take: 20,
      select: { name: true, company: true, status: true, nextAction: true, estimatedValue: true },
    });
    return {
      quantidade: leads.length,
      leads: leads.map((l) => ({
        nome: l.name,
        empresa: l.company ?? "—",
        estagio: l.status,
        proximaAcao: l.nextAction ?? "Sem próxima ação definida",
        valorEstimado: l.estimatedValue != null ? brl(l.estimatedValue) : "—",
      })),
    };
  },
});

const getLeadsNeedingFollowup = defineTool({
  slug: "get_leads_needing_followup",
  name: "Leads para follow-up",
  description:
    "Lista os leads ativos que precisam de follow-up: com próxima ação vencida ou sem próxima ação definida. Use para priorizar contatos.",
  category: "comercial",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consultando leads que precisam de follow-up",
  handler: async (_args, ctx) => {
    const now = new Date();
    const scope = isAdmin(ctx.user.role) ? {} : { responsibleId: ctx.user.id };
    const leads = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ["GANHO", "PERDIDO"] },
        OR: [{ nextActionAt: { lte: now } }, { nextActionAt: null }],
        ...scope,
      },
      orderBy: [{ nextActionAt: "asc" }],
      take: 20,
      select: { name: true, company: true, status: true, nextAction: true, nextActionAt: true },
    });
    return {
      quantidade: leads.length,
      leads: leads.map((l) => ({
        nome: l.name,
        empresa: l.company ?? "—",
        estagio: l.status,
        proximaAcao: l.nextAction ?? "Sem próxima ação definida",
        prazo: l.nextActionAt ? l.nextActionAt.toISOString().slice(0, 10) : "vencido/indefinido",
      })),
    };
  },
});

const getOpenProposals = defineTool({
  slug: "get_open_proposals",
  name: "Propostas em aberto",
  description: "Lista as propostas enviadas que ainda aguardam retorno do cliente, com valor e follow-up.",
  category: "comercial",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consultando propostas em aberto",
  handler: async () => {
    const proposals = await prisma.proposal.findMany({
      where: { deletedAt: null, status: "ENVIADA" },
      orderBy: [{ nextActionAt: "asc" }],
      take: 20,
      select: { title: true, value: true, nextAction: true, expectedDate: true, client: { select: { name: true } } },
    });
    return {
      quantidade: proposals.length,
      valorTotal: brl(proposals.reduce((s, p) => s + p.value, 0)),
      propostas: proposals.map((p) => ({
        titulo: p.title,
        cliente: p.client?.name ?? "—",
        valor: brl(p.value),
        proximaAcao: p.nextAction ?? "Sem follow-up programado",
      })),
    };
  },
});

export const LUCAS_TOOLS: ToolDefinition[] = [
  getSalesPipeline,
  getOpenLeads,
  getLeadsNeedingFollowup,
  getOpenProposals,
];
