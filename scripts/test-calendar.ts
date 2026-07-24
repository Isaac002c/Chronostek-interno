import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import {
  decryptCalendarSecret,
  encryptCalendarSecret,
  hashOpaqueToken,
} from "../src/lib/calendar/crypto";
import {
  calendarEventCreateSchema,
  calendarRecurrenceSchema,
} from "../src/lib/calendar/schemas";
import {
  buildRrule,
  expandRecurrence,
} from "../src/lib/calendar/recurrence";
import { canCalendar } from "../src/lib/calendar-permissions";

const previousKey = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

function testCrypto() {
  const value = "refresh-token-confidential";
  const encrypted = encryptCalendarSecret(value, "test");
  assert.notEqual(encrypted, value);
  assert.equal(encrypted.split(".").length, 4);
  assert.equal(decryptCalendarSecret(encrypted, "test"), value);
  assert.throws(() => decryptCalendarSecret(encrypted, "other-purpose"));
  assert.equal(hashOpaqueToken("same"), hashOpaqueToken("same"));
  assert.notEqual(hashOpaqueToken("same"), hashOpaqueToken("different"));
}

function recurrenceInput(
  input: Partial<Parameters<typeof calendarRecurrenceSchema.parse>[0]> = {},
) {
  return calendarRecurrenceSchema.parse({
    frequency: "SEMANAL",
    interval: 1,
    timezone: "America/Sao_Paulo",
    weekDays: [1, 3, 5],
    endType: "APOS_OCORRENCIAS",
    count: 6,
    ...input,
  });
}

function testRecurrence() {
  const weekly = recurrenceInput();
  assert.equal(
    buildRrule(weekly),
    "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;COUNT=6",
  );
  const occurrences = expandRecurrence({
    startAt: new Date("2026-07-27T12:00:00.000Z"),
    endAt: new Date("2026-07-27T13:00:00.000Z"),
    recurrence: weekly,
  });
  assert.equal(occurrences.length, 6);
  assert.deepEqual(
    occurrences.slice(0, 3).map((item) => item.startAt.toISOString()),
    [
      "2026-07-27T12:00:00.000Z",
      "2026-07-29T12:00:00.000Z",
      "2026-07-31T12:00:00.000Z",
    ],
  );

  const business = recurrenceInput({
    frequency: "DIAS_UTEIS",
    weekDays: [],
    count: 5,
  });
  const businessDays = expandRecurrence({
    startAt: new Date("2026-07-24T12:00:00.000Z"),
    endAt: new Date("2026-07-24T13:00:00.000Z"),
    recurrence: business,
  });
  assert.deepEqual(
    businessDays.map((item) => item.startAt.toISOString().slice(0, 10)),
    ["2026-07-24", "2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30"],
  );

  const monthly = recurrenceInput({
    frequency: "MENSAL",
    weekDays: [],
    monthDay: 31,
    count: 3,
  });
  const months = expandRecurrence({
    startAt: new Date("2026-07-31T12:00:00.000Z"),
    endAt: new Date("2026-07-31T13:00:00.000Z"),
    recurrence: monthly,
  });
  assert.deepEqual(
    months.map((item) => item.startAt.toISOString().slice(0, 10)),
    ["2026-07-31", "2026-08-31", "2026-10-31"],
  );
}

function testValidationAndPermissions() {
  assert.throws(() =>
    calendarEventCreateSchema.parse({
      title: "Intervalo inválido",
      startAt: "2026-07-24T14:00:00.000Z",
      endAt: "2026-07-24T13:00:00.000Z",
    }),
  );
  const valid = calendarEventCreateSchema.parse({
    title: "Reunião de planejamento",
    startAt: "2026-07-24T13:00:00.000Z",
    endAt: "2026-07-24T14:00:00.000Z",
    participants: [{ email: "user@example.com", kind: "EXTERNO" }],
    reminders: [{ amount: 30, unit: "MINUTOS" }],
  });
  assert.equal(valid.reminders[0].minutesBefore, 30);
  assert.equal(canCalendar("VIEWER", "VIEW"), true);
  assert.equal(canCalendar("VIEWER", "CREATE"), false);
  assert.equal(canCalendar("SUPER_ADMIN", "RESOLVE_CONFLICTS"), true);
  assert.equal(canCalendar("COMERCIAL", "EDIT_ANY"), false);
}

try {
  testCrypto();
  testRecurrence();
  testValidationAndPermissions();
  console.log(
    JSON.stringify({
      ok: true,
      suites: ["crypto", "recurrence", "validation", "permissions"],
    }),
  );
} finally {
  if (previousKey === undefined) {
    delete process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
  } else {
    process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = previousKey;
  }
}
