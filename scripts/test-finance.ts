/**
 * Testes das regras financeiras PURAS (não precisam de banco).
 * Rode com: npm run test:finance
 */
import assert from "node:assert/strict";
import {
  round2,
  splitInstallments,
  addMonths,
  competenceRange,
  competenceIndex,
  recurrenceOccurrences,
  buildRecurrencePlan,
  recurrenceIdempotencyKey,
  recurrenceScopeSequences,
  deriveStatus,
  outstanding,
  projectScenario,
  dreGroupFallback,
  type MonthProjectionInput,
} from "../src/lib/finance-rules";
import { buildMonthByMonth } from "../src/lib/finance-monthly";
import {
  DreFormulaError,
  evaluateDreFormulas,
  parseDreFormula,
  validateDreFormulaRows,
} from "../src/lib/dre-formula";
import {
  DEFAULT_PROJECTION_LINES,
  effectiveProjectionValue,
} from "../src/lib/finance-projections";
import { canFinance } from "../src/lib/finance-permissions";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("Regras financeiras — testes:");

test("round2 corrige ponto flutuante", () => {
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round2(5.555), 5.56);
  assert.equal(round2(2.674), 2.67);
});

test("splitInstallments soma exatamente o total", () => {
  const parts = splitInstallments(100, 3, new Date(2026, 0, 10));
  assert.equal(parts.length, 3);
  const sum = round2(parts.reduce((s, p) => s + p.value, 0));
  assert.equal(sum, 100);
  // última parcela absorve o resíduo (100/3 = 33.33, 33.33, 33.34)
  assert.equal(parts[0].value, 33.33);
  assert.equal(parts[2].value, 33.34);
});

test("splitInstallments avança vencimentos mês a mês", () => {
  const parts = splitInstallments(300, 3, new Date(2026, 0, 15));
  assert.equal(parts[1].dueDate.getMonth(), 1); // fev
  assert.equal(parts[2].dueDate.getMonth(), 2); // mar
});

test("addMonths preserva fim de mês", () => {
  const d = addMonths(new Date(2026, 0, 31), 1); // 31/jan + 1 = 28/fev/2026
  assert.equal(d.getMonth(), 1);
  assert.equal(d.getDate(), 28);
});

test("competenceRange lista meses inclusive e cruza ano", () => {
  const r = competenceRange({ month: 11, year: 2026 }, { month: 2, year: 2027 });
  assert.equal(r.length, 4);
  assert.deepEqual(r[0], { month: 11, year: 2026 });
  assert.deepEqual(r[3], { month: 2, year: 2027 });
  assert.ok(competenceIndex(r[3]) > competenceIndex(r[0]));
});

test("recurrenceOccurrences mensal respeita horizonte e endDate", () => {
  const occ = recurrenceOccurrences(
    new Date(2026, 0, 5),
    new Date(2026, 11, 31),
    "MENSAL",
    5,
  );
  assert.equal(occ.length, 12);
  const occTri = recurrenceOccurrences(
    new Date(2026, 0, 10),
    new Date(2026, 11, 31),
    "TRIMESTRAL",
    10,
  );
  assert.equal(occTri.length, 4); // jan, abr, jul, out
  const occEnd = recurrenceOccurrences(
    new Date(2026, 0, 1),
    new Date(2026, 11, 31),
    "MENSAL",
    1,
    new Date(2026, 2, 31),
  );
  assert.equal(occEnd.length, 3); // jan, fev, mar
});

test("recorrência mensal gera 12 competências de ago/2026 a jul/2027", () => {
  const plan = buildRecurrencePlan({
    startDate: new Date(2026, 7, 10),
    frequency: "MENSAL",
    dayOfMonth: 10,
    totalOccurrences: 12,
  });
  assert.equal(plan.length, 12);
  assert.deepEqual(
    [plan[0].getFullYear(), plan[0].getMonth() + 1],
    [2026, 8],
  );
  assert.deepEqual(
    [plan[11].getFullYear(), plan[11].getMonth() + 1],
    [2027, 7],
  );
});

test("recorrências semanal e quinzenal preservam intervalos", () => {
  const weekly = buildRecurrencePlan({
    startDate: new Date(2026, 0, 5),
    frequency: "SEMANAL",
    dayOfMonth: 5,
    totalOccurrences: 4,
  });
  const biweekly = buildRecurrencePlan({
    startDate: new Date(2026, 0, 5),
    frequency: "QUINZENAL",
    dayOfMonth: 5,
    totalOccurrences: 3,
  });
  assert.deepEqual(
    weekly.map((date) => date.getDate()),
    [5, 12, 19, 26],
  );
  assert.equal(
    (biweekly[1].getTime() - biweekly[0].getTime()) / 86_400_000,
    15,
  );
});

test("dia 31 usa último dia válido e respeita ano bissexto", () => {
  const leap = buildRecurrencePlan({
    startDate: new Date(2028, 0, 31),
    frequency: "MENSAL",
    dayOfMonth: 31,
    totalOccurrences: 3,
  });
  assert.deepEqual(
    leap.map((date) => [date.getMonth() + 1, date.getDate()]),
    [
      [1, 31],
      [2, 29],
      [3, 31],
    ],
  );
  const common = buildRecurrencePlan({
    startDate: new Date(2026, 0, 31),
    frequency: "MENSAL",
    dayOfMonth: 31,
    totalOccurrences: 2,
  });
  assert.equal(common[1].getDate(), 28);
});

test("limites de quantidade, duração e data final encerram a série", () => {
  const byDuration = buildRecurrencePlan({
    startDate: new Date(2026, 0, 1),
    frequency: "MENSAL",
    dayOfMonth: 1,
    durationMonths: 3,
  });
  assert.equal(byDuration.length, 3);
  const firstLimit = buildRecurrencePlan({
    startDate: new Date(2026, 0, 1),
    frequency: "MENSAL",
    dayOfMonth: 1,
    totalOccurrences: 12,
    endDate: new Date(2026, 2, 31),
  });
  assert.equal(firstLimit.length, 3);
});

test("escopos de série selecionam ocorrência, futuras e série completa", () => {
  const sequences = [1, 2, 3, 4, 5];
  assert.deepEqual(recurrenceScopeSequences(sequences, 3, "OCCURRENCE"), [3]);
  assert.deepEqual(recurrenceScopeSequences(sequences, 3, "FUTURE"), [3, 4, 5]);
  assert.deepEqual(recurrenceScopeSequences(sequences, 3, "SERIES"), sequences);
});

test("chave de ocorrência é determinística e valida sequência", () => {
  assert.equal(recurrenceIdempotencyKey("serie-1", 2), "serie-1:2");
  assert.equal(
    recurrenceIdempotencyKey("serie-1", 2),
    recurrenceIdempotencyKey("serie-1", 2),
  );
  assert.throws(() => recurrenceIdempotencyKey("serie-1", 0));
});

test("deriveStatus classifica parcial, pago, atrasado", () => {
  const ref = new Date(2026, 5, 15);
  assert.equal(deriveStatus({ status: "PENDENTE", dueDate: new Date(2026, 4, 1), value: 100, paidValue: 40 }, ref), "PARCIAL");
  assert.equal(deriveStatus({ status: "PENDENTE", dueDate: new Date(2026, 4, 1), value: 100, paidValue: 100 }, ref), "PAGO");
  assert.equal(deriveStatus({ status: "PENDENTE", dueDate: new Date(2026, 4, 1), value: 100, paidValue: 0 }, ref), "ATRASADO");
  assert.equal(deriveStatus({ status: "PENDENTE", dueDate: new Date(2026, 6, 1), value: 100, paidValue: 0 }, ref), "PENDENTE");
  assert.equal(deriveStatus({ status: "CANCELADO", dueDate: null, value: 100, paidValue: 0 }, ref), "CANCELADO");
});

test("outstanding = valor - pago (nunca negativo)", () => {
  assert.equal(outstanding({ value: 100, paidValue: 30 }), 70);
  assert.equal(outstanding({ value: 100, paidValue: 120 }), 0);
  assert.equal(outstanding({ value: 100, paidValue: null }), 100);
});

test("dreGroupFallback usa grupo ou infere pelo tipo", () => {
  assert.equal(dreGroupFallback("RECEITA", null), "RECEITA_BRUTA");
  assert.equal(dreGroupFallback("DESPESA", null), "OUTROS");
  assert.equal(dreGroupFallback("DESPESA", "CUSTOS_DIRETOS"), "CUSTOS_DIRETOS");
});

test("projectScenario aplica fatores e acumula saldo", () => {
  const months: MonthProjectionInput[] = [
    { competence: { month: 1, year: 2026 }, committedRevenue: 1000, weightedRevenue: 500, fixedExpense: 400, variableExpense: 200 },
    { competence: { month: 2, year: 2026 }, committedRevenue: 1000, weightedRevenue: 500, fixedExpense: 400, variableExpense: 200 },
  ];
  const base = projectScenario(months, 0, "base");
  assert.equal(base[0].revenue, 1500);
  assert.equal(base[0].expense, 600);
  assert.equal(base[0].result, 900);
  assert.equal(base[1].endingBalance, 1800);

  const cons = projectScenario(months, 0, "conservador");
  // receita = 1000 + 500*0.8 = 1400 ; despesa = 400 + 200*1.1 = 620
  assert.equal(cons[0].revenue, 1400);
  assert.equal(cons[0].expense, 620);

  const oti = projectScenario(months, 0, "otimista");
  // receita = 1000 + 500*1.15 = 1575 ; despesa = 400 + 200*0.95 = 590
  assert.equal(oti[0].revenue, 1575);
  assert.equal(oti[0].expense, 590);
});

test("Mês a Mês sempre retorna 12 meses, inclusive sem dados", () => {
  const rows = buildMonthByMonth({
    entries: [],
    budgets: [],
    year: 2026,
    regime: "COMPETENCIA",
    openingBalance: 100,
    ref: new Date(2026, 6, 1),
  });
  assert.equal(rows.length, 12);
  assert.equal(rows[0].openingBalance, 100);
  assert.equal(rows[11].closingBalance, 100);
});

test("Mês a Mês separa previsto, realizado, parcial e inadimplência", () => {
  const rows = buildMonthByMonth({
    entries: [
      {
        type: "RECEITA",
        value: 1000,
        paidValue: 400,
        status: "PARCIAL",
        recurring: true,
        competenceMonth: 1,
        competenceYear: 2026,
        dueDate: new Date(2026, 0, 10),
        paymentDate: new Date(2026, 0, 12),
      },
      {
        type: "DESPESA",
        value: 300,
        paidValue: 300,
        status: "PAGO",
        recurring: false,
        competenceMonth: 1,
        competenceYear: 2026,
        dueDate: new Date(2026, 0, 15),
        paymentDate: new Date(2026, 0, 15),
      },
    ],
    budgets: [],
    year: 2026,
    regime: "COMPETENCIA",
    openingBalance: 0,
    ref: new Date(2026, 1, 1),
  });
  assert.equal(rows[0].expectedRevenue, 1000);
  assert.equal(rows[0].realizedRevenue, 400);
  assert.equal(rows[0].receivable, 600);
  assert.equal(rows[0].delinquency, 600);
  assert.equal(rows[0].recurringRevenue, 1000);
  assert.equal(rows[0].realizedExpense, 300);
  assert.equal(rows[0].realizedResult, 100);
});

test("regime de caixa usa vencimento/pagamento e competência usa competência", () => {
  const entry = {
    type: "RECEITA" as const,
    value: 500,
    paidValue: 500,
    status: "PAGO" as const,
    recurring: false,
    competenceMonth: 2,
    competenceYear: 2026,
    dueDate: new Date(2026, 2, 5),
    paymentDate: new Date(2026, 3, 5),
  };
  const competence = buildMonthByMonth({
    entries: [entry],
    budgets: [],
    year: 2026,
    regime: "COMPETENCIA",
    openingBalance: 0,
  });
  const cash = buildMonthByMonth({
    entries: [entry],
    budgets: [],
    year: 2026,
    regime: "CAIXA",
    openingBalance: 0,
  });
  assert.equal(competence[1].expectedRevenue, 500);
  assert.equal(competence[1].realizedRevenue, 500);
  assert.equal(cash[2].expectedRevenue, 500);
  assert.equal(cash[3].realizedRevenue, 500);
});

test("orçamento anual e trimestral é rateado por mês", () => {
  const rows = buildMonthByMonth({
    entries: [],
    budgets: [
      {
        periodType: "ANUAL",
        month: null,
        quarter: null,
        plannedRevenue: 1200,
        plannedExpense: 600,
      },
      {
        periodType: "TRIMESTRAL",
        month: null,
        quarter: 1,
        plannedRevenue: 300,
        plannedExpense: 0,
      },
    ],
    year: 2026,
    regime: "COMPETENCIA",
    openingBalance: 0,
  });
  assert.equal(rows[0].budget, 150);
  assert.equal(rows[3].budget, 50);
  assert.equal(
    round2(rows.reduce((sum, row) => sum + row.budget, 0)),
    900,
  );
});

test("parser de DRE rejeita operação arbitrária", () => {
  assert.throws(
    () => parseDreFormula({ op: "javascript", source: "process.exit()" }),
    DreFormulaError,
  );
});

test("fórmulas DRE calculam soma, subtração e percentual", () => {
  const rows = [
    { code: "RB", formula: null },
    { code: "DED", formula: null },
    {
      code: "RL",
      formula: parseDreFormula({
        op: "subtract",
        left: { op: "ref", row: "RB" },
        right: { op: "ref", row: "DED" },
      }),
    },
    {
      code: "MARGEM",
      formula: parseDreFormula({
        op: "percent",
        value: { op: "ref", row: "RL" },
        base: { op: "ref", row: "RB" },
      }),
    },
  ];
  const values = evaluateDreFormulas(rows, { RB: 1000, DED: 100 });
  assert.equal(values.RL, 900);
  assert.equal(values.MARGEM, 90);
});

test("DRE rejeita referência inexistente, ciclo e divisão por zero", () => {
  assert.throws(() =>
    validateDreFormulaRows([
      {
        code: "A",
        formula: parseDreFormula({ op: "ref", row: "INEXISTENTE" }),
      },
    ]),
  );
  assert.throws(() =>
    validateDreFormulaRows([
      { code: "A", formula: parseDreFormula({ op: "ref", row: "B" }) },
      { code: "B", formula: parseDreFormula({ op: "ref", row: "A" }) },
    ]),
  );
  assert.throws(() =>
    evaluateDreFormulas(
      [
        { code: "A", formula: null },
        { code: "ZERO", formula: null },
        {
          code: "DIV",
          formula: parseDreFormula({
            op: "divide",
            numerator: { op: "ref", row: "A" },
            denominator: { op: "ref", row: "ZERO" },
          }),
        },
      ],
      { A: 1, ZERO: 0 },
    ),
  );
});

test("projeção mantém manual, permite automático e contém as 12 linhas padrão", () => {
  assert.equal(
    effectiveProjectionValue({ automaticValue: 100, manualValue: null }),
    100,
  );
  assert.equal(
    effectiveProjectionValue({ automaticValue: 100, manualValue: 125 }),
    125,
  );
  assert.equal(DEFAULT_PROJECTION_LINES.length, 12);
  assert.ok(
    DEFAULT_PROJECTION_LINES.some((line) => line.type === "INADIMPLENCIA"),
  );
});

test("permissões financeiras são granulares no backend", () => {
  assert.equal(canFinance("SUPER_ADMIN", "PUBLISH_DRE"), true);
  assert.equal(canFinance("FINANCEIRO", "CANCEL_RECURRENCE"), true);
  assert.equal(canFinance("VIEWER", "VIEW"), true);
  assert.equal(canFinance("VIEWER", "EXPORT"), true);
  assert.equal(canFinance("VIEWER", "EDIT_PROJECTION"), false);
  assert.equal(canFinance("COMERCIAL", "CREATE_RECURRENCE"), false);
});

console.log(`\n${passed} testes passaram ✓`);
