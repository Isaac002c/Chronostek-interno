import type {
  BudgetPeriodType,
  FinancialStatus,
  FinancialType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/finance-rules";

export type AccountingRegime = "COMPETENCIA" | "CAIXA";

export type MonthlyEntryInput = {
  id?: string;
  description?: string;
  type: FinancialType;
  value: number;
  paidValue: number | null;
  status: FinancialStatus;
  recurring: boolean;
  competenceMonth: number;
  competenceYear: number;
  dueDate: Date | null;
  paymentDate: Date | null;
  categoryLabel?: string | null;
  costCenterLabel?: string | null;
  counterpartyLabel?: string | null;
};

export type MonthlyBudgetInput = {
  periodType: BudgetPeriodType;
  month: number | null;
  quarter: number | null;
  plannedRevenue: number;
  plannedExpense: number;
};

export type MonthByMonthRow = {
  month: number;
  expectedRevenue: number;
  realizedRevenue: number;
  expectedExpense: number;
  realizedExpense: number;
  receivable: number;
  payable: number;
  overdue: number;
  expectedResult: number;
  realizedResult: number;
  budget: number;
  budgetVariance: number;
  openingBalance: number;
  closingBalance: number;
  recurringRevenue: number;
  delinquency: number;
};

export type MonthlyLedgerItem = {
  id: string;
  description: string;
  type: FinancialType;
  value: number;
  paidValue: number;
  status: FinancialStatus;
  recurring: boolean;
  dueDate: Date | null;
  categoryLabel: string | null;
  costCenterLabel: string | null;
  counterpartyLabel: string | null;
};

function monthOf(
  entry: MonthlyEntryInput,
  year: number,
  regime: AccountingRegime,
  realized: boolean,
): number | null {
  if (regime === "COMPETENCIA") {
    return entry.competenceYear === year ? entry.competenceMonth : null;
  }
  const date = realized ? entry.paymentDate : entry.dueDate;
  return date && date.getFullYear() === year ? date.getMonth() + 1 : null;
}

function budgetForMonth(budgets: MonthlyBudgetInput[], month: number) {
  return budgets.reduce(
    (total, budget) => {
      if (budget.periodType === "MENSAL" && budget.month === month) {
        total.revenue += budget.plannedRevenue;
        total.expense += budget.plannedExpense;
      } else if (budget.periodType === "TRIMESTRAL") {
        const quarter = Math.floor((month - 1) / 3) + 1;
        if (budget.quarter === quarter) {
          total.revenue += budget.plannedRevenue / 3;
          total.expense += budget.plannedExpense / 3;
        }
      } else if (budget.periodType === "ANUAL") {
        total.revenue += budget.plannedRevenue / 12;
        total.expense += budget.plannedExpense / 12;
      }
      return total;
    },
    { revenue: 0, expense: 0 },
  );
}

/**
 * Livro-razão projetado: mantém cada lançamento individual dentro da
 * competência/vencimento correspondente, sem consolidar itens de mesmo nome.
 */
export function buildMonthlyLedger(params: {
  entries: MonthlyEntryInput[];
  year: number;
  regime: AccountingRegime;
}): MonthlyLedgerItem[][] {
  const months: MonthlyLedgerItem[][] = Array.from({ length: 12 }, () => []);
  params.entries.forEach((entry, index) => {
    if (entry.status === "CANCELADO") return;
    const month = monthOf(entry, params.year, params.regime, false);
    if (!month) return;
    months[month - 1].push({
      id: entry.id ?? `ledger-${month}-${index}`,
      description: entry.description?.trim() || "Lançamento sem descrição",
      type: entry.type,
      value: round2(entry.value),
      paidValue: round2(entry.paidValue ?? 0),
      status: entry.status,
      recurring: entry.recurring,
      dueDate: entry.dueDate,
      categoryLabel: entry.categoryLabel ?? null,
      costCenterLabel: entry.costCenterLabel ?? null,
      counterpartyLabel: entry.counterpartyLabel ?? null,
    });
  });
  for (const entries of months) {
    entries.sort((left, right) => {
      const leftDate = left.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightDate = right.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftDate - rightDate || left.description.localeCompare(right.description, "pt-BR");
    });
  }
  return months;
}

export function buildMonthByMonth(params: {
  entries: MonthlyEntryInput[];
  budgets: MonthlyBudgetInput[];
  year: number;
  regime: AccountingRegime;
  openingBalance: number;
  ref?: Date;
}): MonthByMonthRow[] {
  const ref = params.ref ?? new Date();
  const rows: MonthByMonthRow[] = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    expectedRevenue: 0,
    realizedRevenue: 0,
    expectedExpense: 0,
    realizedExpense: 0,
    receivable: 0,
    payable: 0,
    overdue: 0,
    expectedResult: 0,
    realizedResult: 0,
    budget: 0,
    budgetVariance: 0,
    openingBalance: 0,
    closingBalance: 0,
    recurringRevenue: 0,
    delinquency: 0,
  }));

  for (const entry of params.entries) {
    if (entry.status === "CANCELADO") continue;
    const plannedMonth = monthOf(entry, params.year, params.regime, false);
    const realizedMonth = monthOf(entry, params.year, params.regime, true);
    const outstanding = Math.max(0, entry.value - (entry.paidValue ?? 0));
    if (plannedMonth) {
      const row = rows[plannedMonth - 1];
      if (entry.type === "RECEITA") {
        row.expectedRevenue += entry.value;
        row.receivable += outstanding;
        if (entry.recurring) row.recurringRevenue += entry.value;
        if (
          outstanding > 0 &&
          entry.dueDate &&
          entry.dueDate < ref
        ) {
          row.overdue += outstanding;
          row.delinquency += outstanding;
        }
      } else {
        row.expectedExpense += entry.value;
        row.payable += outstanding;
        if (outstanding > 0 && entry.dueDate && entry.dueDate < ref) {
          row.overdue += outstanding;
        }
      }
    }
    if (realizedMonth && (entry.paidValue ?? 0) > 0) {
      const realized = entry.paidValue ?? 0;
      if (entry.type === "RECEITA") rows[realizedMonth - 1].realizedRevenue += realized;
      else rows[realizedMonth - 1].realizedExpense += realized;
    } else if (realizedMonth && entry.status === "PAGO") {
      if (entry.type === "RECEITA") rows[realizedMonth - 1].realizedRevenue += entry.value;
      else rows[realizedMonth - 1].realizedExpense += entry.value;
    }
  }

  let balance = params.openingBalance;
  for (const row of rows) {
    const budget = budgetForMonth(params.budgets, row.month);
    row.expectedResult = row.expectedRevenue - row.expectedExpense;
    row.realizedResult = row.realizedRevenue - row.realizedExpense;
    row.budget = budget.revenue - budget.expense;
    row.budgetVariance = row.realizedResult - row.budget;
    row.openingBalance = balance;
    balance += row.realizedResult;
    row.closingBalance = balance;
    for (const key of Object.keys(row) as (keyof MonthByMonthRow)[]) {
      if (key !== "month") row[key] = round2(row[key]);
    }
  }
  return rows;
}

export async function getMonthByMonth(params: {
  year: number;
  regime: AccountingRegime;
  costCenterId?: string | null;
  ref?: Date;
}) {
  const [entries, budgets, banks] = await Promise.all([
    prisma.financialEntry.findMany({
      where: {
        deletedAt: null,
        ...(params.costCenterId ? { costCenterId: params.costCenterId } : {}),
        OR: [
          { competenceYear: params.year },
          {
            dueDate: {
              gte: new Date(params.year, 0, 1),
              lt: new Date(params.year + 1, 0, 1),
            },
          },
          {
            paymentDate: {
              gte: new Date(params.year, 0, 1),
              lt: new Date(params.year + 1, 0, 1),
            },
          },
        ],
      },
      select: {
        id: true,
        description: true,
        type: true,
        value: true,
        paidValue: true,
        status: true,
        recurring: true,
        competenceMonth: true,
        competenceYear: true,
        dueDate: true,
        paymentDate: true,
        category: { select: { code: true, name: true } },
        costCenter: { select: { code: true, name: true } },
        supplier: { select: { name: true } },
        client: { select: { name: true } },
        contract: { select: { title: true } },
      },
    }),
    prisma.budget.findMany({
      where: {
        deletedAt: null,
        year: params.year,
        status: { in: ["APROVADO", "ATIVO", "ENCERRADO"] },
        ...(params.costCenterId ? { costCenterId: params.costCenterId } : {}),
      },
      select: {
        periodType: true,
        month: true,
        quarter: true,
        plannedRevenue: true,
        plannedExpense: true,
      },
    }),
    prisma.bankAccount.aggregate({
      where: { deletedAt: null, active: true },
      _sum: { initialBalance: true },
    }),
  ]);

  const monthlyEntries: MonthlyEntryInput[] = entries.map((entry) => ({
    id: entry.id,
    description: entry.description,
    type: entry.type,
    value: entry.value,
    paidValue: entry.paidValue,
    status: entry.status,
    recurring: entry.recurring,
    competenceMonth: entry.competenceMonth,
    competenceYear: entry.competenceYear,
    dueDate: entry.dueDate,
    paymentDate: entry.paymentDate,
    categoryLabel: entry.category
      ? `${entry.category.code} ${entry.category.name}`
      : null,
    costCenterLabel: entry.costCenter
      ? `${entry.costCenter.code} · ${entry.costCenter.name}`
      : null,
    counterpartyLabel:
      entry.supplier?.name ??
      entry.client?.name ??
      entry.contract?.title ??
      null,
  }));
  const summaryMonths = buildMonthByMonth({
    entries: monthlyEntries,
    budgets,
    year: params.year,
    regime: params.regime,
    openingBalance: banks._sum.initialBalance ?? 0,
    ref: params.ref,
  });
  const ledger = buildMonthlyLedger({
    entries: monthlyEntries,
    year: params.year,
    regime: params.regime,
  });
  const months = summaryMonths.map((month) => ({
    ...month,
    ledger: ledger[month.month - 1],
  }));
  const totals = months.reduce(
    (acc, month) => {
      acc.expectedRevenue += month.expectedRevenue;
      acc.realizedRevenue += month.realizedRevenue;
      acc.expectedExpense += month.expectedExpense;
      acc.realizedExpense += month.realizedExpense;
      acc.expectedResult += month.expectedResult;
      acc.realizedResult += month.realizedResult;
      acc.receivable += month.receivable;
      acc.payable += month.payable;
      acc.delinquency += month.delinquency;
      acc.budget += month.budget;
      return acc;
    },
    {
      expectedRevenue: 0,
      realizedRevenue: 0,
      expectedExpense: 0,
      realizedExpense: 0,
      expectedResult: 0,
      realizedResult: 0,
      receivable: 0,
      payable: 0,
      delinquency: 0,
      budget: 0,
    },
  );
  return {
    year: params.year,
    regime: params.regime,
    months,
    totals: Object.fromEntries(
      Object.entries(totals).map(([key, value]) => [key, round2(value)]),
    ) as typeof totals,
  };
}
