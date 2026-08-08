import { prisma } from "@/lib/prisma";
import { competenceOf } from "@/lib/finance-rules";
import { PROCESS_CATALOG, type ProcessSeed } from "./process-catalog";

/**
 * Governança dos 12 processos operacionais da Telun (§3/§10).
 *
 * Camada de ACOMPANHAMENTO — a execução acontece nos módulos (Comercial,
 * Financeiro, TI, Marketing, Jurídico). Os KPIs são calculados AO VIVO a partir
 * dos dados reais quando há fonte instrumentada (`kpiSource`); caso contrário a
 * tela mostra empty state — nunca um número inventado (§13).
 *
 * O catálogo puro fica em ./process-catalog (sem I/O, reutilizado pelo seed).
 */
export { PROCESS_CATALOG };
export type { ProcessSeed };

/** Semeia/atualiza os 12 processos (idempotente por [tenantId, code]). Não apaga nada. */
export async function seedProcesses(tenantId = "default"): Promise<number> {
  const costCenters = await prisma.costCenter.findMany({ select: { id: true, code: true } });
  const ccByCode = new Map(costCenters.map((c) => [c.code, c.id]));
  let n = 0;
  for (const p of PROCESS_CATALOG) {
    const costCenterId = ccByCode.get(p.costCenterCode) ?? null;
    await prisma.processDefinition.upsert({
      where: { tenantId_code: { tenantId, code: p.code } },
      update: {
        name: p.name,
        costCenterId,
        objective: p.objective,
        trigger: p.trigger,
        steps: p.steps,
        sla: p.sla,
        kpiPrimaryName: p.kpiPrimaryName,
        kpiPrimaryTarget: p.kpiPrimaryTarget,
        kpiPrimaryUnit: p.kpiPrimaryUnit,
        kpiSource: p.kpiSource,
        order: p.order,
      },
      create: {
        tenantId,
        code: p.code,
        name: p.name,
        costCenterId,
        objective: p.objective,
        trigger: p.trigger,
        steps: p.steps,
        sla: p.sla,
        kpiPrimaryName: p.kpiPrimaryName,
        kpiPrimaryTarget: p.kpiPrimaryTarget,
        kpiPrimaryUnit: p.kpiPrimaryUnit,
        kpiSource: p.kpiSource,
        status: "ATIVO",
        order: p.order,
      },
    });
    n++;
  }
  return n;
}

export type KpiValue = { value: number; unit: string; hasSource: boolean };

/**
 * Calcula, ao vivo, os KPIs que têm fonte instrumentada. Chaves sem fonte
 * retornam hasSource=false (a tela mostra empty state — nunca número mockado).
 */
export async function computeProcessKpis(ref = new Date()): Promise<Record<string, KpiValue>> {
  const { month, year } = competenceOf(ref);
  const [leadsMes, propostasAbertas, receberVencido, receberTotal, faturamentoMes, contratosRenov, projetosAndamento, mrr] =
    await Promise.all([
      prisma.lead.count({ where: { deletedAt: null, createdAt: { gte: new Date(year, month - 1, 1) } } }),
      prisma.proposal.aggregate({ _sum: { value: true }, where: { deletedAt: null, status: { in: ["RASCUNHO", "ENVIADA"] } } }),
      prisma.financialEntry.findMany({
        where: { deletedAt: null, type: "RECEITA", status: { in: ["PENDENTE", "ATRASADO", "PARCIAL"] }, dueDate: { lt: ref } },
        select: { value: true, paidValue: true },
      }),
      prisma.financialEntry.aggregate({ _sum: { value: true }, where: { deletedAt: null, type: "RECEITA", status: { in: ["PENDENTE", "ATRASADO", "PARCIAL"] } } }),
      prisma.financialEntry.aggregate({ _sum: { value: true }, where: { deletedAt: null, type: "RECEITA", competenceMonth: month, competenceYear: year, status: { not: "CANCELADO" } } }),
      prisma.contract.count({ where: { deletedAt: null, status: { in: ["ATIVO", "RENOVACAO_PROXIMA"] }, endDate: { gte: ref, lte: new Date(ref.getTime() + 60 * 864e5) } } }),
      prisma.project.count({ where: { deletedAt: null, status: "EM_ANDAMENTO" } }),
      prisma.contract.aggregate({ _sum: { monthlyValue: true }, where: { deletedAt: null, status: { in: ["ATIVO", "RENOVACAO_PROXIMA", "INADIMPLENTE", "EM_RISCO"] } } }),
    ]);

  const vencido = receberVencido.reduce((s, e) => s + Math.max(0, e.value - (e.paidValue ?? 0)), 0);
  const totalReceber = receberTotal._sum.value ?? 0;

  return {
    leads_novos_mes: { value: leadsMes, unit: "un", hasSource: true },
    pipeline_aberto: { value: propostasAbertas._sum.value ?? 0, unit: "R$", hasSource: true },
    receber_vencido: { value: vencido, unit: "R$", hasSource: true },
    inadimplencia_pct: { value: totalReceber > 0 ? (vencido / totalReceber) * 100 : 0, unit: "%", hasSource: totalReceber > 0 },
    faturamento_mes: { value: faturamentoMes._sum.value ?? 0, unit: "R$", hasSource: true },
    contratos_renovacao: { value: contratosRenov, unit: "un", hasSource: true },
    projetos_andamento: { value: projetosAndamento, unit: "un", hasSource: true },
    mrr_ativo: { value: mrr._sum.monthlyValue ?? 0, unit: "R$", hasSource: true },
  };
}

export type ProcessRow = {
  id: string;
  code: string;
  name: string;
  costCenterLabel: string | null;
  ownerName: string | null;
  status: string;
  objective: string | null;
  sla: string | null;
  kpiPrimaryName: string | null;
  kpiPrimaryTarget: string | null;
  kpi: KpiValue | null;
  nextReviewAt: Date | null;
  lastReviewAt: Date | null;
};

/**
 * Retorna os processos (do banco) com o valor de KPI ao vivo anexado.
 * Se o banco ainda não foi semeado, cai no catálogo estático (somente leitura).
 */
export async function getProcessGovernance(tenantId = "default"): Promise<ProcessRow[]> {
  const [rows, kpis] = await Promise.all([
    prisma.processDefinition.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { order: "asc" },
      include: { costCenter: { select: { code: true, name: true } }, owner: { select: { name: true } } },
    }),
    computeProcessKpis(),
  ]);

  if (rows.length > 0) {
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      costCenterLabel: r.costCenter ? `${r.costCenter.code} · ${r.costCenter.name}` : null,
      ownerName: r.owner?.name ?? null,
      status: r.status,
      objective: r.objective,
      sla: r.sla,
      kpiPrimaryName: r.kpiPrimaryName,
      kpiPrimaryTarget: r.kpiPrimaryTarget,
      kpi: r.kpiSource ? (kpis[r.kpiSource] ?? null) : null,
      nextReviewAt: r.nextReviewAt,
      lastReviewAt: r.lastReviewAt,
    }));
  }

  // Fallback: catálogo estático (banco não semeado ainda).
  return PROCESS_CATALOG.map((p) => ({
    id: p.code,
    code: p.code,
    name: p.name,
    costCenterLabel: `${p.costCenterCode}`,
    ownerName: null,
    status: "ATIVO",
    objective: p.objective,
    sla: p.sla,
    kpiPrimaryName: p.kpiPrimaryName,
    kpiPrimaryTarget: p.kpiPrimaryTarget,
    kpi: p.kpiSource ? (kpis[p.kpiSource] ?? null) : null,
    nextReviewAt: null,
    lastReviewAt: null,
  }));
}
