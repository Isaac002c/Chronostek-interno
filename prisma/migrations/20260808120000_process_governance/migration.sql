-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('PLANEJADO', 'IMPLANTACAO', 'ATIVO', 'EM_REVISAO', 'INATIVO');

-- CreateEnum
CREATE TYPE "ProcessReviewCadence" AS ENUM ('SEMANAL', 'QUINZENAL', 'MENSAL', 'TRIMESTRAL');

-- CreateEnum
CREATE TYPE "ProcessHealth" AS ENUM ('OK', 'ATENCAO', 'CRITICO');

-- CreateEnum
CREATE TYPE "CorrectiveActionStatus" AS ENUM ('ABERTA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "nextAction" TEXT,
ADD COLUMN     "nextActionAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Proposal" ADD COLUMN     "nextAction" TEXT,
ADD COLUMN     "nextActionAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "nextAction" TEXT,
ADD COLUMN     "nextActionAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FinancialEntry" ADD COLUMN     "nextAction" TEXT,
ADD COLUMN     "nextActionAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProcessDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "costCenterId" TEXT,
    "ownerId" TEXT,
    "secondaryOwners" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "objective" TEXT,
    "description" TEXT,
    "trigger" TEXT,
    "inputs" TEXT,
    "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "output" TEXT,
    "sla" TEXT,
    "kpiPrimaryName" TEXT,
    "kpiPrimaryTarget" TEXT,
    "kpiPrimaryUnit" TEXT,
    "kpiSource" TEXT,
    "kpisSecondary" JSONB,
    "target" TEXT,
    "reviewCadence" "ProcessReviewCadence" NOT NULL DEFAULT 'SEMANAL',
    "status" "ProcessStatus" NOT NULL DEFAULT 'ATIVO',
    "version" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3),
    "lastReviewAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "documentationUrl" TEXT,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProcessDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessReview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "processId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodLabel" TEXT,
    "health" "ProcessHealth" NOT NULL DEFAULT 'OK',
    "kpiSnapshot" JSONB,
    "highlights" TEXT,
    "issues" TEXT,
    "decisions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectiveAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL,
    "problem" TEXT,
    "costCenterId" TEXT,
    "processId" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "action" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIA',
    "status" "CorrectiveActionStatus" NOT NULL DEFAULT 'ABERTA',
    "dueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrectiveAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessDefinition_status_idx" ON "ProcessDefinition"("status");

-- CreateIndex
CREATE INDEX "ProcessDefinition_costCenterId_idx" ON "ProcessDefinition"("costCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessDefinition_tenantId_code_key" ON "ProcessDefinition"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ProcessReview_processId_idx" ON "ProcessReview"("processId");

-- CreateIndex
CREATE INDEX "ProcessReview_reviewDate_idx" ON "ProcessReview"("reviewDate");

-- CreateIndex
CREATE INDEX "CorrectiveAction_status_idx" ON "CorrectiveAction"("status");

-- CreateIndex
CREATE INDEX "CorrectiveAction_processId_idx" ON "CorrectiveAction"("processId");

-- CreateIndex
CREATE INDEX "CorrectiveAction_costCenterId_idx" ON "CorrectiveAction"("costCenterId");

-- AddForeignKey
ALTER TABLE "ProcessDefinition" ADD CONSTRAINT "ProcessDefinition_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessDefinition" ADD CONSTRAINT "ProcessDefinition_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessReview" ADD CONSTRAINT "ProcessReview_processId_fkey" FOREIGN KEY ("processId") REFERENCES "ProcessDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessReview" ADD CONSTRAINT "ProcessReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_processId_fkey" FOREIGN KEY ("processId") REFERENCES "ProcessDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

