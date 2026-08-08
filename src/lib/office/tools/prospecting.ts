import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { saveProspect } from "@/lib/prospecting/repository";
import { defineTool, type ToolDefinition } from "./types";

const getProspects = defineTool({
  slug: "get_prospects", name: "Consultar prospects", category: "comercial", requiresApproval: false,
  description: "Consulta prospects do banco central Telun por classificação, fit e status.",
  jsonSchema: { type: "object", properties: { businessFit: { type: "string" }, qualification: { type: "string" }, limit: { type: "number" } }, additionalProperties: false },
  schema: z.object({ businessFit: z.enum(["TELUN_M_PLUS", "TELUN_TECHNOLOGY", "BOTH", "UNQUALIFIED"]).optional(), qualification: z.enum(["A", "B", "C", "D", "UNQUALIFIED"]).optional(), limit: z.number().int().min(1).max(50).default(20) }),
  runningLabel: () => "Consultando o banco de prospects",
  handler: async (args, ctx) => {
    const prospects = await prisma.prospect.findMany({
      where: { tenantId: ctx.tenantId, businessFit: args.businessFit, qualification: args.qualification },
      orderBy: { overallScore: "desc" }, take: args.limit,
      select: { id: true, companyName: true, segment: true, city: true, state: true, website: true, commercialPhone: true, commercialWhatsApp: true, commercialEmail: true, instagram: true, linkedin: true, marketingFitScore: true, technologyFitScore: true, overallScore: true, businessFit: true, qualification: true, status: true },
    });
    return { quantidade: prospects.length, prospects };
  },
});

const createProspect = defineTool({
  slug: "create_prospect", name: "Criar prospect", category: "comercial", mutation: true, requiresApproval: false,
  description: "Salva, normaliza, deduplica, pontua e classifica um prospect com proveniência obrigatória.",
  jsonSchema: { type: "object", required: ["companyName", "source"], properties: { companyName: { type: "string" }, segment: { type: "string" }, city: { type: "string" }, state: { type: "string" }, website: { type: "string" }, commercialPhone: { type: "string" }, commercialWhatsApp: { type: "string" }, commercialEmail: { type: "string" }, instagram: { type: "string" }, linkedin: { type: "string" }, source: { type: "string" }, sourceUrl: { type: "string" }, marketingSignals: { type: "array", items: { type: "string" } }, technologySignals: { type: "array", items: { type: "string" } }, painPoints: { type: "array", items: { type: "string" } } }, additionalProperties: false },
  schema: z.object({ companyName: z.string().min(1).max(200), segment: z.string().max(120).optional(), city: z.string().max(100).optional(), state: z.string().max(2).optional(), website: z.string().max(500).optional(), commercialPhone: z.string().max(40).optional(), commercialWhatsApp: z.string().max(40).optional(), commercialEmail: z.string().max(200).optional(), instagram: z.string().max(500).optional(), linkedin: z.string().max(500).optional(), source: z.string().min(1).max(80), sourceUrl: z.string().url().max(1_000).optional(), marketingSignals: z.array(z.string().max(300)).max(30).optional(), technologySignals: z.array(z.string().max(300)).max(30).optional(), painPoints: z.array(z.string().max(300)).max(30).optional() }),
  runningLabel: (args) => `Qualificando ${args.companyName}`,
  handler: async (args, ctx) => saveProspect(args, ctx.tenantId),
});

const getQualifiedAccounts = defineTool({
  slug: "get_qualified_accounts", name: "Contas qualificadas", category: "comercial", requiresApproval: false,
  description: "Lista contas A e B prontas para pesquisa e abordagem BDR.",
  jsonSchema: { type: "object", properties: { limit: { type: "number" } }, additionalProperties: false },
  schema: z.object({ limit: z.number().int().min(1).max(50).default(20) }), runningLabel: () => "Consultando contas A/B",
  handler: async (args, ctx) => prisma.prospect.findMany({ where: { tenantId: ctx.tenantId, qualification: { in: ["A", "B"] }, doNotContact: false }, orderBy: { overallScore: "desc" }, take: args.limit, include: { contacts: true, briefs: { take: 1, orderBy: { createdAt: "desc" } } } }),
});

const getMplusProspects = defineTool({
  slug: "get_mplus_prospects", name: "Prospects Telun M+", category: "marketing", requiresApproval: false,
  description: "Consulta prospects com alto fit de marketing para gerar insights agregados e rascunhos.",
  jsonSchema: { type: "object", properties: { segment: { type: "string" }, limit: { type: "number" } }, additionalProperties: false },
  schema: z.object({ segment: z.string().max(120).optional(), limit: z.number().int().min(1).max(50).default(30) }), runningLabel: () => "Analisando prospects Telun M+",
  handler: async (args, ctx) => prisma.prospect.findMany({ where: { tenantId: ctx.tenantId, segment: args.segment ? { contains: args.segment, mode: "insensitive" } : undefined, businessFit: { in: ["TELUN_M_PLUS", "BOTH"] }, doNotContact: false }, orderBy: { marketingFitScore: "desc" }, take: args.limit, select: { id: true, companyName: true, segment: true, marketingFitScore: true, digitalSignals: true, painPoints: true } }),
});

export const PROSPECTING_TOOLS: ToolDefinition[] = [getProspects, createProspect, getQualifiedAccounts, getMplusProspects];
