// Fuso horário America/Sao_Paulo (UTC-3 o ano todo — o Brasil não tem horário de
// verão desde 2019). Trabalhamos com deslocamento fixo para que os limites de
// período (ano/trimestre/mês/semana/dia) sejam determinísticos independentemente
// do fuso do servidor (containers rodam em UTC). Tudo é armazenado como instante
// UTC; estas funções convertem "hora de parede" de São Paulo ⇄ instante.

export const SP_TZ = "America/Sao_Paulo";
const OFFSET_MS = 3 * 60 * 60 * 1000; // UTC = SP + 3h

export type SpParts = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  weekday: number; // 0=domingo … 6=sábado
  hour: number;
};

/** Instante (UTC) correspondente a uma hora-de-parede de São Paulo. */
export function spWallToUtc(
  year: number,
  month1: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  return new Date(Date.UTC(year, month1 - 1, day, hour, minute, second, ms) + OFFSET_MS);
}

/** Componentes de calendário (hora de parede) de São Paulo para um instante. */
export function spPartsOf(instant: Date): SpParts {
  const shifted = new Date(instant.getTime() - OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
  };
}

/** Agora, nos componentes de calendário de São Paulo. */
export function nowSpParts(): SpParts {
  return spPartsOf(new Date());
}

/** Início do dia (00:00:00.000 SP) como instante UTC. */
export function spDayStart(year: number, month1: number, day: number): Date {
  return spWallToUtc(year, month1, day, 0, 0, 0, 0);
}

/** Fim do dia (23:59:59.999 SP) como instante UTC. */
export function spDayEnd(year: number, month1: number, day: number): Date {
  return spWallToUtc(year, month1, day, 23, 59, 59, 999);
}

/** Quantidade de dias em um mês (aritmético, independente de fuso). */
export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Dia da semana (0=dom … 6=sáb) de uma data de calendário. */
export function weekdayOf(year: number, month1: number, day: number): number {
  return new Date(Date.UTC(year, month1 - 1, day)).getUTCDay();
}

/** Chave "AAAA-MM-DD" de uma data de calendário SP. */
export function spDateKey(year: number, month1: number, day: number): string {
  const mm = String(month1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Chave "AAAA-MM-DD" (SP) de um instante. */
export function spKeyOf(instant: Date): string {
  const p = spPartsOf(instant);
  return spDateKey(p.year, p.month, p.day);
}

// ─────────────────────────── Janelas de período ───────────────────────────

export type Range = { start: Date; end: Date };

export function yearRange(year: number): Range {
  return { start: spDayStart(year, 1, 1), end: spDayEnd(year, 12, 31) };
}

export function quarterRange(year: number, quarter: number): Range {
  const firstMonth = (quarter - 1) * 3 + 1;
  const lastMonth = firstMonth + 2;
  return {
    start: spDayStart(year, firstMonth, 1),
    end: spDayEnd(year, lastMonth, daysInMonth(year, lastMonth)),
  };
}

export function monthRange(year: number, month1: number): Range {
  return {
    start: spDayStart(year, month1, 1),
    end: spDayEnd(year, month1, daysInMonth(year, month1)),
  };
}

export type CalendarWeek = { week: number; startDay: number; endDay: number };

/**
 * Semanas REAIS do calendário dentro de um mês, alinhadas à segunda-feira e
 * recortadas ao mês (a 1ª semana começa no dia 1; cada segunda-feira inicia a
 * próxima). Nada de "4 semanas fixas".
 */
export function calendarWeeksOfMonth(year: number, month1: number): CalendarWeek[] {
  const last = daysInMonth(year, month1);
  const weeks: CalendarWeek[] = [];
  let week = 1;
  let startDay = 1;
  for (let d = 1; d <= last; d++) {
    const isMonday = weekdayOf(year, month1, d) === 1;
    if (isMonday && d > startDay) {
      weeks.push({ week, startDay, endDay: d - 1 });
      week += 1;
      startDay = d;
    }
  }
  weeks.push({ week, startDay, endDay: last });
  return weeks;
}
