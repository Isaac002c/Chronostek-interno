-- Reproduz a estrutura de calendário encontrada em produção antes da
-- migração 20260724210000, com uma linha em cada tabela.
CREATE TYPE "CalendarEventType" AS ENUM ('REUNIAO', 'EVENTO', 'PRAZO', 'LEMBRETE', 'OUTRO');
CREATE TYPE "EventParticipantStatus" AS ENUM ('CONVIDADO', 'ACEITO', 'RECUSADO', 'TENTATIVO');

INSERT INTO "User" (
  "id", "name", "email", "passwordHash", "role", "status", "createdAt", "updatedAt"
) VALUES (
  'legacy-calendar-user',
  'Usuário legado',
  'legacy-calendar@example.invalid',
  '$2a$12$fixture.only.not.a.production.credential.0000000000000000000',
  'VIEWER',
  'ATIVO',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

CREATE TABLE "CalendarEvent" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "CalendarEventType" NOT NULL DEFAULT 'REUNIAO',
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "allDay" BOOLEAN NOT NULL DEFAULT false,
  "location" TEXT,
  "meetingUrl" TEXT,
  "costCenterId" TEXT,
  "goalId" TEXT,
  "planningPeriodId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CalendarEvent_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "CalendarEventParticipant" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT,
  "status" "EventParticipantStatus" NOT NULL DEFAULT 'CONVIDADO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarEventParticipant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CalendarEventParticipant_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CalendarEventParticipant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CalendarEventParticipant_eventId_userId_key" UNIQUE ("eventId", "userId")
);

INSERT INTO "CalendarEvent" (
  "id", "title", "type", "startAt", "endAt", "createdById", "updatedAt"
) VALUES (
  'legacy-calendar-event',
  'Evento preservado',
  'REUNIAO',
  '2026-07-24T12:00:00Z',
  '2026-07-24T13:00:00Z',
  'legacy-calendar-user',
  CURRENT_TIMESTAMP
);

INSERT INTO "CalendarEventParticipant" (
  "id", "eventId", "userId", "role", "status"
) VALUES (
  'legacy-calendar-participant',
  'legacy-calendar-event',
  'legacy-calendar-user',
  NULL,
  'CONVIDADO'
);
