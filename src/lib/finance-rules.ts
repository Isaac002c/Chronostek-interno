/**
 * Regras financeiras PURAS (sem I/O) — centralizadas e testáveis.
 *
 * Nada aqui importa prisma ou React: parcelamento, recorrência, competência,
 * status derivado, projeção com cenários e mapeamento da DRE. Coberto por
 * scripts/test-finance.ts (roda sem banco).
 */
import type {
  FinancialType,
  FinancialStatus,
  RecurringFrequency,
  DreGroup,
  CategoryType,
} from "@prisma/client";

// ─────────────── Dinheiro ───────────────

/** Arredonda para centavos (evita erro de ponto flutuante). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ─────────────── Parcelamento ───────────────

export type Installment = { number: number; value: number; dueDate: Date };

/**
 * Divide um total em N parcelas mensais. A última parcela absorve o resíduo
 * do arredondamento para que a soma feche exatamente com o total.
 */
export function splitInstallments(
  total: number,
  count: number,
  firstDueDate: Date,
): Installment[] {
  if (count <= 0) return [];
  const base = round2(total / count);
  const out: Installment[] = [];
  let acc = 0;
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const value = isLast ? round2(total - acc) : base;
    acc = round2(acc + value);
    out.push({
      number: i + 1,
      value,
      dueDate: addMonths(firstDueDate, i),
    });
  }
  return out;
}

// ─────────────── Datas / competência ───────────────

/** Soma meses preservando o fim de mês (31/jan + 1 mês = 28/29 fev). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export type Competence = { month: number; year: number };

export function competenceOf(date: Date): Competence {
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

/** Índice absoluto de competência (para comparar/ordenar meses). */
export function competenceIndex(c: Competence): number {
  return c.year * 12 + (c.month - 1);
}

/** Lista de competências de `from` até `to` (inclusive). */
export function competenceRange(from: Competence, to: Competence): Competence[] {
  const out: Competence[] = [];
  const start = competenceIndex(from);
  const end = competenceIndex(to);
  for (let i = start; i <= end; i++) {
    out.push({ year: Math.floor(i / 12), month: (i % 12) + 1 });
  }
  return out;
}

const FREQUENCY_MONTHS: Partial<Record<RecurringFrequency, number>> = {
  MENSAL: 1,
  BIMESTRAL: 2,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

const FREQUENCY_DAYS: Partial<Record<RecurringFrequency, number>> = {
  SEMANAL: 7,
  QUINZENAL: 15,
};

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Ocorrências de uma recorrência entre startDate e o horizonte (inclusive),
 * no dia `dayOfMonth`. Respeita endDate quando informado.
 */
export function recurrenceOccurrences(
  startDate: Date,
  horizon: Date,
  frequency: RecurringFrequency,
  dayOfMonth: number,
  endDate?: Date | null,
): Date[] {
  const limit = endDate && endDate < horizon ? endDate : horizon;
  const out: Date[] = [];
  const dayStep = FREQUENCY_DAYS[frequency];
  const monthStep = FREQUENCY_MONTHS[frequency];
  let cursor = dayStep ? new Date(startDate) : clampDay(startDate, dayOfMonth);
  let guard = 0;
  while (cursor <= limit && guard < 600) {
    if (cursor >= startDate) out.push(new Date(cursor));
    cursor = dayStep
      ? addDays(cursor, dayStep)
      : clampDay(addMonths(cursor, monthStep ?? 1), dayOfMonth);
    guard++;
  }
  return out;
}

export function clampDay(date: Date, day: number): Date {
  const d = new Date(date);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(Math.max(1, day), lastDay));
  return d;
}

export type RecurrencePlanInput = {
  startDate: Date;
  frequency: RecurringFrequency;
  dayOfMonth: number;
  totalOccurrences?: number | null;
  durationMonths?: number | null;
  endDate?: Date | null;
};

/**
 * Plano finito usado na criação imediata de uma série. Pelo menos um dos
 * limites (quantidade, duração ou data final) deve existir.
 */
export function buildRecurrencePlan(input: RecurrencePlanInput): Date[] {
  const count =
    input.totalOccurrences && input.totalOccurrences > 0
      ? Math.min(input.totalOccurrences, 600)
      : null;
  let horizon = input.endDate ? new Date(input.endDate) : null;

  if (input.durationMonths && input.durationMonths > 0) {
    const durationEnd = addMonths(input.startDate, input.durationMonths);
    durationEnd.setMilliseconds(durationEnd.getMilliseconds() - 1);
    if (!horizon || durationEnd < horizon) horizon = durationEnd;
  }

  if (!count && !horizon) {
    throw new Error("Informe quantidade, duração ou data final da recorrência.");
  }

  const safeHorizon = horizon ?? addMonths(input.startDate, 600);
  const dates = recurrenceOccurrences(
    input.startDate,
    safeHorizon,
    input.frequency,
    input.dayOfMonth,
    horizon,
  );
  return count ? dates.slice(0, count) : dates;
}

export type RecurrenceScope = "OCCURRENCE" | "FUTURE" | "SERIES";

export function recurrenceScopeSequences(
  sequences: readonly number[],
  current: number,
  scope: RecurrenceScope,
): number[] {
  if (scope === "OCCURRENCE") {
    return sequences.includes(current) ? [current] : [];
  }
  if (scope === "FUTURE") {
    return sequences.filter((sequence) => sequence >= current);
  }
  return [...sequences];
}

export function recurrenceIdempotencyKey(seriesId: string, sequence: number): string {
  if (!seriesId || !Number.isInteger(sequence) || sequence <= 0) {
    throw new Error("Série e sequência válidas são obrigatórias.");
  }
  return `${seriesId}:${sequence}`;
}

// ─────────────── Status derivado ───────────────

/**
 * Status EFETIVO de um lançamento a partir dos valores, sem depender do campo
 * status persistido (útil para exibição e alertas consistentes).
 */
export function deriveStatus(
  entry: {
    status: FinancialStatus;
    dueDate: Date | null;
    value: number;
    paidValue: number | null;
  },
  ref: Date = new Date(),
): FinancialStatus {
  if (entry.status === "CANCELADO" || entry.status === "RENEGOCIADO") return entry.status;
  const paid = entry.paidValue ?? 0;
  if (paid > 0 && paid < entry.value) return "PARCIAL";
  if (paid >= entry.value && entry.value > 0) return "PAGO";
  if (entry.status === "PAGO") return "PAGO";
  if (entry.dueDate && entry.dueDate < ref) return "ATRASADO";
  if (entry.status === "PREVISTO") return "PREVISTO";
  return "PENDENTE";
}

/** Valor ainda em aberto de um lançamento. */
export function outstanding(entry: { value: number; paidValue: number | null }): number {
  return round2(Math.max(0, entry.value - (entry.paidValue ?? 0)));
}

// ─────────────── DRE (mapeamento de grupos) ───────────────

export type DreLine = {
  group: DreGroup;
  label: string;
  /** Sinal na composição do resultado: +1 receita, -1 dedução/custo/despesa. */
  sign: 1 | -1;
};

export const DRE_LINES: DreLine[] = [
  { group: "RECEITA_BRUTA", label: "Receita bruta", sign: 1 },
  { group: "DEDUCOES", label: "(−) Deduções da receita", sign: -1 },
  { group: "CUSTOS_DIRETOS", label: "(−) Custos diretos", sign: -1 },
  { group: "DESPESAS_COMERCIAIS", label: "(−) Despesas comerciais", sign: -1 },
  { group: "DESPESAS_MARKETING", label: "(−) Despesas de marketing", sign: -1 },
  { group: "DESPESAS_TECNOLOGIA", label: "(−) Despesas de tecnologia", sign: -1 },
  { group: "DESPESAS_ADMINISTRATIVAS", label: "(−) Despesas administrativas", sign: -1 },
  { group: "DESPESAS_PESSOAS", label: "(−) Despesas com pessoas", sign: -1 },
  { group: "DESPESAS_FINANCEIRAS", label: "(−) Resultado financeiro", sign: -1 },
  { group: "INVESTIMENTOS", label: "(−) Investimentos", sign: -1 },
  { group: "OUTROS", label: "Outros", sign: -1 },
];

/**
 * Fallback de grupo DRE quando a categoria não tem dreGroup definido:
 * receitas → RECEITA_BRUTA; despesas → OUTROS (despesa não classificada).
 */
export function dreGroupFallback(
  type: CategoryType | FinancialType,
  dreGroup: DreGroup | null | undefined,
): DreGroup {
  if (dreGroup) return dreGroup;
  return type === "RECEITA" ? "RECEITA_BRUTA" : "OUTROS";
}

// ─────────────── Projeção com cenários ───────────────

export type Scenario = "conservador" | "base" | "otimista";

export type ScenarioFactors = {
  /** Fator aplicado às receitas não garantidas (oportunidades ponderadas). */
  revenue: number;
  /** Fator aplicado às despesas variáveis previstas. */
  expense: number;
};

export const SCENARIO_FACTORS: Record<Scenario, ScenarioFactors> = {
  conservador: { revenue: 0.8, expense: 1.1 },
  base: { revenue: 1.0, expense: 1.0 },
  otimista: { revenue: 1.15, expense: 0.95 },
};

export type MonthProjectionInput = {
  competence: Competence;
  /** Receita já contratada/garantida (contratos, recorrências, a receber). */
  committedRevenue: number;
  /** Receita não garantida (pipeline ponderado por probabilidade). */
  weightedRevenue: number;
  /** Despesas fixas/recorrentes previstas. */
  fixedExpense: number;
  /** Despesas variáveis previstas. */
  variableExpense: number;
};

export type MonthProjection = {
  competence: Competence;
  revenue: number;
  expense: number;
  result: number;
  endingBalance: number;
};

/**
 * Projeta saldo mês a mês para um cenário. `openingBalance` é o saldo inicial.
 * Receita = comprometida + ponderada×fatorReceita; Despesa = fixa + variável×fatorDespesa.
 */
export function projectScenario(
  months: MonthProjectionInput[],
  openingBalance: number,
  scenario: Scenario,
): MonthProjection[] {
  const f = SCENARIO_FACTORS[scenario];
  let balance = openingBalance;
  return months.map((m) => {
    const revenue = round2(m.committedRevenue + m.weightedRevenue * f.revenue);
    const expense = round2(m.fixedExpense + m.variableExpense * f.expense);
    const result = round2(revenue - expense);
    balance = round2(balance + result);
    return {
      competence: m.competence,
      revenue,
      expense,
      result,
      endingBalance: balance,
    };
  });
}
