import { prisma } from "@/lib/prisma";
import { monthLabel } from "@/lib/format";
import type { FinancialType, FinancialStatus, Prisma } from "@prisma/client";

export type CategoryAmount = { label: string; valor: number };
export type CostCenterResult = {
  centro: string;
  receita: number;
  despesa: number;
  lucro: number;
};

function lastNMonths(ref: Date, n: number) {
  const out: { month: number; year: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    out.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }
  return out;
}

export async function getFinanceOverview(ref: Date = new Date()) {
  const month = ref.getMonth() + 1;
  const year = ref.getFullYear();

  const [
    receitaMesAgg,
    despesaMesAgg,
    aReceberAgg,
    aPagarAgg,
    inadimplenciaAgg,
    catGroups,
    centroGroups,
    categories,
    costCenters,
  ] = await Promise.all([
    prisma.financialEntry.aggregate({
      _sum: { value: true },
      where: { deletedAt: null, type: "RECEITA", status: "PAGO", competenceMonth: month, competenceYear: year },
    }),
    prisma.financialEntry.aggregate({
      _sum: { value: true },
      where: { deletedAt: null, type: "DESPESA", status: "PAGO", competenceMonth: month, competenceYear: year },
    }),
    prisma.financialEntry.aggregate({
      _sum: { value: true },
      where: { deletedAt: null, type: "RECEITA", status: { in: ["PENDENTE", "ATRASADO"] } },
    }),
    prisma.financialEntry.aggregate({
      _sum: { value: true },
      where: { deletedAt: null, type: "DESPESA", status: { in: ["PENDENTE", "ATRASADO"] } },
    }),
    prisma.financialEntry.aggregate({
      _sum: { value: true },
      where: { deletedAt: null, type: "RECEITA", status: { in: ["PENDENTE", "ATRASADO"] }, dueDate: { lt: ref } },
    }),
    prisma.financialEntry.groupBy({
      by: ["categoryId", "type"],
      _sum: { value: true },
      where: { deletedAt: null, status: "PAGO", competenceYear: year },
    }),
    prisma.financialEntry.groupBy({
      by: ["costCenterId", "type"],
      _sum: { value: true },
      where: { deletedAt: null, status: "PAGO", competenceYear: year },
    }),
    prisma.financialCategory.findMany({ select: { id: true, code: true, name: true } }),
    prisma.costCenter.findMany({ select: { id: true, code: true, name: true } }),
  ]);

  const catName = new Map(categories.map((c) => [c.id, `${c.code} ${c.name}`]));
  const ccName = new Map(costCenters.map((c) => [c.id, `${c.code} · ${c.name}`]));

  const receitaPorCategoria: CategoryAmount[] = [];
  const despesaPorCategoria: CategoryAmount[] = [];
  for (const g of catGroups) {
    const label = g.categoryId ? (catName.get(g.categoryId) ?? "Sem categoria") : "Sem categoria";
    const valor = g._sum.value ?? 0;
    if (valor <= 0) continue;
    if (g.type === "RECEITA") receitaPorCategoria.push({ label, valor });
    else despesaPorCategoria.push({ label, valor });
  }
  receitaPorCategoria.sort((a, b) => b.valor - a.valor);
  despesaPorCategoria.sort((a, b) => b.valor - a.valor);

  const centroMap = new Map<string, CostCenterResult>();
  for (const g of centroGroups) {
    const key = g.costCenterId ?? "none";
    const centro = g.costCenterId ? (ccName.get(g.costCenterId) ?? "Sem centro") : "Sem centro";
    const entry = centroMap.get(key) ?? { centro, receita: 0, despesa: 0, lucro: 0 };
    if (g.type === "RECEITA") entry.receita += g._sum.value ?? 0;
    else entry.despesa += g._sum.value ?? 0;
    entry.lucro = entry.receita - entry.despesa;
    centroMap.set(key, entry);
  }

  const receitaMes = receitaMesAgg._sum.value ?? 0;
  const despesaMes = despesaMesAgg._sum.value ?? 0;

  return {
    month,
    year,
    receitaMes,
    despesaMes,
    lucroMes: receitaMes - despesaMes,
    aReceber: aReceberAgg._sum.value ?? 0,
    aPagar: aPagarAgg._sum.value ?? 0,
    inadimplencia: inadimplenciaAgg._sum.value ?? 0,
    receitaPorCategoria,
    despesaPorCategoria,
    lucroPorCentro: Array.from(centroMap.values()).sort((a, b) => b.lucro - a.lucro),
  };
}

export async function getDre(month: number, year: number) {
  const [receitaGroups, despesaGroups, categories] = await Promise.all([
    prisma.financialEntry.groupBy({
      by: ["categoryId"],
      _sum: { value: true },
      where: { deletedAt: null, type: "RECEITA", competenceMonth: month, competenceYear: year, status: { not: "CANCELADO" } },
    }),
    prisma.financialEntry.groupBy({
      by: ["categoryId"],
      _sum: { value: true },
      where: { deletedAt: null, type: "DESPESA", competenceMonth: month, competenceYear: year, status: { not: "CANCELADO" } },
    }),
    prisma.financialCategory.findMany({ select: { id: true, code: true, name: true } }),
  ]);

  const catName = new Map(categories.map((c) => [c.id, `${c.code} ${c.name}`]));
  const toRows = (groups: typeof receitaGroups): CategoryAmount[] =>
    groups
      .map((g) => ({
        label: g.categoryId ? (catName.get(g.categoryId) ?? "Sem categoria") : "Sem categoria",
        valor: g._sum.value ?? 0,
      }))
      .filter((r) => r.valor !== 0)
      .sort((a, b) => b.valor - a.valor);

  const receitas = toRows(receitaGroups);
  const despesas = toRows(despesaGroups);
  const totalReceita = receitas.reduce((s, r) => s + r.valor, 0);
  const totalDespesa = despesas.reduce((s, r) => s + r.valor, 0);

  return {
    receitas,
    despesas,
    totalReceita,
    totalDespesa,
    resultado: totalReceita - totalDespesa,
  };
}

// ─────────────── Contas a Pagar / Receber (visões sobre FinancialEntry) ───────────────

export type AccountRow = {
  id: string;
  description: string;
  value: number;
  dueDate: Date | null;
  paymentDate: Date | null;
  status: FinancialStatus;
  recurring: boolean;
  installmentNumber: number | null;
  installments: number | null;
  categoryLabel: string | null;
  costCenterLabel: string | null;
  partyLabel: string | null;
  daysOverdue: number;
};

export type AccountsData = {
  rows: AccountRow[];
  kpis: {
    aberto: number; // total em aberto (pendente + atrasado)
    vencido: number; // em aberto com vencimento passado
    aVencer: number; // em aberto com vencimento futuro/sem data
    liquidadoMes: number; // pago/recebido no mês de referência
    recorrenteMensal: number; // soma de itens recorrentes em aberto
  };
  aging: { label: string; valor: number }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Visão de contas a pagar (DESPESA) ou receber (RECEITA) sobre FinancialEntry.
 * Centraliza KPIs, aging (faixas de atraso) e a lista, com dias de atraso.
 */
export async function getAccounts(
  type: FinancialType,
  opts: { status?: string; q?: string; ref?: Date } = {},
): Promise<AccountsData> {
  const ref = opts.ref ?? new Date();
  const month = ref.getMonth() + 1;
  const year = ref.getFullYear();

  const where: Prisma.FinancialEntryWhereInput = { deletedAt: null, type };
  if (opts.status && ["PENDENTE", "PAGO", "ATRASADO", "CANCELADO"].includes(opts.status)) {
    where.status = opts.status as FinancialStatus;
  }
  if (opts.q) where.description = { contains: opts.q, mode: "insensitive" };

  const [entries, liquidadoAgg] = await Promise.all([
    prisma.financialEntry.findMany({
      where,
      include: {
        category: { select: { code: true, name: true } },
        costCenter: { select: { code: true, name: true } },
        client: { select: { name: true } },
        contract: { select: { title: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 300,
    }),
    prisma.financialEntry.aggregate({
      _sum: { value: true },
      where: {
        deletedAt: null,
        type,
        status: "PAGO",
        competenceMonth: month,
        competenceYear: year,
      },
    }),
  ]);

  const rows: AccountRow[] = entries.map((e) => {
    const overdue =
      e.dueDate && e.status !== "PAGO" && e.status !== "CANCELADO" && e.dueDate < ref
        ? Math.floor((ref.getTime() - e.dueDate.getTime()) / DAY_MS)
        : 0;
    return {
      id: e.id,
      description: e.description,
      value: e.value,
      dueDate: e.dueDate,
      paymentDate: e.paymentDate,
      status: e.status,
      recurring: e.recurring,
      installmentNumber: e.installmentNumber,
      installments: e.installments,
      categoryLabel: e.category ? `${e.category.code} ${e.category.name}` : null,
      costCenterLabel: e.costCenter ? `${e.costCenter.code} · ${e.costCenter.name}` : null,
      partyLabel: e.client?.name ?? e.contract?.title ?? null,
      daysOverdue: overdue,
    };
  });

  const open = rows.filter((r) => r.status === "PENDENTE" || r.status === "ATRASADO");
  const aberto = open.reduce((s, r) => s + r.value, 0);
  const vencido = open.filter((r) => r.daysOverdue > 0).reduce((s, r) => s + r.value, 0);
  const aVencer = aberto - vencido;
  const recorrenteMensal = open.filter((r) => r.recurring).reduce((s, r) => s + r.value, 0);

  // Aging por faixas.
  const buckets = [
    { label: "A vencer", test: (d: number) => d <= 0 },
    { label: "1–15 dias", test: (d: number) => d >= 1 && d <= 15 },
    { label: "16–30 dias", test: (d: number) => d >= 16 && d <= 30 },
    { label: "31–60 dias", test: (d: number) => d >= 31 && d <= 60 },
    { label: "60+ dias", test: (d: number) => d > 60 },
  ];
  const aging = buckets.map((b) => ({
    label: b.label,
    valor: open.filter((r) => b.test(r.daysOverdue)).reduce((s, r) => s + r.value, 0),
  }));

  return {
    rows,
    kpis: {
      aberto,
      vencido,
      aVencer,
      liquidadoMes: liquidadoAgg._sum.value ?? 0,
      recorrenteMensal,
    },
    aging,
  };
}

export type CashFlowPoint = {
  mes: string;
  entradas: number;
  saidas: number;
  saldo: number;
};

export async function getCashFlow(ref: Date = new Date(), n = 6): Promise<CashFlowPoint[]> {
  const months = lastNMonths(ref, n);
  const earliest = new Date(months[0].year, months[0].month - 1, 1);

  const rows = await prisma.financialEntry.findMany({
    where: { deletedAt: null, status: "PAGO", paymentDate: { gte: earliest } },
    select: { type: true, value: true, paymentDate: true },
  });

  const map = new Map<string, CashFlowPoint>();
  for (const m of months) {
    map.set(`${m.year}-${m.month}`, {
      mes: monthLabel(m.month, m.year),
      entradas: 0,
      saidas: 0,
      saldo: 0,
    });
  }
  for (const r of rows) {
    if (!r.paymentDate) continue;
    const key = `${r.paymentDate.getFullYear()}-${r.paymentDate.getMonth() + 1}`;
    const point = map.get(key);
    if (!point) continue;
    if (r.type === "RECEITA") point.entradas += r.value;
    else point.saidas += r.value;
    point.saldo = point.entradas - point.saidas;
  }
  return Array.from(map.values());
}
