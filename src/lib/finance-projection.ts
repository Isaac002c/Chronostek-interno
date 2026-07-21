import { prisma } from "@/lib/prisma";
import {
  competenceRange,
  competenceIndex,
  recurrenceOccurrences,
  outstanding,
  projectScenario,
  round2,
  type Competence,
  type MonthProjectionInput,
  type MonthProjection,
  type Scenario,
} from "@/lib/finance-rules";

export type ProjectionResult = {
  months: Competence[];
  openingBalance: number;
  inputs: MonthProjectionInput[];
  scenarios: Record<Scenario, MonthProjection[]>;
  finalBalance: Record<Scenario, number>;
};

/**
 * Projeção de caixa do mês atual até dezembro, com 3 cenários.
 *
 * Premissas (documentadas na tela):
 * - Saldo inicial = saldo das contas bancárias + realizado líquido pago até hoje.
 * - Receita comprometida = contas a receber em aberto (por competência) +
 *   ocorrências de recorrências de receita.
 * - Despesa fixa = ocorrências de recorrências de despesa; variável = contas a
 *   pagar em aberto por competência.
 * - Receita ponderada = pipeline (propostas abertas) × probabilidade, alocada no
 *   mês da data esperada. NÃO é receita garantida.
 */
export async function getProjection(ref: Date = new Date()): Promise<ProjectionResult> {
  const from: Competence = { month: ref.getMonth() + 1, year: ref.getFullYear() };
  const to: Competence = { month: 12, year: ref.getFullYear() };
  const months = competenceRange(from, to);
  const horizon = new Date(to.year, to.month, 0); // último dia de dezembro

  const [banks, paidAgg, openEntries, recurrences, proposals] = await Promise.all([
    prisma.bankAccount.aggregate({ _sum: { initialBalance: true }, where: { deletedAt: null, active: true } }),
    prisma.financialEntry.findMany({
      where: { deletedAt: null, status: "PAGO" },
      select: { type: true, value: true, paidValue: true },
    }),
    prisma.financialEntry.findMany({
      where: {
        deletedAt: null,
        status: { in: ["PREVISTO", "PENDENTE", "ATRASADO", "PARCIAL"] },
      },
      select: { type: true, value: true, paidValue: true, competenceMonth: true, competenceYear: true },
    }),
    prisma.recurringEntry.findMany({
      where: { deletedAt: null, active: true },
      select: { type: true, value: true, frequency: true, dayOfMonth: true, startDate: true, endDate: true },
    }),
    prisma.proposal.findMany({
      where: { deletedAt: null, status: { in: ["RASCUNHO", "ENVIADA"] } },
      select: { value: true, probability: true, expectedDate: true },
    }),
  ]);

  // Saldo inicial = contas bancárias + realizado líquido.
  const bankBase = banks._sum.initialBalance ?? 0;
  const realizedNet = paidAgg.reduce((s, e) => {
    const v = e.paidValue ?? e.value;
    return s + (e.type === "RECEITA" ? v : -v);
  }, 0);
  const openingBalance = round2(bankBase + realizedNet);

  // Indexa por competência.
  const idx = (c: Competence) => competenceIndex(c);
  const bucket = new Map<number, MonthProjectionInput>();
  for (const c of months) {
    bucket.set(idx(c), {
      competence: c,
      committedRevenue: 0,
      weightedRevenue: 0,
      fixedExpense: 0,
      variableExpense: 0,
    });
  }

  // Contas em aberto por competência (comprometido / variável).
  for (const e of openEntries) {
    const key = idx({ month: e.competenceMonth, year: e.competenceYear });
    const b = bucket.get(key);
    if (!b) continue;
    const out = outstanding({ value: e.value, paidValue: e.paidValue });
    if (e.type === "RECEITA") b.committedRevenue += out;
    else b.variableExpense += out;
  }

  // Recorrências (receita comprometida / despesa fixa).
  for (const r of recurrences) {
    const occ = recurrenceOccurrences(r.startDate, horizon, r.frequency, r.dayOfMonth, r.endDate);
    for (const d of occ) {
      const key = idx({ month: d.getMonth() + 1, year: d.getFullYear() });
      const b = bucket.get(key);
      if (!b) continue;
      if (r.type === "RECEITA") b.committedRevenue += r.value;
      else b.fixedExpense += r.value;
    }
  }

  // Pipeline ponderado (não garantido).
  for (const p of proposals) {
    const when = p.expectedDate ?? ref;
    const key = idx({ month: when.getMonth() + 1, year: when.getFullYear() });
    const b = bucket.get(key);
    if (!b) continue;
    const prob = (p.probability ?? 50) / 100;
    b.weightedRevenue += p.value * prob;
  }

  const inputs = months.map((c) => {
    const b = bucket.get(idx(c))!;
    return {
      ...b,
      committedRevenue: round2(b.committedRevenue),
      weightedRevenue: round2(b.weightedRevenue),
      fixedExpense: round2(b.fixedExpense),
      variableExpense: round2(b.variableExpense),
    };
  });

  const scenarios = {
    conservador: projectScenario(inputs, openingBalance, "conservador"),
    base: projectScenario(inputs, openingBalance, "base"),
    otimista: projectScenario(inputs, openingBalance, "otimista"),
  };

  return {
    months,
    openingBalance,
    inputs,
    scenarios,
    finalBalance: {
      conservador: scenarios.conservador.at(-1)?.endingBalance ?? openingBalance,
      base: scenarios.base.at(-1)?.endingBalance ?? openingBalance,
      otimista: scenarios.otimista.at(-1)?.endingBalance ?? openingBalance,
    },
  };
}
