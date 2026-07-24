import type { CalendarRecurrenceFrequency } from "@prisma/client";
import type { CalendarRecurrenceInput } from "@/lib/calendar/schemas";

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const MAX_OCCURRENCES = 500;
const MAX_HORIZON_YEARS = 2;

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

function zonedParts(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
    millisecond: date.getUTCMilliseconds(),
  };
}

function partsAsUtc(parts: LocalParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
}

function localPartsToUtc(parts: LocalParts, timeZone: string): Date {
  const desired = partsAsUtc(parts);
  let candidate = desired;
  for (let index = 0; index < 4; index += 1) {
    const actual = zonedParts(new Date(candidate), timeZone);
    const delta = desired - partsAsUtc(actual);
    candidate += delta;
    if (delta === 0) break;
  }
  return new Date(candidate);
}

function localDateAtOffset(start: LocalParts, days: number): LocalParts {
  const value = new Date(
    Date.UTC(start.year, start.month - 1, start.day + days),
  );
  return {
    ...start,
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthAtOffset(
  start: LocalParts,
  offset: number,
  monthDay: number,
): LocalParts | null {
  const zeroBased = start.month - 1 + offset;
  const year = start.year + Math.floor(zeroBased / 12);
  const month = ((zeroBased % 12) + 12) % 12;
  if (monthDay > daysInMonth(year, month + 1)) return null;
  return { ...start, year, month: month + 1, day: monthDay };
}

function utcRruleDate(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function frequencyParts(frequency: CalendarRecurrenceFrequency) {
  switch (frequency) {
    case "DIARIA":
      return { freq: "DAILY", multiplier: 1 };
    case "DIAS_UTEIS":
      return { freq: "WEEKLY", multiplier: 1, byDay: "MO,TU,WE,TH,FR" };
    case "SEMANAL":
      return { freq: "WEEKLY", multiplier: 1 };
    case "QUINZENAL":
      return { freq: "WEEKLY", multiplier: 2 };
    case "MENSAL":
      return { freq: "MONTHLY", multiplier: 1 };
    case "BIMESTRAL":
      return { freq: "MONTHLY", multiplier: 2 };
    case "TRIMESTRAL":
      return { freq: "MONTHLY", multiplier: 3 };
    case "SEMESTRAL":
      return { freq: "MONTHLY", multiplier: 6 };
    case "ANUAL":
      return { freq: "YEARLY", multiplier: 1 };
    case "PERSONALIZADA":
      return { freq: "CUSTOM", multiplier: 1 };
  }
}

export function buildRrule(input: CalendarRecurrenceInput): string {
  if (input.frequency === "PERSONALIZADA") {
    const raw = input.rrule?.replace(/^RRULE:/i, "").trim();
    if (!raw || !/^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;|$)/i.test(raw)) {
      throw new Error("A recorrência personalizada exige uma RRULE válida.");
    }
    return raw.toUpperCase();
  }

  const resolved = frequencyParts(input.frequency);
  const values = [
    `FREQ=${resolved.freq}`,
    `INTERVAL=${input.interval * resolved.multiplier}`,
  ];
  const byDay =
    resolved.byDay ??
    (input.weekDays.length > 0
      ? [...new Set(input.weekDays)]
          .sort((a, b) => a - b)
          .map((day) => DAY_CODES[day])
          .join(",")
      : null);
  if (byDay) values.push(`BYDAY=${byDay}`);
  if (input.monthDay) values.push(`BYMONTHDAY=${input.monthDay}`);
  if (input.endType === "EM_DATA" && input.until) {
    values.push(`UNTIL=${utcRruleDate(input.until)}`);
  }
  if (input.endType === "APOS_OCORRENCIAS" && input.count) {
    values.push(`COUNT=${input.count}`);
  }
  return values.join(";");
}

export function expandRecurrence(params: {
  startAt: Date;
  endAt: Date;
  recurrence: CalendarRecurrenceInput;
}): Array<{ startAt: Date; endAt: Date; instanceKey: string }> {
  const { startAt, endAt, recurrence } = params;
  const durationMs = endAt.getTime() - startAt.getTime();
  const startLocal = zonedParts(startAt, recurrence.timezone);
  const hardHorizon = new Date(startAt);
  hardHorizon.setUTCFullYear(
    hardHorizon.getUTCFullYear() + MAX_HORIZON_YEARS,
  );
  const limit =
    recurrence.endType === "EM_DATA" && recurrence.until
      ? new Date(
          Math.min(recurrence.until.getTime(), hardHorizon.getTime()),
        )
      : hardHorizon;
  const requestedCount =
    recurrence.endType === "APOS_OCORRENCIAS" && recurrence.count
      ? recurrence.count
      : MAX_OCCURRENCES;
  const countLimit = Math.min(requestedCount, MAX_OCCURRENCES);
  const results: Array<{
    startAt: Date;
    endAt: Date;
    instanceKey: string;
  }> = [];

  const addCandidate = (parts: LocalParts | null) => {
    if (!parts || results.length >= countLimit) return;
    const occurrenceStart = localPartsToUtc(parts, recurrence.timezone);
    if (occurrenceStart < startAt || occurrenceStart > limit) return;
    results.push({
      startAt: occurrenceStart,
      endAt: new Date(occurrenceStart.getTime() + durationMs),
      instanceKey: occurrenceStart.toISOString(),
    });
  };

  const type = recurrence.frequency;
  const settings = frequencyParts(type);
  if (
    type === "MENSAL" ||
    type === "BIMESTRAL" ||
    type === "TRIMESTRAL" ||
    type === "SEMESTRAL" ||
    type === "ANUAL"
  ) {
    const annualMultiplier = type === "ANUAL" ? 12 : settings.multiplier;
    const step = recurrence.interval * annualMultiplier;
    const monthDay = recurrence.monthDay ?? startLocal.day;
    for (let offset = 0; offset <= MAX_HORIZON_YEARS * 12; offset += step) {
      const candidate = monthAtOffset(startLocal, offset, monthDay);
      if (
        candidate &&
        localPartsToUtc(candidate, recurrence.timezone) > limit
      ) {
        break;
      }
      addCandidate(candidate);
      if (results.length >= countLimit) break;
    }
    return results;
  }

  const weekDays =
    type === "DIAS_UTEIS"
      ? new Set([1, 2, 3, 4, 5])
      : new Set(
          recurrence.weekDays.length > 0
            ? recurrence.weekDays
            : [new Date(partsAsUtc(startLocal)).getUTCDay()],
        );
  const maxDays = MAX_HORIZON_YEARS * 366;
  const weekly =
    type === "SEMANAL" ||
    type === "QUINZENAL" ||
    type === "DIAS_UTEIS" ||
    (type === "PERSONALIZADA" &&
      /^FREQ=WEEKLY(?:;|$)/i.test(recurrence.rrule ?? ""));
  const interval =
    recurrence.interval * (type === "QUINZENAL" ? 2 : 1);

  for (let dayOffset = 0; dayOffset <= maxDays; dayOffset += 1) {
    const candidate = localDateAtOffset(startLocal, dayOffset);
    const candidateUtc = localPartsToUtc(candidate, recurrence.timezone);
    if (candidateUtc > limit) break;
    const dayOfWeek = new Date(partsAsUtc(candidate)).getUTCDay();
    const eligible = weekly
      ? Math.floor(dayOffset / 7) % interval === 0 && weekDays.has(dayOfWeek)
      : type === "DIARIA"
        ? dayOffset % recurrence.interval === 0
        : type === "PERSONALIZADA"
          ? dayOffset % recurrence.interval === 0
          : weekDays.has(dayOfWeek);
    if (eligible) addCandidate(candidate);
    if (results.length >= countLimit) break;
  }
  return results;
}
