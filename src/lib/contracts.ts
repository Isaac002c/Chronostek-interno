// Receita recorrente por competência (mês a mês), consistente com o Financeiro
// que já trabalha com competenceMonth/competenceYear.
//
// Conceitos separados para a operação:
//  - MRR Ativo: receita mensal recorrente dos contratos ATIVO agora.
//  - ARR Anualizado: MRR Ativo × 12 (definição clássica de receita recorrente anual).
//  - Receita Recorrente no Período: soma das competências do intervalo selecionado
//    em que cada contrato recorrente esteve ativo (SEM multiplicar por 12, SEM pró-rata).
//
// Datas são comparadas em UTC para evitar drift de mês (as datas no banco são
// gravadas como meia-noite UTC; usar getUTC* mantém o dia/mês de calendário pretendido).

import type { Contract, ContractType, ContractStatus } from "@prisma/client";

const RECURRING_TYPES: ContractType[] = ["RECORRENTE", "HIBRIDO"];

/** Contrato cuja parte recorrente gera receita por competência. */
function isRecurring(type: ContractType): boolean {
  return RECURRING_TYPES.includes(type);
}

/** Chave numérica da competência (ano*12 + mês0). Permite comparação/contagem simples. */
function compKeyOf(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function compKeyYM(year: number, month1: number): number {
  return year * 12 + (month1 - 1);
}

export type Period = {
  /** Date no 1º dia da competência inicial (UTC) — para formatação. */
  start: Date;
  /** Date no 1º dia da competência final (UTC) — para formatação. */
  end: Date;
  startKey: number;
  endKey: number;
};

function ymOf(str: string): { y: number; m: number } | null {
  // Espera "yyyy-mm-dd"; extrai ano/mês sem instanciar Date (evita timezone).
  const m = /^(\d{4})-(\d{2})/.exec(str);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) };
}

/**
 * Resolve o período a partir dos parâmetros de filtro.
 * Sem parâmetros → mês atual. Apenas um lado informado → completa com o mês atual.
 * Garante end >= start (clampa para o mês inicial se vier invertido).
 */
export function resolvePeriod(
  startStr: string | undefined,
  endStr: string | undefined,
  now: Date = new Date(),
): Period {
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;

  const s = startStr ? ymOf(startStr) : null;
  const e = endStr ? ymOf(endStr) : null;

  const startY = s?.y ?? curY;
  const startM = s?.m ?? curM;
  let endY = e?.y ?? curY;
  let endM = e?.m ?? curM;

  const startKey = compKeyYM(startY, startM);
  let endKey = compKeyYM(endY, endM);
  if (endKey < startKey) {
    endY = startY;
    endM = startM;
    endKey = startKey;
  }

  return {
    start: new Date(Date.UTC(startY, startM - 1, 1)),
    end: new Date(Date.UTC(endY, endM - 1, 1)),
    startKey,
    endKey,
  };
}

/** Total de competências no período (inclusive). */
export function periodCompetences(period: Period): number {
  return period.endKey - period.startKey + 1;
}

/**
 * Um contrato recorrente pode faturar enquanto não estiver cancelado.
 * Contratos ENCERRADO sem data de fim não têm janela conhecida → não contabilizar.
 */
function recurringBillable(c: Pick<Contract, "type" | "status" | "endDate">): boolean {
  if (!isRecurring(c.type)) return false;
  if (c.status === ("CANCELADO" as ContractStatus)) return false;
  if (c.status === ("ENCERRADO" as ContractStatus) && !c.endDate) return false;
  return true;
}

type ContractLike = Pick<
  Contract,
  "type" | "status" | "monthlyValue" | "startDate" | "endDate" | "totalValue"
>;

/**
 * Nº de competências do período em que o contrato recorrente esteve ativo.
 * Janela do contrato = [startDate, endDate]; sem fim = aberto; sem início = aberto.
 */
export function competencesActiveInPeriod(c: ContractLike, period: Period): number {
  if (!recurringBillable(c)) return 0;
  const cStart = c.startDate ? compKeyOf(c.startDate) : Number.NEGATIVE_INFINITY;
  const cEnd = c.endDate ? compKeyOf(c.endDate) : Number.POSITIVE_INFINITY;
  const lo = Math.max(period.startKey, cStart);
  const hi = Math.min(period.endKey, cEnd);
  return hi < lo ? 0 : hi - lo + 1;
}

/**
 * Receita recorrente do contrato dentro do período = mensalidade × competências ativas.
 * Híbrido conta apenas a parte recorrente (monthlyValue); totalValue NÃO entra aqui
 * para não duplicar receita de projeto.
 */
export function recurringRevenueInPeriod(c: ContractLike, period: Period): number {
  const n = competencesActiveInPeriod(c, period);
  if (n === 0) return 0;
  return (c.monthlyValue ?? 0) * n;
}

/** Contrato considerado "ativo no período" (para a contagem do card). */
export function contractActiveInPeriod(c: ContractLike, period: Period): boolean {
  if (isRecurring(c.type)) return competencesActiveInPeriod(c, period) > 0;
  // Não-recorrente: ativo se iniciou dentro do período (ou sem data de início).
  if (!c.startDate) return true;
  const k = compKeyOf(c.startDate);
  return k >= period.startKey && k <= period.endKey;
}

/** Soma da receita recorrente no período sobre uma lista de contratos. */
export function totalRecurringRevenueInPeriod(cs: ContractLike[], period: Period): number {
  return cs.reduce((sum, c) => sum + recurringRevenueInPeriod(c, period), 0);
}

// ─────────────────────────── Atalhos de período ───────────────────────────

function iso(y: number, m1: number): string {
  return `${y}-${String(m1).padStart(2, "0")}-01`;
}

export type PeriodShortcut = { key: string; label: string; start: string; end: string };

/** Atalhos rápidos (mês atual, trimestre atual, ano atual, últimos 3/6 meses). */
export function periodShortcuts(now: Date = new Date()): PeriodShortcut[] {
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12
  const q = Math.floor((m - 1) / 3); // 0-3
  const qStart = q * 3 + 1;

  // Últimos N meses (inclui o mês atual): recua N-1 meses.
  const back = (n: number) => {
    const d = new Date(y, m - 1 - (n - 1), 1);
    return iso(d.getFullYear(), d.getMonth() + 1);
  };

  return [
    { key: "mes", label: "Mês atual", start: iso(y, m), end: iso(y, m) },
    { key: "tri", label: "Trimestre atual", start: iso(y, qStart), end: iso(y, qStart + 2) },
    { key: "ano", label: "Ano atual", start: iso(y, 1), end: iso(y, 12) },
    { key: "3m", label: "Últimos 3 meses", start: back(3), end: iso(y, m) },
    { key: "6m", label: "Últimos 6 meses", start: back(6), end: iso(y, m) },
  ];
}
