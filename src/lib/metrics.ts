import { prisma } from "@/lib/prisma";
import { monthLabel } from "@/lib/format";
import { LEAD_ORIGIN_LABELS, LEAD_STATUS_LABELS } from "@/lib/enums";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function lastNMonths(ref: Date, n: number): { month: number; year: number }[] {
  const out: { month: number; year: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    out.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }
  return out;
}

export type RevenueExpensePoint = {
  mes: string;
  receita: number;
  despesa: number;
};
export type OriginPoint = { origem: string; total: number };
export type PipelinePoint = { estagio: string; total: number; valor: number };
export type CostCenterPoint = { centro: string; valor: number };
export type ProjectMarginPoint = {
  projeto: string;
  orcado: number;
  custo: number;
  margem: number;
};

export type DashboardData = {
  receitaMes: number;
  despesaMes: number;
  lucroMes: number;
  mrr: number;
  arr: number;
  leadsNovos: number;
  propostasAbertas: number;
  contratosAtivos: number;
  projetosAndamento: number;
  tarefasAtrasadas: number;
  inadimplencia: number;
  forecastMes: number;
  orcadoReceitaMes: number;
  orcadoDespesaMes: number;
  receitaDespesaMensal: RevenueExpensePoint[];
  leadsPorOrigem: OriginPoint[];
  pipelinePorEstagio: PipelinePoint[];
  receitaPorCentro: CostCenterPoint[];
  margemPorProjeto: ProjectMarginPoint[];
};

export async function getDashboardData(
  ref: Date = new Date(),
): Promise<DashboardData> {
  const month = ref.getMonth() + 1;
  const year = ref.getFullYear();
  const monthStart = startOfMonth(ref);
  const months = lastNMonths(ref, 6);
  const earliest = new Date(months[0].year, months[0].month - 1, 1);

  const [
    receitaAgg,
    despesaAgg,
    forecastAgg,
    mrrAgg,
    leadsNovos,
    propostasAbertas,
    contratosAtivos,
    projetosAndamento,
    tarefasAtrasadas,
    inadimplenciaAgg,
    seriesRows,
    leadsOriginGroups,
    pipelineGroups,
    receitaCentroGroups,
    costCenters,
    projects,
    timesheetSums,
    budgetMesAgg,
  ] = await Promise.all([
    prisma.financialEntry.aggregate({
      _sum: { value: true },
      where: {
        type: "RECEITA",
        status: "PAGO",
        competenceMonth: month,
        competenceYear: year,
        deletedAt: null,
      },
    }),
    prisma.financialEntry.aggregate({
      _sum: { value: true },
      where: {
        type: "DESPESA",
        status: "PAGO",
        competenceMonth: month,
        competenceYear: year,
        deletedAt: null,
      },
    }),
    prisma.financialEntry.aggregate({
      _sum: { value: true },
      where: {
        type: "RECEITA",
        status: { in: ["PENDENTE", "PAGO", "ATRASADO"] },
        competenceMonth: month,
        competenceYear: year,
        deletedAt: null,
      },
    }),
    prisma.contract.aggregate({
      _sum: { monthlyValue: true },
      where: { status: "ATIVO", deletedAt: null, monthlyValue: { not: null } },
    }),
    prisma.lead.count({
      where: { deletedAt: null, createdAt: { gte: monthStart } },
    }),
    prisma.proposal.count({
      where: { deletedAt: null, status: { in: ["RASCUNHO", "ENVIADA"] } },
    }),
    prisma.contract.count({ where: { deletedAt: null, status: "ATIVO" } }),
    prisma.project.count({
      where: { deletedAt: null, status: "EM_ANDAMENTO" },
    }),
    prisma.task.count({
      where: {
        deletedAt: null,
        dueDate: { lt: ref },
        status: { notIn: ["CONCLUIDA", "CANCELADA"] },
      },
    }),
    prisma.financialEntry.aggregate({
      _sum: { value: true },
      where: {
        type: "RECEITA",
        status: { in: ["PENDENTE", "ATRASADO"] },
        dueDate: { lt: ref },
        deletedAt: null,
      },
    }),
    prisma.financialEntry.findMany({
      where: {
        status: "PAGO",
        deletedAt: null,
        OR: [
          { competenceYear: { gt: earliest.getFullYear() } },
          {
            competenceYear: earliest.getFullYear(),
            competenceMonth: { gte: earliest.getMonth() + 1 },
          },
        ],
      },
      select: {
        type: true,
        value: true,
        competenceMonth: true,
        competenceYear: true,
      },
    }),
    prisma.lead.groupBy({
      by: ["origin"],
      _count: { _all: true },
      where: { deletedAt: null },
    }),
    prisma.lead.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { estimatedValue: true },
      where: { deletedAt: null },
    }),
    prisma.financialEntry.groupBy({
      by: ["costCenterId"],
      _sum: { value: true },
      where: {
        type: "RECEITA",
        status: "PAGO",
        competenceYear: year,
        deletedAt: null,
      },
    }),
    prisma.costCenter.findMany({ select: { id: true, code: true, name: true } }),
    prisma.project.findMany({
      where: { deletedAt: null, budgetValue: { not: null } },
      select: { id: true, name: true, budgetValue: true, hourlyRate: true },
      orderBy: { budgetValue: "desc" },
      take: 6,
    }),
    prisma.timesheet.groupBy({
      by: ["projectId"],
      _sum: { hours: true },
    }),
    prisma.budget.aggregate({
      _sum: { plannedRevenue: true, plannedExpense: true },
      where: { deletedAt: null, periodType: "MENSAL", month, year, status: { in: ["APROVADO", "ATIVO"] } },
    }),
  ]);

  // Série receita x despesa por mês
  const seriesMap = new Map<string, RevenueExpensePoint>();
  for (const m of months) {
    const key = `${m.year}-${m.month}`;
    seriesMap.set(key, {
      mes: monthLabel(m.month, m.year),
      receita: 0,
      despesa: 0,
    });
  }
  for (const row of seriesRows) {
    const key = `${row.competenceYear}-${row.competenceMonth}`;
    const point = seriesMap.get(key);
    if (!point) continue;
    if (row.type === "RECEITA") point.receita += row.value;
    else point.despesa += row.value;
  }

  // Receita por centro de custo
  const ccById = new Map(costCenters.map((c) => [c.id, c]));
  const receitaPorCentro: CostCenterPoint[] = receitaCentroGroups
    .map((g) => {
      const cc = g.costCenterId ? ccById.get(g.costCenterId) : null;
      return {
        centro: cc ? `${cc.code} · ${cc.name}` : "Sem centro",
        valor: g._sum.value ?? 0,
      };
    })
    .filter((p) => p.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  // Margem por projeto
  const hoursByProject = new Map(
    timesheetSums.map((t) => [t.projectId, t._sum.hours ?? 0]),
  );
  const margemPorProjeto: ProjectMarginPoint[] = projects.map((p) => {
    const hours = hoursByProject.get(p.id) ?? 0;
    const custo = hours * (p.hourlyRate ?? 0);
    const orcado = p.budgetValue ?? 0;
    return {
      projeto: p.name.length > 22 ? p.name.slice(0, 22) + "…" : p.name,
      orcado,
      custo,
      margem: orcado - custo,
    };
  });

  const receitaMes = receitaAgg._sum.value ?? 0;
  const despesaMes = despesaAgg._sum.value ?? 0;
  const mrr = mrrAgg._sum.monthlyValue ?? 0;

  return {
    receitaMes,
    despesaMes,
    lucroMes: receitaMes - despesaMes,
    mrr,
    arr: mrr * 12,
    leadsNovos,
    propostasAbertas,
    contratosAtivos,
    projetosAndamento,
    tarefasAtrasadas,
    inadimplencia: inadimplenciaAgg._sum.value ?? 0,
    forecastMes: forecastAgg._sum.value ?? 0,
    orcadoReceitaMes: budgetMesAgg._sum.plannedRevenue ?? 0,
    orcadoDespesaMes: budgetMesAgg._sum.plannedExpense ?? 0,
    receitaDespesaMensal: Array.from(seriesMap.values()),
    leadsPorOrigem: leadsOriginGroups
      .map((g) => ({
        origem: LEAD_ORIGIN_LABELS[g.origin] ?? g.origin,
        total: g._count._all,
      }))
      .sort((a, b) => b.total - a.total),
    pipelinePorEstagio: pipelineGroups
      .map((g) => ({
        estagio: LEAD_STATUS_LABELS[g.status] ?? g.status,
        total: g._count._all,
        valor: g._sum.estimatedValue ?? 0,
      })),
    receitaPorCentro,
    margemPorProjeto,
  };
}
