import { prisma } from "@/lib/prisma";
import { monthLabel } from "@/lib/format";

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
