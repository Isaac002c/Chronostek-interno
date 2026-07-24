-- Calendário corporativo e integração Google Calendar.
-- Migração estritamente aditiva: as tabelas CalendarEvent e
-- CalendarEventParticipant podem já existir em produção e são preservadas.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarEventType') THEN
    CREATE TYPE "CalendarEventType" AS ENUM ('REUNIAO', 'COMPROMISSO', 'EVENTO_IMPORTANTE', 'APRESENTACAO', 'ENTREGA', 'PRAZO', 'TREINAMENTO', 'EVENTO_COMERCIAL', 'EVENTO_FINANCEIRO', 'EVENTO_INTERNO', 'EVENTO', 'LEMBRETE', 'OUTRO');
  END IF;
END $$;

ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'REUNIAO';
ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'COMPROMISSO';
ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'EVENTO_IMPORTANTE';
ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'APRESENTACAO';
ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'ENTREGA';
ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'PRAZO';
ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'TREINAMENTO';
ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'EVENTO_COMERCIAL';
ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'EVENTO_FINANCEIRO';
ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'EVENTO_INTERNO';
ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'EVENTO';
ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'LEMBRETE';
ALTER TYPE "CalendarEventType" ADD VALUE IF NOT EXISTS 'OUTRO';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventParticipantStatus') THEN
    CREATE TYPE "EventParticipantStatus" AS ENUM ('CONVIDADO', 'ACEITO', 'RECUSADO', 'TENTATIVO', 'CANCELADO');
  END IF;
END $$;

ALTER TYPE "EventParticipantStatus" ADD VALUE IF NOT EXISTS 'CONVIDADO';
ALTER TYPE "EventParticipantStatus" ADD VALUE IF NOT EXISTS 'ACEITO';
ALTER TYPE "EventParticipantStatus" ADD VALUE IF NOT EXISTS 'RECUSADO';
ALTER TYPE "EventParticipantStatus" ADD VALUE IF NOT EXISTS 'TENTATIVO';
ALTER TYPE "EventParticipantStatus" ADD VALUE IF NOT EXISTS 'CANCELADO';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ModuleKey') THEN
    ALTER TYPE "ModuleKey" ADD VALUE IF NOT EXISTS 'CALENDARIO';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarEventStatus') THEN
    CREATE TYPE "CalendarEventStatus" AS ENUM ('AGENDADO', 'CONCLUIDO', 'CANCELADO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarPrivacy') THEN
    CREATE TYPE "CalendarPrivacy" AS ENUM ('INTERNO', 'PARTICIPANTES', 'PRIVADO', 'CONFIDENCIAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarPriority') THEN
    CREATE TYPE "CalendarPriority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarOrigin') THEN
    CREATE TYPE "CalendarOrigin" AS ENUM ('TELUN', 'GOOGLE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarParticipantKind') THEN
    CREATE TYPE "CalendarParticipantKind" AS ENUM ('INTERNO', 'EXTERNO', 'CLIENTE', 'FORNECEDOR', 'MANUAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarRecurrenceFrequency') THEN
    CREATE TYPE "CalendarRecurrenceFrequency" AS ENUM ('DIARIA', 'DIAS_UTEIS', 'SEMANAL', 'QUINZENAL', 'MENSAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'PERSONALIZADA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarRecurrenceEndType') THEN
    CREATE TYPE "CalendarRecurrenceEndType" AS ENUM ('NUNCA', 'EM_DATA', 'APOS_OCORRENCIAS');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarReminderUnit') THEN
    CREATE TYPE "CalendarReminderUnit" AS ENUM ('MINUTOS', 'HORAS', 'DIAS', 'SEMANAS');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarIntegrationStatus') THEN
    CREATE TYPE "CalendarIntegrationStatus" AS ENUM ('CONECTADO', 'DESCONECTADO', 'ERRO', 'REVOGADO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarSyncDirection') THEN
    CREATE TYPE "CalendarSyncDirection" AS ENUM ('TELUN_PARA_GOOGLE', 'GOOGLE_PARA_TELUN', 'BIDIRECIONAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarSyncJobType') THEN
    CREATE TYPE "CalendarSyncJobType" AS ENUM ('FULL_SYNC', 'INCREMENTAL_SYNC', 'PUSH_EVENT', 'DELETE_EVENT', 'RENEW_CHANNEL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarSyncJobStatus') THEN
    CREATE TYPE "CalendarSyncJobStatus" AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'ERRO', 'CANCELADO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarConflictStatus') THEN
    CREATE TYPE "CalendarConflictStatus" AS ENUM ('PENDENTE', 'RESOLVIDO_TELUN', 'RESOLVIDO_GOOGLE', 'MESCLADO', 'IGNORADO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalendarChannelStatus') THEN
    CREATE TYPE "CalendarChannelStatus" AS ENUM ('ATIVO', 'EXPIRADO', 'SUBSTITUIDO', 'ERRO');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CalendarEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'default',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "CalendarEventType" NOT NULL DEFAULT 'REUNIAO',
  "status" "CalendarEventStatus" NOT NULL DEFAULT 'AGENDADO',
  "priority" "CalendarPriority" NOT NULL DEFAULT 'MEDIA',
  "privacy" "CalendarPrivacy" NOT NULL DEFAULT 'INTERNO',
  "origin" "CalendarOrigin" NOT NULL DEFAULT 'TELUN',
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "allDay" BOOLEAN NOT NULL DEFAULT false,
  "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  "location" TEXT,
  "meetingUrl" TEXT,
  "category" TEXT,
  "color" TEXT,
  "department" TEXT,
  "notes" TEXT,
  "costCenterId" TEXT,
  "goalId" TEXT,
  "planningPeriodId" TEXT,
  "clientId" TEXT,
  "supplierId" TEXT,
  "projectId" TEXT,
  "responsibleId" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "recurrenceId" TEXT,
  "recurrenceInstanceKey" TEXT,
  "originalStartAt" TIMESTAMP(3),
  "parentEventId" TEXT,
  "syncPending" BOOLEAN NOT NULL DEFAULT false,
  "sourceVersion" INTEGER NOT NULL DEFAULT 1,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CalendarEvent"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS "status" "CalendarEventStatus" NOT NULL DEFAULT 'AGENDADO',
  ADD COLUMN IF NOT EXISTS "priority" "CalendarPriority" NOT NULL DEFAULT 'MEDIA',
  ADD COLUMN IF NOT EXISTS "privacy" "CalendarPrivacy" NOT NULL DEFAULT 'INTERNO',
  ADD COLUMN IF NOT EXISTS "origin" "CalendarOrigin" NOT NULL DEFAULT 'TELUN',
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "color" TEXT,
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "clientId" TEXT,
  ADD COLUMN IF NOT EXISTS "supplierId" TEXT,
  ADD COLUMN IF NOT EXISTS "projectId" TEXT,
  ADD COLUMN IF NOT EXISTS "responsibleId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedById" TEXT,
  ADD COLUMN IF NOT EXISTS "recurrenceId" TEXT,
  ADD COLUMN IF NOT EXISTS "recurrenceInstanceKey" TEXT,
  ADD COLUMN IF NOT EXISTS "originalStartAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "parentEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "syncPending" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sourceVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "CalendarEventParticipant" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT,
  "clientId" TEXT,
  "supplierId" TEXT,
  "name" TEXT,
  "email" TEXT,
  "kind" "CalendarParticipantKind" NOT NULL DEFAULT 'INTERNO',
  "role" TEXT NOT NULL DEFAULT 'PARTICIPANTE',
  "status" "EventParticipantStatus" NOT NULL DEFAULT 'CONVIDADO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarEventParticipant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CalendarEventParticipant"
  ALTER COLUMN "userId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "clientId" TEXT,
  ADD COLUMN IF NOT EXISTS "supplierId" TEXT,
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "kind" "CalendarParticipantKind" NOT NULL DEFAULT 'INTERNO',
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "CalendarEventParticipant"
SET "role" = 'PARTICIPANTE'
WHERE "role" IS NULL;

ALTER TABLE "CalendarEventParticipant"
  ALTER COLUMN "role" SET DEFAULT 'PARTICIPANTE',
  ALTER COLUMN "role" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "CalendarEventReminder" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "unit" "CalendarReminderUnit" NOT NULL DEFAULT 'MINUTOS',
  "minutesBefore" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarEventReminder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CalendarRecurrence" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'default',
  "frequency" "CalendarRecurrenceFrequency" NOT NULL,
  "interval" INTEGER NOT NULL DEFAULT 1,
  "rrule" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  "weekDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "monthDay" INTEGER,
  "endType" "CalendarRecurrenceEndType" NOT NULL DEFAULT 'NUNCA',
  "until" TIMESTAMP(3),
  "count" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarRecurrence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CalendarIntegration" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'default',
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'GOOGLE',
  "googleAccountId" TEXT,
  "googleEmail" TEXT,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "grantedScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "selectedCalendarId" TEXT,
  "selectedCalendarName" TEXT,
  "direction" "CalendarSyncDirection" NOT NULL DEFAULT 'BIDIRECIONAL',
  "status" "CalendarIntegrationStatus" NOT NULL DEFAULT 'DESCONECTADO',
  "syncTokenEncrypted" TEXT,
  "lastSyncAt" TIMESTAMP(3),
  "lastSuccessfulSyncAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disconnectedAt" TIMESTAMP(3),
  CONSTRAINT "CalendarIntegration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GoogleOAuthState" (
  "id" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "redirectPath" TEXT NOT NULL DEFAULT '/dashboard/calendario',
  "codeVerifierEncrypted" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoogleOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CalendarExternalMapping" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "externalCalendarId" TEXT NOT NULL,
  "externalEventId" TEXT NOT NULL,
  "etag" TEXT,
  "iCalUid" TEXT,
  "htmlLink" TEXT,
  "googleUpdatedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "lastTelunVersion" INTEGER NOT NULL DEFAULT 0,
  "deletedExternally" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarExternalMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CalendarSyncConflict" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "externalEventId" TEXT,
  "telunSnapshot" JSONB NOT NULL,
  "googleSnapshot" JSONB NOT NULL,
  "status" "CalendarConflictStatus" NOT NULL DEFAULT 'PENDENTE',
  "resolution" JSONB,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarSyncConflict_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CalendarNotificationChannel" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "channelTokenHash" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "resourceUri" TEXT,
  "expiration" TIMESTAMP(3) NOT NULL,
  "status" "CalendarChannelStatus" NOT NULL DEFAULT 'ATIVO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarNotificationChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CalendarSyncJob" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT,
  "type" "CalendarSyncJobType" NOT NULL,
  "status" "CalendarSyncJobStatus" NOT NULL DEFAULT 'PENDENTE',
  "idempotencyKey" TEXT NOT NULL,
  "payload" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 8,
  "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "completedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarSyncJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CalendarEventHistory" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "origin" "CalendarOrigin" NOT NULL DEFAULT 'TELUN',
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarEventHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CalendarEventTypeConfig" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'default',
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "icon" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalendarEventTypeConfig_pkey" PRIMARY KEY ("id")
);

-- Unicidade e índices operacionais.
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarEvent_tenantId_recurrenceInstanceKey_key" ON "CalendarEvent"("tenantId", "recurrenceInstanceKey");
CREATE INDEX IF NOT EXISTS "CalendarEvent_tenantId_startAt_endAt_idx" ON "CalendarEvent"("tenantId", "startAt", "endAt");
CREATE INDEX IF NOT EXISTS "CalendarEvent_type_idx" ON "CalendarEvent"("type");
CREATE INDEX IF NOT EXISTS "CalendarEvent_status_idx" ON "CalendarEvent"("status");
CREATE INDEX IF NOT EXISTS "CalendarEvent_privacy_idx" ON "CalendarEvent"("privacy");
CREATE INDEX IF NOT EXISTS "CalendarEvent_costCenterId_idx" ON "CalendarEvent"("costCenterId");
CREATE INDEX IF NOT EXISTS "CalendarEvent_goalId_idx" ON "CalendarEvent"("goalId");
CREATE INDEX IF NOT EXISTS "CalendarEvent_planningPeriodId_idx" ON "CalendarEvent"("planningPeriodId");
CREATE INDEX IF NOT EXISTS "CalendarEvent_clientId_idx" ON "CalendarEvent"("clientId");
CREATE INDEX IF NOT EXISTS "CalendarEvent_supplierId_idx" ON "CalendarEvent"("supplierId");
CREATE INDEX IF NOT EXISTS "CalendarEvent_projectId_idx" ON "CalendarEvent"("projectId");
CREATE INDEX IF NOT EXISTS "CalendarEvent_responsibleId_idx" ON "CalendarEvent"("responsibleId");
CREATE INDEX IF NOT EXISTS "CalendarEvent_recurrenceId_idx" ON "CalendarEvent"("recurrenceId");
CREATE INDEX IF NOT EXISTS "CalendarEvent_parentEventId_idx" ON "CalendarEvent"("parentEventId");
CREATE INDEX IF NOT EXISTS "CalendarEvent_deletedAt_idx" ON "CalendarEvent"("deletedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarEventParticipant_eventId_userId_key" ON "CalendarEventParticipant"("eventId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarEventParticipant_eventId_email_key" ON "CalendarEventParticipant"("eventId", "email");
CREATE INDEX IF NOT EXISTS "CalendarEventParticipant_eventId_idx" ON "CalendarEventParticipant"("eventId");
CREATE INDEX IF NOT EXISTS "CalendarEventParticipant_userId_idx" ON "CalendarEventParticipant"("userId");
CREATE INDEX IF NOT EXISTS "CalendarEventParticipant_clientId_idx" ON "CalendarEventParticipant"("clientId");
CREATE INDEX IF NOT EXISTS "CalendarEventParticipant_supplierId_idx" ON "CalendarEventParticipant"("supplierId");
CREATE INDEX IF NOT EXISTS "CalendarEventParticipant_email_idx" ON "CalendarEventParticipant"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarEventReminder_eventId_minutesBefore_key" ON "CalendarEventReminder"("eventId", "minutesBefore");
CREATE INDEX IF NOT EXISTS "CalendarEventReminder_eventId_idx" ON "CalendarEventReminder"("eventId");
CREATE INDEX IF NOT EXISTS "CalendarRecurrence_tenantId_active_idx" ON "CalendarRecurrence"("tenantId", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarIntegration_userId_key" ON "CalendarIntegration"("userId");
CREATE INDEX IF NOT EXISTS "CalendarIntegration_tenantId_status_idx" ON "CalendarIntegration"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CalendarIntegration_googleEmail_idx" ON "CalendarIntegration"("googleEmail");
CREATE UNIQUE INDEX IF NOT EXISTS "GoogleOAuthState_stateHash_key" ON "GoogleOAuthState"("stateHash");
CREATE INDEX IF NOT EXISTS "GoogleOAuthState_userId_expiresAt_idx" ON "GoogleOAuthState"("userId", "expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarExternalMapping_integrationId_externalCalendarId_externalEventId_key" ON "CalendarExternalMapping"("integrationId", "externalCalendarId", "externalEventId");
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarExternalMapping_integrationId_eventId_key" ON "CalendarExternalMapping"("integrationId", "eventId");
CREATE INDEX IF NOT EXISTS "CalendarExternalMapping_eventId_idx" ON "CalendarExternalMapping"("eventId");
CREATE INDEX IF NOT EXISTS "CalendarExternalMapping_iCalUid_idx" ON "CalendarExternalMapping"("iCalUid");
CREATE INDEX IF NOT EXISTS "CalendarSyncConflict_integrationId_status_idx" ON "CalendarSyncConflict"("integrationId", "status");
CREATE INDEX IF NOT EXISTS "CalendarSyncConflict_eventId_idx" ON "CalendarSyncConflict"("eventId");
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarNotificationChannel_channelId_key" ON "CalendarNotificationChannel"("channelId");
CREATE INDEX IF NOT EXISTS "CalendarNotificationChannel_integrationId_status_expiration_idx" ON "CalendarNotificationChannel"("integrationId", "status", "expiration");
CREATE INDEX IF NOT EXISTS "CalendarNotificationChannel_resourceId_idx" ON "CalendarNotificationChannel"("resourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarSyncJob_idempotencyKey_key" ON "CalendarSyncJob"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CalendarSyncJob_status_runAt_idx" ON "CalendarSyncJob"("status", "runAt");
CREATE INDEX IF NOT EXISTS "CalendarSyncJob_integrationId_status_idx" ON "CalendarSyncJob"("integrationId", "status");
CREATE INDEX IF NOT EXISTS "CalendarEventHistory_eventId_createdAt_idx" ON "CalendarEventHistory"("eventId", "createdAt");
CREATE INDEX IF NOT EXISTS "CalendarEventHistory_userId_createdAt_idx" ON "CalendarEventHistory"("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CalendarEventTypeConfig_tenantId_key_key" ON "CalendarEventTypeConfig"("tenantId", "key");
CREATE INDEX IF NOT EXISTS "CalendarEventTypeConfig_tenantId_active_sortOrder_idx" ON "CalendarEventTypeConfig"("tenantId", "active", "sortOrder");

-- Relações novas. Os vínculos históricos de CalendarEvent são mantidos.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_recurrenceId_fkey') THEN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "CalendarRecurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_parentEventId_fkey') THEN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_parentEventId_fkey" FOREIGN KEY ("parentEventId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEventParticipant_eventId_fkey') THEN
    ALTER TABLE "CalendarEventParticipant" ADD CONSTRAINT "CalendarEventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEventReminder_eventId_fkey') THEN
    ALTER TABLE "CalendarEventReminder" ADD CONSTRAINT "CalendarEventReminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarExternalMapping_integrationId_fkey') THEN
    ALTER TABLE "CalendarExternalMapping" ADD CONSTRAINT "CalendarExternalMapping_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "CalendarIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarExternalMapping_eventId_fkey') THEN
    ALTER TABLE "CalendarExternalMapping" ADD CONSTRAINT "CalendarExternalMapping_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarSyncConflict_integrationId_fkey') THEN
    ALTER TABLE "CalendarSyncConflict" ADD CONSTRAINT "CalendarSyncConflict_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "CalendarIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarSyncConflict_eventId_fkey') THEN
    ALTER TABLE "CalendarSyncConflict" ADD CONSTRAINT "CalendarSyncConflict_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarNotificationChannel_integrationId_fkey') THEN
    ALTER TABLE "CalendarNotificationChannel" ADD CONSTRAINT "CalendarNotificationChannel_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "CalendarIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarSyncJob_integrationId_fkey') THEN
    ALTER TABLE "CalendarSyncJob" ADD CONSTRAINT "CalendarSyncJob_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "CalendarIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEventHistory_eventId_fkey') THEN
    ALTER TABLE "CalendarEventHistory" ADD CONSTRAINT "CalendarEventHistory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_costCenterId_fkey') THEN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_goalId_fkey') THEN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_planningPeriodId_fkey') THEN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_planningPeriodId_fkey" FOREIGN KEY ("planningPeriodId") REFERENCES "PlanningPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_createdById_fkey') THEN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_clientId_fkey') THEN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_supplierId_fkey') THEN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_projectId_fkey') THEN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_responsibleId_fkey') THEN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEvent_updatedById_fkey') THEN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEventParticipant_userId_fkey') THEN
    ALTER TABLE "CalendarEventParticipant" ADD CONSTRAINT "CalendarEventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEventParticipant_clientId_fkey') THEN
    ALTER TABLE "CalendarEventParticipant" ADD CONSTRAINT "CalendarEventParticipant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEventParticipant_supplierId_fkey') THEN
    ALTER TABLE "CalendarEventParticipant" ADD CONSTRAINT "CalendarEventParticipant_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarIntegration_userId_fkey') THEN
    ALTER TABLE "CalendarIntegration" ADD CONSTRAINT "CalendarIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GoogleOAuthState_userId_fkey') THEN
    ALTER TABLE "GoogleOAuthState" ADD CONSTRAINT "GoogleOAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarSyncConflict_resolvedById_fkey') THEN
    ALTER TABLE "CalendarSyncConflict" ADD CONSTRAINT "CalendarSyncConflict_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEventHistory_userId_fkey') THEN
    ALTER TABLE "CalendarEventHistory" ADD CONSTRAINT "CalendarEventHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CalendarEventTypeConfig_createdById_fkey') THEN
    ALTER TABLE "CalendarEventTypeConfig" ADD CONSTRAINT "CalendarEventTypeConfig_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Tipos visuais padrão; nenhuma linha existente é alterada.
INSERT INTO "CalendarEventTypeConfig" ("id", "tenantId", "key", "label", "color", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('calendar-type-reuniao', 'default', 'REUNIAO', 'Reunião', '#2563eb', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('calendar-type-compromisso', 'default', 'COMPROMISSO', 'Compromisso', '#7c3aed', 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('calendar-type-importante', 'default', 'EVENTO_IMPORTANTE', 'Evento importante', '#dc2626', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('calendar-type-apresentacao', 'default', 'APRESENTACAO', 'Apresentação', '#0891b2', 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('calendar-type-entrega', 'default', 'ENTREGA', 'Entrega', '#ea580c', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('calendar-type-prazo', 'default', 'PRAZO', 'Prazo', '#be123c', 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('calendar-type-treinamento', 'default', 'TREINAMENTO', 'Treinamento', '#16a34a', 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('calendar-type-comercial', 'default', 'EVENTO_COMERCIAL', 'Evento comercial', '#0d9488', 80, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('calendar-type-financeiro', 'default', 'EVENTO_FINANCEIRO', 'Evento financeiro', '#ca8a04', 90, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('calendar-type-interno', 'default', 'EVENTO_INTERNO', 'Evento interno', '#475569', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "key") DO NOTHING;
