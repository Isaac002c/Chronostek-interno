/**
 * Testes das regras de cálculo de Metas (funções puras, sem banco).
 * Rodar: npm test  (ou: npx tsx scripts/test-metas.ts)
 */
import {
  computeGoalStatus,
  equalSplit,
  distributeAssignees,
  sumChecklistContributions,
  effectiveResponsibles,
  effectiveCostCenter,
  type GoalLite,
} from "../src/lib/goal-math";
import {
  spDayStart,
  spDayEnd,
  spKeyOf,
  calendarWeeksOfMonth,
  weekdayOf,
  daysInMonth,
} from "../src/lib/tz";

let passed = 0;
let failed = 0;
function ok(cond: boolean, label: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}
function eq(a: unknown, b: unknown, label: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${label} (esperado ${JSON.stringify(b)}, obtido ${JSON.stringify(a)})`);
}

const D = (s: string) => new Date(s);

console.log("computeGoalStatus:");
{
  const start = D("2026-07-01T03:00:00Z");
  const end = D("2026-08-01T02:59:59Z");
  eq(computeGoalStatus(3000, 3200, start, end, D("2026-07-16T12:00:00Z"), false), "SUPERADA", "ultrapassou alvo → SUPERADA");
  eq(computeGoalStatus(3000, 3000, start, end, D("2026-07-16T12:00:00Z"), false), "BATIDA", "atingiu exatamente → BATIDA");
  eq(computeGoalStatus(3000, 0, D("2026-08-01T03:00:00Z"), end, D("2026-07-10T12:00:00Z"), false), "NAO_INICIADA", "antes do início, 0 → NAO_INICIADA");
  eq(computeGoalStatus(3000, 1200, start, D("2026-07-31T02:59:59Z"), D("2026-08-05T12:00:00Z"), false), "ATRASADA", "prazo passou sem atingir → ATRASADA");
  eq(computeGoalStatus(3000, 450, start, end, D("2026-07-16T12:00:00Z"), false), "EM_RISCO", "50% do tempo, 15% feito → EM_RISCO");
  eq(computeGoalStatus(3000, 1800, start, end, D("2026-07-16T12:00:00Z"), false), "NO_PRAZO", "50% do tempo, 60% feito → NO_PRAZO");
  eq(computeGoalStatus(3000, 500, start, end, D("2026-07-16T12:00:00Z"), true), "CANCELADA", "cancelada → CANCELADA");
}

console.log("equalSplit:");
{
  eq(equalSplit(9000, 3), [3000, 3000, 3000], "9000 em 3");
  const s = equalSplit(10, 3);
  eq(s.reduce((a, b) => Math.round((a + b) * 100) / 100, 0), 10, "10 em 3 soma exata");
  eq(equalSplit(0, 4), [0, 0, 0, 0], "0 em 4");
  eq(equalSplit(100, 0), [], "n=0 → vazio");
}

console.log("distributeAssignees (sem duplicidade):");
{
  eq(distributeAssignees(9000, [
    { distributionType: "IGUALITARIA" },
    { distributionType: "IGUALITARIA" },
    { distributionType: "IGUALITARIA" },
  ]), [3000, 3000, 3000], "igualitária 9000/3");

  eq(distributeAssignees(9000, [
    { distributionType: "VALOR_FIXO", plannedValue: 4000 },
    { distributionType: "VALOR_FIXO", plannedValue: 3000 },
    { distributionType: "VALOR_FIXO", plannedValue: 2000 },
  ]), [4000, 3000, 2000], "valor fixo (Isaac/Arthur/Camile) soma 9000");

  eq(distributeAssignees(9000, [
    { distributionType: "PERCENTUAL", percentage: 50 },
    { distributionType: "PERCENTUAL", percentage: 30 },
    { distributionType: "PERCENTUAL", percentage: 20 },
  ]), [4500, 2700, 1800], "percentual 50/30/20");

  eq(distributeAssignees(9000, [
    { distributionType: "COMPARTILHADA" },
    { distributionType: "COMPARTILHADA" },
  ]), [9000, 9000], "compartilhada = cada um responde pelo total (visão, não soma)");
}

console.log("sumChecklistContributions (roll-up sem duplicidade):");
{
  const tasks = [
    { goalId: "G", deletedAt: null, realizedContribution: 300 },
    { goalId: "G", deletedAt: null, realizedContribution: 175 },
    { goalId: "OUTRA", deletedAt: null, realizedContribution: 999 },
    { goalId: "G", deletedAt: D("2026-07-01"), realizedContribution: 500 }, // excluída
  ];
  const contribs = [
    { goalId: "G", realizedValue: 50, task: { goalId: "OUTRA", deletedAt: null } }, // conta (+50)
    { goalId: "G", realizedValue: 20, task: { goalId: "G", deletedAt: null } }, // NÃO conta (dupla)
    { goalId: "G", realizedValue: 77, task: { goalId: "OUTRA", deletedAt: D("2026-07-01") } }, // excluída
  ];
  eq(sumChecklistContributions(tasks, contribs, "G"), 525, "300+175 + 50 (sem duplicar t. primária nem contar excluídas)");
}

console.log("Calendário (semanas reais) e timezone SP:");
{
  const weeks = calendarWeeksOfMonth(2026, 7);
  eq(weeks[0].startDay, 1, "1ª semana começa no dia 1");
  eq(weeks[weeks.length - 1].endDay, daysInMonth(2026, 7), "última semana termina no último dia");
  let contiguous = true;
  for (let i = 1; i < weeks.length; i++) if (weeks[i].startDay !== weeks[i - 1].endDay + 1) contiguous = false;
  ok(contiguous, "semanas contíguas (sem buracos/sobreposição)");
  let mondays = true;
  for (let i = 1; i < weeks.length; i++) if (weekdayOf(2026, 7, weeks[i].startDay) !== 1) mondays = false;
  ok(mondays, "cada semana (exceto a 1ª) inicia numa segunda-feira");

  eq(daysInMonth(2024, 2), 29, "fev/2024 bissexto = 29 dias");
  eq(daysInMonth(2026, 2), 28, "fev/2026 = 28 dias");

  eq(spDayStart(2026, 7, 1).toISOString(), "2026-07-01T03:00:00.000Z", "00:00 SP = 03:00 UTC");
  eq(spDayEnd(2026, 7, 1).toISOString(), "2026-07-02T02:59:59.999Z", "23:59:59.999 SP = 02:59 UTC do dia seguinte");
  eq(spKeyOf(spDayEnd(2026, 7, 1)), "2026-07-01", "fim do dia ainda pertence ao mesmo dia SP (sem drift)");
}

console.log("Herança de responsáveis / centro de custo (pai→filho, override):");
{
  const map = new Map<string, GoalLite>([
    ["ano", { id: "ano", parentGoalId: null, title: "Meta Anual 2027", responsibleId: null, costCenterId: "cc-1", assignees: [{ userId: "u1", isPrimary: true, name: "Isaac" }] }],
    ["tri", { id: "tri", parentGoalId: "ano", title: "Trimestre 1", responsibleId: null, costCenterId: null, assignees: [] }],
    ["mes", { id: "mes", parentGoalId: "tri", title: "Janeiro", responsibleId: null, costCenterId: "cc-2", assignees: [{ userId: "u2", isPrimary: true, name: "Arthur" }] }],
  ]);
  const rAno = effectiveResponsibles("ano", map);
  eq([rAno.assignees.map((a) => a.name), rAno.inherited], [["Isaac"], false], "ano usa próprio responsável");
  const rTri = effectiveResponsibles("tri", map);
  eq([rTri.assignees.map((a) => a.name), rTri.inherited, rTri.inheritedFromTitle], [["Isaac"], true, "Meta Anual 2027"], "trimestre herda responsável do ano");
  const rMes = effectiveResponsibles("mes", map);
  eq([rMes.assignees.map((a) => a.name), rMes.inherited], [["Arthur"], false], "mês sobrescreve responsável");
  const cTri = effectiveCostCenter("tri", map);
  eq([cTri.costCenterId, cTri.inherited], ["cc-1", true], "trimestre herda centro de custo do ano");
  const cMes = effectiveCostCenter("mes", map);
  eq([cMes.costCenterId, cMes.inherited], ["cc-2", false], "mês sobrescreve centro de custo");
}

console.log(`\nResultado: ${passed} passaram, ${failed} falharam.`);
process.exit(failed > 0 ? 1 : 0);
