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
  deriveStatus,
  outstanding,
  projectScenario,
  dreGroupFallback,
  type MonthProjectionInput,
} from "../src/lib/finance-rules";

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

console.log(`\n${passed} testes passaram ✓`);
