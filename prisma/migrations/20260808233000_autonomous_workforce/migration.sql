-- CreateEnum
CREATE TYPE "AIProviderRuntimeStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'RATE_LIMITED', 'OFFLINE');

-- CreateEnum
CREATE TYPE "AgentJobStatus" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'WAITING_PROVIDER', 'WAITING_APPROVAL', 'RETRYING', 'COMPLETED', 'FAILED', 'DEAD_LETTER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AgentJobTriggerType" AS ENUM ('MANUAL', 'EVENT', 'SCHEDULE', 'WEBHOOK', 'PROCESS', 'API');

-- CreateEnum
CREATE TYPE "AgentEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProspectBusinessFit" AS ENUM ('TELUN_M_PLUS', 'TELUN_TECHNOLOGY', 'BOTH', 'UNQUALIFIED');

-- CreateEnum
CREATE TYPE "ProspectQualification" AS ENUM ('A', 'B', 'C', 'D', 'UNQUALIFIED');

-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('DISCOVERED', 'ENRICHING', 'QUALIFIED', 'READY_FOR_OUTREACH', 'CONTACTED', 'REPLIED', 'INTERESTED', 'TRIAL', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST', 'DO_NOT_CONTACT');

-- CreateEnum
CREATE TYPE "ProspectVerificationStatus" AS ENUM ('VALID', 'UNVERIFIED', 'INVALID', 'STALE');

-- CreateEnum
CREATE TYPE "ProspectContactType" AS ENUM ('PHONE', 'WHATSAPP', 'EMAIL', 'INSTAGRAM', 'LINKEDIN', 'FACEBOOK', 'WEBSITE', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS', 'INTERNAL');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CommunicationMessageStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'RECEIVED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommunicationThreadStatus" AS ENUM ('OPEN', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OutreachEnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'REPLIED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarketingDraftStatus" AS ENUM ('DRAFT', 'WAITING_APPROVAL', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IntegrationRuntimeStatus" AS ENUM ('NOT_CONFIGURED', 'CONNECTING', 'ONLINE', 'DEGRADED', 'OFFLINE');
CREATE TABLE "AIProviderState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "AIProviderRuntimeStatus" NOT NULL DEFAULT 'DEGRADED',
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "cooldownUntil" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "latencyMs" INTEGER,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIProviderState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "agentId" TEXT NOT NULL,
    "processId" TEXT,
    "taskId" TEXT,
    "parentJobId" TEXT,
    "jobType" TEXT NOT NULL,
    "triggerType" "AgentJobTriggerType" NOT NULL,
    "payload" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "status" "AgentJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "cancellationRequestedAt" TIMESTAMP(3),
    "result" JSONB,
    "lastError" TEXT,
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "triggerType" "AgentJobTriggerType" NOT NULL DEFAULT 'SCHEDULE',
    "cronExpression" TEXT,
    "intervalMinutes" INTEGER,
    "timeZone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "payload" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastEnqueuedAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "agentId" TEXT,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB,
    "status" "AgentEventStatus" NOT NULL DEFAULT 'PENDING',
    "deduplicationKey" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectList" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icp" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "companyName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "tradeName" TEXT,
    "cnpj" TEXT,
    "segment" TEXT,
    "cnae" TEXT,
    "companySize" TEXT,
    "city" TEXT,
    "state" TEXT,
    "address" TEXT,
    "website" TEXT,
    "websiteDomain" TEXT,
    "commercialPhone" TEXT,
    "commercialWhatsApp" TEXT,
    "commercialEmail" TEXT,
    "instagram" TEXT,
    "linkedin" TEXT,
    "facebook" TEXT,
    "otherSocials" JSONB,
    "contactName" TEXT,
    "contactRole" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificationStatus" "ProspectVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "marketingFitScore" INTEGER NOT NULL DEFAULT 0,
    "technologyFitScore" INTEGER NOT NULL DEFAULT 0,
    "overallScore" INTEGER NOT NULL DEFAULT 0,
    "businessFit" "ProspectBusinessFit" NOT NULL DEFAULT 'UNQUALIFIED',
    "qualification" "ProspectQualification" NOT NULL DEFAULT 'UNQUALIFIED',
    "qualificationReason" TEXT,
    "painPoints" JSONB,
    "digitalSignals" JSONB,
    "technologySignals" JSONB,
    "assignedAgentId" TEXT,
    "salesOwnerId" TEXT,
    "leadId" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "nextFollowupAt" TIMESTAMP(3),
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProspectStatus" NOT NULL DEFAULT 'DISCOVERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectSource" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "verificationStatus" "ProspectVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "ProspectSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectContact" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "type" "ProspectContactType" NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "label" TEXT,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "verificationStatus" "ProspectVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "ProspectContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectSignal" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "sourceUrl" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectListMembership" (
    "listId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectListMembership_pkey" PRIMARY KEY ("listId","prospectId")
);

-- CreateTable
CREATE TABLE "ProspectBrief" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "painPoints" JSONB,
    "approach" TEXT,
    "draft" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationThread" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "channel" "CommunicationChannel" NOT NULL,
    "provider" TEXT NOT NULL,
    "providerThreadId" TEXT,
    "prospectId" TEXT,
    "leadId" TEXT,
    "clientId" TEXT,
    "status" "CommunicationThreadStatus" NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "provider" TEXT NOT NULL,
    "direction" "CommunicationDirection" NOT NULL,
    "status" "CommunicationMessageStatus" NOT NULL DEFAULT 'DRAFT',
    "agentId" TEXT,
    "message" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "metadata" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuppressionEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuppressionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachCadence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "maxFollowups" INTEGER NOT NULL DEFAULT 3,
    "dailyLimit" INTEGER NOT NULL DEFAULT 20,
    "hourlyLimit" INTEGER NOT NULL DEFAULT 5,
    "businessHourStart" INTEGER NOT NULL DEFAULT 9,
    "businessHourEnd" INTEGER NOT NULL DEFAULT 18,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachCadence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachCadenceStep" (
    "id" TEXT NOT NULL,
    "cadenceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL,
    "template" TEXT NOT NULL,

    CONSTRAINT "OutreachCadenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachEnrollment" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "cadenceId" TEXT NOT NULL,
    "status" "OutreachEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "nextStepOrder" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingContentDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "campaignId" TEXT,
    "agentId" TEXT NOT NULL,
    "segment" TEXT,
    "businessFit" "ProspectBusinessFit",
    "contentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "brief" TEXT,
    "metadata" JSONB,
    "status" "MarketingDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingContentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instanceName" TEXT,
    "status" "IntegrationRuntimeStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "config" JSONB,
    "lastHealthAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIProviderState_status_idx" ON "AIProviderState"("status");

-- CreateIndex
CREATE INDEX "AIProviderState_cooldownUntil_idx" ON "AIProviderState"("cooldownUntil");

-- CreateIndex
CREATE UNIQUE INDEX "AIProviderState_tenantId_provider_model_key" ON "AIProviderState"("tenantId", "provider", "model");

-- CreateIndex
CREATE INDEX "AgentJob_status_scheduledAt_idx" ON "AgentJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "AgentJob_lockedUntil_idx" ON "AgentJob"("lockedUntil");

-- CreateIndex
CREATE INDEX "AgentJob_agentId_status_idx" ON "AgentJob"("agentId", "status");

-- CreateIndex
CREATE INDEX "AgentJob_processId_idx" ON "AgentJob"("processId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentJob_tenantId_idempotencyKey_key" ON "AgentJob"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AgentSchedule_enabled_nextRunAt_idx" ON "AgentSchedule"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "AgentSchedule_agentId_idx" ON "AgentSchedule"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSchedule_tenantId_name_key" ON "AgentSchedule"("tenantId", "name");

-- CreateIndex
CREATE INDEX "AgentEvent_status_availableAt_idx" ON "AgentEvent"("status", "availableAt");

-- CreateIndex
CREATE INDEX "AgentEvent_type_idx" ON "AgentEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "AgentEvent_tenantId_deduplicationKey_key" ON "AgentEvent"("tenantId", "deduplicationKey");

-- CreateIndex
CREATE INDEX "ProspectList_status_idx" ON "ProspectList"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProspectList_tenantId_name_key" ON "ProspectList"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_cnpj_key" ON "Prospect"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_leadId_key" ON "Prospect"("leadId");

-- CreateIndex
CREATE INDEX "Prospect_tenantId_status_idx" ON "Prospect"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Prospect_businessFit_qualification_idx" ON "Prospect"("businessFit", "qualification");

-- CreateIndex
CREATE INDEX "Prospect_overallScore_idx" ON "Prospect"("overallScore");

-- CreateIndex
CREATE INDEX "Prospect_normalizedName_idx" ON "Prospect"("normalizedName");

-- CreateIndex
CREATE INDEX "Prospect_websiteDomain_idx" ON "Prospect"("websiteDomain");

-- CreateIndex
CREATE INDEX "Prospect_commercialPhone_idx" ON "Prospect"("commercialPhone");

-- CreateIndex
CREATE INDEX "Prospect_commercialEmail_idx" ON "Prospect"("commercialEmail");

-- CreateIndex
CREATE INDEX "Prospect_doNotContact_idx" ON "Prospect"("doNotContact");

-- CreateIndex
CREATE INDEX "ProspectSource_prospectId_field_idx" ON "ProspectSource"("prospectId", "field");

-- CreateIndex
CREATE INDEX "ProspectSource_verificationStatus_idx" ON "ProspectSource"("verificationStatus");

-- CreateIndex
CREATE INDEX "ProspectContact_type_normalizedValue_idx" ON "ProspectContact"("type", "normalizedValue");

-- CreateIndex
CREATE INDEX "ProspectContact_verificationStatus_idx" ON "ProspectContact"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ProspectContact_prospectId_type_normalizedValue_key" ON "ProspectContact"("prospectId", "type", "normalizedValue");

-- CreateIndex
CREATE INDEX "ProspectSignal_prospectId_category_idx" ON "ProspectSignal"("prospectId", "category");

-- CreateIndex
CREATE INDEX "ProspectListMembership_prospectId_idx" ON "ProspectListMembership"("prospectId");

-- CreateIndex
CREATE INDEX "ProspectBrief_prospectId_idx" ON "ProspectBrief"("prospectId");

-- CreateIndex
CREATE INDEX "ProspectBrief_agentId_idx" ON "ProspectBrief"("agentId");

-- CreateIndex
CREATE INDEX "CommunicationThread_prospectId_idx" ON "CommunicationThread"("prospectId");

-- CreateIndex
CREATE INDEX "CommunicationThread_leadId_idx" ON "CommunicationThread"("leadId");

-- CreateIndex
CREATE INDEX "CommunicationThread_clientId_idx" ON "CommunicationThread"("clientId");

-- CreateIndex
CREATE INDEX "CommunicationThread_channel_status_idx" ON "CommunicationThread"("channel", "status");

-- CreateIndex
CREATE INDEX "CommunicationMessage_threadId_createdAt_idx" ON "CommunicationMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationMessage_status_scheduledAt_idx" ON "CommunicationMessage"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationMessage_provider_providerMessageId_key" ON "CommunicationMessage"("provider", "providerMessageId");

-- CreateIndex
CREATE INDEX "SuppressionEntry_active_idx" ON "SuppressionEntry"("active");

-- CreateIndex
CREATE UNIQUE INDEX "SuppressionEntry_tenantId_type_normalizedValue_key" ON "SuppressionEntry"("tenantId", "type", "normalizedValue");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachCadence_tenantId_name_key" ON "OutreachCadence"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachCadenceStep_cadenceId_order_key" ON "OutreachCadenceStep"("cadenceId", "order");

-- CreateIndex
CREATE INDEX "OutreachEnrollment_status_nextRunAt_idx" ON "OutreachEnrollment"("status", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachEnrollment_prospectId_cadenceId_key" ON "OutreachEnrollment"("prospectId", "cadenceId");

-- CreateIndex
CREATE INDEX "MarketingContentDraft_campaignId_idx" ON "MarketingContentDraft"("campaignId");

-- CreateIndex
CREATE INDEX "MarketingContentDraft_agentId_status_idx" ON "MarketingContentDraft"("agentId", "status");

-- CreateIndex
CREATE INDEX "IntegrationConnection_status_idx" ON "IntegrationConnection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_tenantId_provider_name_key" ON "IntegrationConnection"("tenantId", "provider", "name");

-- AddForeignKey
ALTER TABLE "AgentJob" ADD CONSTRAINT "AgentJob_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentJob" ADD CONSTRAINT "AgentJob_processId_fkey" FOREIGN KEY ("processId") REFERENCES "ProcessDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentJob" ADD CONSTRAINT "AgentJob_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AgentTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentJob" ADD CONSTRAINT "AgentJob_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "AgentJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSchedule" ADD CONSTRAINT "AgentSchedule_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentEvent" ADD CONSTRAINT "AgentEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectList" ADD CONSTRAINT "ProspectList_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_salesOwnerId_fkey" FOREIGN KEY ("salesOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectSource" ADD CONSTRAINT "ProspectSource_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectContact" ADD CONSTRAINT "ProspectContact_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectSignal" ADD CONSTRAINT "ProspectSignal_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectListMembership" ADD CONSTRAINT "ProspectListMembership_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ProspectList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectListMembership" ADD CONSTRAINT "ProspectListMembership_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectBrief" ADD CONSTRAINT "ProspectBrief_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectBrief" ADD CONSTRAINT "ProspectBrief_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationThread" ADD CONSTRAINT "CommunicationThread_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationThread" ADD CONSTRAINT "CommunicationThread_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationThread" ADD CONSTRAINT "CommunicationThread_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommunicationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachCadenceStep" ADD CONSTRAINT "OutreachCadenceStep_cadenceId_fkey" FOREIGN KEY ("cadenceId") REFERENCES "OutreachCadence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEnrollment" ADD CONSTRAINT "OutreachEnrollment_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEnrollment" ADD CONSTRAINT "OutreachEnrollment_cadenceId_fkey" FOREIGN KEY ("cadenceId") REFERENCES "OutreachCadence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingContentDraft" ADD CONSTRAINT "MarketingContentDraft_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingContentDraft" ADD CONSTRAINT "MarketingContentDraft_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

