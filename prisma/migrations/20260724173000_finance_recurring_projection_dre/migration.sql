-- CreateEnum
CREATE TYPE "RecurringSeriesStatus" AS ENUM ('ATIVA', 'PAUSADA', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ProjectionScenarioType" AS ENUM ('CONSERVADOR', 'BASE', 'OTIMISTA', 'PERSONALIZADO');

-- CreateEnum
CREATE TYPE "ProjectionStatus" AS ENUM ('RASCUNHO', 'PUBLICADA', 'ARQUIVADA');

-- CreateEnum
CREATE TYPE "ProjectionLineType" AS ENUM ('FATURAMENTO', 'RECEBIMENTOS', 'RECEITA_RECORRENTE', 'RECEITA_PONTUAL', 'CUSTO_DIRETO', 'DESPESA', 'IMPOSTO', 'INVESTIMENTO', 'INADIMPLENCIA', 'SALDO_INICIAL', 'SALDO_FINAL', 'RESULTADO', 'PERSONALIZADA');

-- CreateEnum
CREATE TYPE "ProjectionValueSource" AS ENUM ('AUTOMATICO', 'MANUAL', 'SOBRESCRITO', 'REALIZADO');

-- CreateEnum
CREATE TYPE "DreModelStatus" AS ENUM ('RASCUNHO', 'PUBLICADO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "DreRowKind" AS ENUM ('GRUPO', 'CONTA', 'SUBTOTAL', 'FORMULA');

-- CreateEnum
CREATE TYPE "FinancialProductType" AS ENUM ('PRODUTO', 'SERVICO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RecurringFrequency" ADD VALUE 'SEMANAL';
ALTER TYPE "RecurringFrequency" ADD VALUE 'QUINZENAL';

-- AlterTable
ALTER TABLE "FinancialEntry" ADD COLUMN     "originalDueDate" TIMESTAMP(3),
ADD COLUMN     "paymentMethodConfigId" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "recurrenceException" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurrenceKey" TEXT,
ADD COLUMN     "recurrenceSequence" INTEGER;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "bankDetailsMasked" TEXT,
ADD COLUMN     "bankDetailsRestricted" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "defaultCategoryId" TEXT,
ADD COLUMN     "defaultCostCenterId" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "responsibleId" TEXT,
ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "initialBalanceDate" TIMESTAMP(3),
ADD COLUMN     "responsibleId" TEXT,
ADD COLUMN     "sensitiveDataRestricted" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT 'default';

-- AlterTable
ALTER TABLE "RecurringEntry" ADD COLUMN     "bankAccountId" TEXT,
ADD COLUMN     "durationMonths" INTEGER,
ADD COLUMN     "generatedOccurrences" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "primaryEntryId" TEXT,
ADD COLUMN     "nextGenerationDate" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "paymentMethodConfigId" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "responsibleId" TEXT,
ADD COLUMN     "startCompetenceMonth" INTEGER,
ADD COLUMN     "startCompetenceYear" INTEGER,
ADD COLUMN     "status" "RecurringSeriesStatus" NOT NULL DEFAULT 'ATIVA',
ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN     "totalOccurrences" INTEGER,
ADD COLUMN     "updatedById" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "recurringEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurringFrequency" "RecurringFrequency",
ADD COLUMN     "firstDueDate" TIMESTAMP(3),
ADD COLUMN     "installmentCount" INTEGER,
ADD COLUMN     "recurringDurationMonths" INTEGER,
ADD COLUMN     "adjustmentRate" DOUBLE PRECISION,
ADD COLUMN     "renewalDate" TIMESTAMP(3),
ADD COLUMN     "financialProductId" TEXT,
ADD COLUMN     "paymentMethodConfigId" TEXT,
ADD COLUMN     "financialResponsibleId" TEXT;

-- CreateTable
CREATE TABLE "RecurringEntryHistory" (
    "id" TEXT NOT NULL,
    "recurringEntryId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "occurrenceNumber" INTEGER,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringEntryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethodConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settlementDays" INTEGER NOT NULL DEFAULT 0,
    "feeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankAccountId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentMethodConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialProduct" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialProductType" NOT NULL DEFAULT 'SERVICO',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FinancialProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialProjection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "year" INTEGER NOT NULL,
    "periodStartMonth" INTEGER NOT NULL DEFAULT 1,
    "periodEndMonth" INTEGER NOT NULL DEFAULT 12,
    "scenarioType" "ProjectionScenarioType" NOT NULL DEFAULT 'PERSONALIZADO',
    "status" "ProjectionStatus" NOT NULL DEFAULT 'RASCUNHO',
    "version" INTEGER NOT NULL DEFAULT 1,
    "responsibleId" TEXT,
    "createdById" TEXT,
    "sourceProjectionId" TEXT,
    "sourceKind" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "FinancialProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialProjectionLine" (
    "id" TEXT NOT NULL,
    "projectionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "ProjectionLineType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT,
    "costCenterId" TEXT,
    "projectId" TEXT,
    "productId" TEXT,
    "clientId" TEXT,
    "supplierId" TEXT,
    "contractId" TEXT,
    "automaticSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialProjectionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialProjectionValue" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "automaticValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "manualValue" DOUBLE PRECISION,
    "realizedValue" DOUBLE PRECISION,
    "source" "ProjectionValueSource" NOT NULL DEFAULT 'AUTOMATICO',
    "notes" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialProjectionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectionValueHistory" (
    "id" TEXT NOT NULL,
    "projectionValueId" TEXT NOT NULL,
    "userId" TEXT,
    "previousValue" DOUBLE PRECISION,
    "newValue" DOUBLE PRECISION,
    "previousSource" "ProjectionValueSource",
    "newSource" "ProjectionValueSource" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectionValueHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DreModel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "DreModelStatus" NOT NULL DEFAULT 'RASCUNHO',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "DreModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DreModelVersion" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "DreModelStatus" NOT NULL DEFAULT 'RASCUNHO',
    "effectiveFrom" TIMESTAMP(3),
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DreModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DreRow" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DreRowKind" NOT NULL DEFAULT 'CONTA',
    "order" INTEGER NOT NULL DEFAULT 0,
    "sign" INTEGER NOT NULL DEFAULT 1,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "formula" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DreRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DreRowMapping" (
    "id" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "categoryId" TEXT,
    "costCenterId" TEXT,
    "includeDescendants" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DreRowMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringEntryHistory_recurringEntryId_createdAt_idx" ON "RecurringEntryHistory"("recurringEntryId", "createdAt");

-- CreateIndex
CREATE INDEX "RecurringEntryHistory_userId_createdAt_idx" ON "RecurringEntryHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentMethodConfig_tenantId_active_idx" ON "PaymentMethodConfig"("tenantId", "active");

-- CreateIndex
CREATE INDEX "PaymentMethodConfig_bankAccountId_idx" ON "PaymentMethodConfig"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodConfig_tenantId_code_key" ON "PaymentMethodConfig"("tenantId", "code");

-- CreateIndex
CREATE INDEX "FinancialProduct_tenantId_active_idx" ON "FinancialProduct"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialProduct_tenantId_code_key" ON "FinancialProduct"("tenantId", "code");

-- CreateIndex
CREATE INDEX "FinancialProjection_tenantId_year_status_idx" ON "FinancialProjection"("tenantId", "year", "status");

-- CreateIndex
CREATE INDEX "FinancialProjection_responsibleId_idx" ON "FinancialProjection"("responsibleId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialProjection_tenantId_name_year_version_key" ON "FinancialProjection"("tenantId", "name", "year", "version");

-- CreateIndex
CREATE INDEX "FinancialProjectionLine_projectionId_order_idx" ON "FinancialProjectionLine"("projectionId", "order");

-- CreateIndex
CREATE INDEX "FinancialProjectionLine_categoryId_idx" ON "FinancialProjectionLine"("categoryId");

-- CreateIndex
CREATE INDEX "FinancialProjectionLine_costCenterId_idx" ON "FinancialProjectionLine"("costCenterId");

-- CreateIndex
CREATE INDEX "FinancialProjectionValue_updatedById_idx" ON "FinancialProjectionValue"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialProjectionValue_lineId_month_key" ON "FinancialProjectionValue"("lineId", "month");

-- CreateIndex
CREATE INDEX "ProjectionValueHistory_projectionValueId_createdAt_idx" ON "ProjectionValueHistory"("projectionValueId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectionValueHistory_userId_createdAt_idx" ON "ProjectionValueHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DreModel_tenantId_status_idx" ON "DreModel"("tenantId", "status");

-- CreateIndex
CREATE INDEX "DreModel_tenantId_isDefault_idx" ON "DreModel"("tenantId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "DreModel_tenantId_name_key" ON "DreModel"("tenantId", "name");

-- CreateIndex
CREATE INDEX "DreModelVersion_status_effectiveFrom_idx" ON "DreModelVersion"("status", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "DreModelVersion_modelId_version_key" ON "DreModelVersion"("modelId", "version");

-- CreateIndex
CREATE INDEX "DreRow_versionId_order_idx" ON "DreRow"("versionId", "order");

-- CreateIndex
CREATE INDEX "DreRow_parentId_idx" ON "DreRow"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "DreRow_versionId_code_key" ON "DreRow"("versionId", "code");

-- CreateIndex
CREATE INDEX "DreRowMapping_rowId_idx" ON "DreRowMapping"("rowId");

-- CreateIndex
CREATE INDEX "DreRowMapping_categoryId_idx" ON "DreRowMapping"("categoryId");

-- CreateIndex
CREATE INDEX "DreRowMapping_costCenterId_idx" ON "DreRowMapping"("costCenterId");

-- CreateIndex
CREATE INDEX "FinancialEntry_paymentMethodConfigId_idx" ON "FinancialEntry"("paymentMethodConfigId");

-- CreateIndex
CREATE INDEX "FinancialEntry_productId_idx" ON "FinancialEntry"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEntry_recurringEntryId_recurrenceSequence_key" ON "FinancialEntry"("recurringEntryId", "recurrenceSequence");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEntry_recurrenceKey_key" ON "FinancialEntry"("recurrenceKey");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_active_idx" ON "Supplier"("tenantId", "active");

-- CreateIndex
CREATE INDEX "Supplier_defaultCategoryId_idx" ON "Supplier"("defaultCategoryId");

-- CreateIndex
CREATE INDEX "Supplier_defaultCostCenterId_idx" ON "Supplier"("defaultCostCenterId");

-- CreateIndex
CREATE INDEX "Supplier_responsibleId_idx" ON "Supplier"("responsibleId");

-- CreateIndex
CREATE INDEX "BankAccount_tenantId_active_idx" ON "BankAccount"("tenantId", "active");

-- CreateIndex
CREATE INDEX "BankAccount_responsibleId_idx" ON "BankAccount"("responsibleId");

-- CreateIndex
CREATE INDEX "RecurringEntry_tenantId_status_idx" ON "RecurringEntry"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringEntry_idempotencyKey_key" ON "RecurringEntry"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringEntry_primaryEntryId_key" ON "RecurringEntry"("primaryEntryId");

-- CreateIndex
CREATE INDEX "Contract_financialProductId_idx" ON "Contract"("financialProductId");

-- CreateIndex
CREATE INDEX "Contract_paymentMethodConfigId_idx" ON "Contract"("paymentMethodConfigId");

-- CreateIndex
CREATE INDEX "Contract_financialResponsibleId_idx" ON "Contract"("financialResponsibleId");

-- CreateIndex
CREATE INDEX "RecurringEntry_projectId_idx" ON "RecurringEntry"("projectId");

-- CreateIndex
CREATE INDEX "RecurringEntry_productId_idx" ON "RecurringEntry"("productId");

-- CreateIndex
CREATE INDEX "RecurringEntry_responsibleId_idx" ON "RecurringEntry"("responsibleId");

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_paymentMethodConfigId_fkey" FOREIGN KEY ("paymentMethodConfigId") REFERENCES "PaymentMethodConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FinancialProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_defaultCostCenterId_fkey" FOREIGN KEY ("defaultCostCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringEntry" ADD CONSTRAINT "RecurringEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringEntry" ADD CONSTRAINT "RecurringEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FinancialProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringEntry" ADD CONSTRAINT "RecurringEntry_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringEntry" ADD CONSTRAINT "RecurringEntry_paymentMethodConfigId_fkey" FOREIGN KEY ("paymentMethodConfigId") REFERENCES "PaymentMethodConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringEntry" ADD CONSTRAINT "RecurringEntry_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringEntry" ADD CONSTRAINT "RecurringEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringEntry" ADD CONSTRAINT "RecurringEntry_primaryEntryId_fkey" FOREIGN KEY ("primaryEntryId") REFERENCES "FinancialEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_financialProductId_fkey" FOREIGN KEY ("financialProductId") REFERENCES "FinancialProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_paymentMethodConfigId_fkey" FOREIGN KEY ("paymentMethodConfigId") REFERENCES "PaymentMethodConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_financialResponsibleId_fkey" FOREIGN KEY ("financialResponsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringEntryHistory" ADD CONSTRAINT "RecurringEntryHistory_recurringEntryId_fkey" FOREIGN KEY ("recurringEntryId") REFERENCES "RecurringEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringEntryHistory" ADD CONSTRAINT "RecurringEntryHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethodConfig" ADD CONSTRAINT "PaymentMethodConfig_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethodConfig" ADD CONSTRAINT "PaymentMethodConfig_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProduct" ADD CONSTRAINT "FinancialProduct_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProjection" ADD CONSTRAINT "FinancialProjection_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProjection" ADD CONSTRAINT "FinancialProjection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProjection" ADD CONSTRAINT "FinancialProjection_sourceProjectionId_fkey" FOREIGN KEY ("sourceProjectionId") REFERENCES "FinancialProjection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProjectionLine" ADD CONSTRAINT "FinancialProjectionLine_projectionId_fkey" FOREIGN KEY ("projectionId") REFERENCES "FinancialProjection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProjectionLine" ADD CONSTRAINT "FinancialProjectionLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProjectionLine" ADD CONSTRAINT "FinancialProjectionLine_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProjectionLine" ADD CONSTRAINT "FinancialProjectionLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProjectionLine" ADD CONSTRAINT "FinancialProjectionLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FinancialProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProjectionLine" ADD CONSTRAINT "FinancialProjectionLine_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProjectionLine" ADD CONSTRAINT "FinancialProjectionLine_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProjectionLine" ADD CONSTRAINT "FinancialProjectionLine_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProjectionValue" ADD CONSTRAINT "FinancialProjectionValue_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "FinancialProjectionLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialProjectionValue" ADD CONSTRAINT "FinancialProjectionValue_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectionValueHistory" ADD CONSTRAINT "ProjectionValueHistory_projectionValueId_fkey" FOREIGN KEY ("projectionValueId") REFERENCES "FinancialProjectionValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectionValueHistory" ADD CONSTRAINT "ProjectionValueHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreModel" ADD CONSTRAINT "DreModel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreModelVersion" ADD CONSTRAINT "DreModelVersion_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "DreModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreModelVersion" ADD CONSTRAINT "DreModelVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreRow" ADD CONSTRAINT "DreRow_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "DreModelVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreRow" ADD CONSTRAINT "DreRow_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DreRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreRowMapping" ADD CONSTRAINT "DreRowMapping_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "DreRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreRowMapping" ADD CONSTRAINT "DreRowMapping_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DreRowMapping" ADD CONSTRAINT "DreRowMapping_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain integrity checks that Prisma cannot currently express in the schema.
ALTER TABLE "RecurringEntry"
  ADD CONSTRAINT "RecurringEntry_dayOfMonth_check" CHECK ("dayOfMonth" BETWEEN 1 AND 31),
  ADD CONSTRAINT "RecurringEntry_totalOccurrences_check" CHECK ("totalOccurrences" IS NULL OR "totalOccurrences" > 0),
  ADD CONSTRAINT "RecurringEntry_durationMonths_check" CHECK ("durationMonths" IS NULL OR "durationMonths" > 0),
  ADD CONSTRAINT "RecurringEntry_startCompetence_check" CHECK (
    ("startCompetenceMonth" IS NULL AND "startCompetenceYear" IS NULL)
    OR ("startCompetenceMonth" BETWEEN 1 AND 12 AND "startCompetenceYear" BETWEEN 2000 AND 2100)
  );

ALTER TABLE "Contract"
  ADD CONSTRAINT "Contract_installmentCount_check" CHECK ("installmentCount" IS NULL OR "installmentCount" > 0),
  ADD CONSTRAINT "Contract_recurringDurationMonths_check" CHECK ("recurringDurationMonths" IS NULL OR "recurringDurationMonths" > 0),
  ADD CONSTRAINT "Contract_adjustmentRate_check" CHECK ("adjustmentRate" IS NULL OR "adjustmentRate" >= 0);

ALTER TABLE "FinancialProjection"
  ADD CONSTRAINT "FinancialProjection_year_check" CHECK ("year" BETWEEN 2000 AND 2100),
  ADD CONSTRAINT "FinancialProjection_period_check" CHECK (
    "periodStartMonth" BETWEEN 1 AND 12
    AND "periodEndMonth" BETWEEN "periodStartMonth" AND 12
  );

ALTER TABLE "FinancialProjectionValue"
  ADD CONSTRAINT "FinancialProjectionValue_month_check" CHECK ("month" BETWEEN 1 AND 12);

ALTER TABLE "PaymentMethodConfig"
  ADD CONSTRAINT "PaymentMethodConfig_settlementDays_check" CHECK ("settlementDays" >= 0),
  ADD CONSTRAINT "PaymentMethodConfig_feeRate_check" CHECK ("feeRate" >= 0);

ALTER TABLE "DreRow"
  ADD CONSTRAINT "DreRow_sign_check" CHECK ("sign" IN (-1, 1));

ALTER TABLE "DreRowMapping"
  ADD CONSTRAINT "DreRowMapping_target_check" CHECK ("categoryId" IS NOT NULL OR "costCenterId" IS NOT NULL);
