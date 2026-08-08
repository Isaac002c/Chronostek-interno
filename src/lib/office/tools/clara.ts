import { z } from "zod";
import { getFinanceOverview, getAccounts, getCashFlow } from "@/lib/finance";
import { defineTool, EMPTY_OBJECT_SCHEMA, type ToolDefinition } from "./types";

// Ferramentas da Clara (Financeiro) — SOMENTE LEITURA (§20). Reutilizam os
// serviços reais do módulo financeiro (finance.ts). Nada é recriado aqui.

const brl = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const getFinancialSummary = defineTool({
  slug: "get_financial_summary",
  name: "Resumo financeiro",
  description:
    "Resumo financeiro do mês atual: receita e despesa realizadas, lucro, total a receber, total a pagar e inadimplência. Use para uma visão geral.",
  category: "financeiro",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consultando o resumo financeiro do mês",
  handler: async () => {
    const o = await getFinanceOverview();
    return {
      mesReferencia: `${String(o.month).padStart(2, "0")}/${o.year}`,
      receitaRealizadaMes: brl(o.receitaMes),
      despesaRealizadaMes: brl(o.despesaMes),
      lucroMes: brl(o.lucroMes),
      totalAReceber: brl(o.aReceber),
      totalAPagar: brl(o.aPagar),
      inadimplencia: brl(o.inadimplencia),
    };
  },
});

const getAccountsReceivable = defineTool({
  slug: "get_accounts_receivable",
  name: "Contas a receber",
  description:
    "Situação das contas a receber: total em aberto, total vencido, total a vencer, recebido no mês, e as faixas de atraso (aging). Use para saber quanto há para receber.",
  category: "financeiro",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consultando contas a receber",
  handler: async () => {
    const data = await getAccounts("RECEITA");
    return {
      emAberto: brl(data.kpis.aberto),
      vencido: brl(data.kpis.vencido),
      aVencer: brl(data.kpis.aVencer),
      recebidoNoMes: brl(data.kpis.liquidadoMes),
      recorrenteMensal: brl(data.kpis.recorrenteMensal),
      aging: data.aging.map((a) => ({ faixa: a.label, valor: brl(a.valor) })),
      titulosEmAberto: data.rows.filter((r) => r.status === "PENDENTE" || r.status === "ATRASADO").length,
    };
  },
});

const getOverdueReceivables = defineTool({
  slug: "get_overdue_receivables",
  name: "Recebíveis vencidos",
  description:
    "Lista os títulos a receber que estão vencidos (para cobrança), com cliente, valor e dias de atraso. Use para identificar inadimplência e quem cobrar.",
  category: "financeiro",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consultando recebíveis vencidos",
  handler: async () => {
    const data = await getAccounts("RECEITA");
    const overdue = data.rows
      .filter((r) => r.daysOverdue > 0 && (r.status === "PENDENTE" || r.status === "ATRASADO"))
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 15);
    return {
      totalVencido: brl(data.kpis.vencido),
      quantidade: overdue.length,
      titulos: overdue.map((r) => ({
        descricao: r.description,
        cliente: r.partyLabel ?? "—",
        valor: brl(r.value),
        vencimento: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : "—",
        diasEmAtraso: r.daysOverdue,
      })),
    };
  },
});

const getUpcomingDueDates = defineTool({
  slug: "get_upcoming_due_dates",
  name: "Próximos vencimentos",
  description:
    "Lista os títulos a receber que vencem nos próximos dias (padrão 7). Use para antecipar recebimentos e cobranças preventivas.",
  category: "financeiro",
  requiresApproval: false,
  jsonSchema: {
    type: "object",
    properties: { days: { type: "integer", minimum: 1, maximum: 90, description: "Janela em dias (padrão 7)." } },
    additionalProperties: false,
  },
  schema: z.object({ days: z.number().int().min(1).max(90).optional() }),
  runningLabel: (a) => `Consultando vencimentos dos próximos ${a?.days ?? 7} dias`,
  handler: async (args) => {
    const days = args?.days ?? 7;
    const now = new Date();
    const limit = new Date(now.getTime() + days * 864e5);
    const data = await getAccounts("RECEITA");
    const upcoming = data.rows
      .filter(
        (r) =>
          (r.status === "PENDENTE" || r.status === "ATRASADO") &&
          r.dueDate != null &&
          r.dueDate >= now &&
          r.dueDate <= limit,
      )
      .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()))
      .slice(0, 20);
    return {
      janelaDias: days,
      quantidade: upcoming.length,
      totalAVencer: brl(upcoming.reduce((s, r) => s + r.value, 0)),
      titulos: upcoming.map((r) => ({
        descricao: r.description,
        cliente: r.partyLabel ?? "—",
        valor: brl(r.value),
        vencimento: r.dueDate!.toISOString().slice(0, 10),
      })),
    };
  },
});

const getCashFlowTool = defineTool({
  slug: "get_cash_flow",
  name: "Fluxo de caixa",
  description:
    "Fluxo de caixa realizado dos últimos 6 meses (entradas, saídas e saldo por mês). Use para avaliar a tendência de caixa.",
  category: "financeiro",
  requiresApproval: false,
  jsonSchema: EMPTY_OBJECT_SCHEMA,
  schema: z.object({}),
  runningLabel: () => "Consultando o fluxo de caixa",
  handler: async () => {
    const points = await getCashFlow();
    return {
      meses: points.map((p) => ({ mes: p.mes, entradas: brl(p.entradas), saidas: brl(p.saidas), saldo: brl(p.saldo) })),
    };
  },
});

export const CLARA_TOOLS: ToolDefinition[] = [
  getFinancialSummary,
  getAccountsReceivable,
  getOverdueReceivables,
  getUpcomingDueDates,
  getCashFlowTool,
];
