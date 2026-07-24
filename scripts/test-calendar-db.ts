import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { calendarEventCreateSchema } from "../src/lib/calendar/schemas";
import {
  createCalendarEventSeries,
  deleteCalendarEvents,
  updateCalendarEvents,
} from "../src/lib/calendar/events";

function assertIsolatedDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (
    process.env.ALLOW_CALENDAR_DB_TEST !== "true" ||
    !databaseUrl ||
    !new URL(databaseUrl).pathname.includes("calendar_runtime_test")
  ) {
    throw new Error(
      "Teste recusado: use banco isolado calendar_runtime_test e ALLOW_CALENDAR_DB_TEST=true.",
    );
  }
}

async function main() {
  assertIsolatedDatabase();
  const marker = randomUUID();
  const email = `calendar-test-${marker}@example.invalid`;
  const user = await prisma.user.create({
    data: {
      name: "Calendar Runtime Test",
      email,
      passwordHash:
        "$2a$12$fixture.only.not.a.production.credential.0000000000000000000",
      role: "SUPER_ADMIN",
      status: "ATIVO",
    },
  });
  let recurrenceId: string | null = null;
  try {
    const input = calendarEventCreateSchema.parse({
      title: `Evento runtime ${marker}`,
      startAt: "2026-07-27T12:00:00.000Z",
      endAt: "2026-07-27T13:00:00.000Z",
      timezone: "America/Sao_Paulo",
      responsibleId: user.id,
      participants: [
        {
          email: "external@example.invalid",
          name: "Participante externo",
          kind: "EXTERNO",
        },
      ],
      reminders: [{ amount: 30, unit: "MINUTOS" }],
      recurrence: {
        frequency: "SEMANAL",
        interval: 1,
        timezone: "America/Sao_Paulo",
        weekDays: [1],
        endType: "APOS_OCORRENCIAS",
        count: 3,
      },
    });
    const created = await createCalendarEventSeries({
      input,
      userId: user.id,
    });
    assert.equal(created.events.length, 3);
    assert.equal(created.events[0].participants.length, 1);
    assert.equal(created.events[0].reminders[0].minutesBefore, 30);
    recurrenceId = created.recurrence?.id ?? null;
    assert(recurrenceId);

    const first = created.events[0];
    const updated = await updateCalendarEvents({
      event: first,
      input: { title: `Evento atualizado ${marker}` },
      scope: "current",
      userId: user.id,
    });
    assert.equal(updated.affected, 1);
    assert.equal(updated.events[0].title, `Evento atualizado ${marker}`);
    assert.equal(updated.events[0].sourceVersion, 2);

    const removed = await deleteCalendarEvents({
      event: first,
      scope: "series",
      userId: user.id,
    });
    assert.equal(removed.affected, 3);
    assert.equal(
      await prisma.calendarEvent.count({
        where: { recurrenceId, deletedAt: { not: null } },
      }),
      3,
    );
    console.log(
      JSON.stringify({
        ok: true,
        occurrences: created.events.length,
        updated: updated.affected,
        softDeleted: removed.affected,
      }),
    );
  } finally {
    if (recurrenceId) {
      await prisma.calendarEvent.deleteMany({ where: { recurrenceId } });
      await prisma.calendarRecurrence.deleteMany({ where: { id: recurrenceId } });
    }
    await prisma.user.deleteMany({ where: { email } });
  }
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Erro desconhecido.",
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
