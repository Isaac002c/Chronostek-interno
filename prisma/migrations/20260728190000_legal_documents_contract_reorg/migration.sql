-- Reorganização não destrutiva: Contract passa a ser o registro oficial no
-- Jurídico e Attachment é ampliada para o documento canônico/versionado.

-- O PostgreSQL não permite usar um valor acrescentado por ALTER TYPE antes
-- do commit da transação. Como os novos estados são usados mais abaixo na
-- migração de dados legados, os enums são substituídos atomicamente.
ALTER TYPE "ContractStatus" RENAME TO "ContractStatus_old";
CREATE TYPE "ContractStatus" AS ENUM (
  'RASCUNHO',
  'EM_REVISAO',
  'AGUARDANDO_ASSINATURA',
  'ATIVO',
  'INADIMPLENTE',
  'EM_RISCO',
  'PROXIMO_VENCIMENTO',
  'VENCIDO',
  'RENOVADO',
  'SUSPENSO',
  'RESCINDIDO',
  'CANCELADO',
  'RENOVACAO_PROXIMA',
  'ENCERRADO',
  'ARQUIVADO'
);
ALTER TABLE "Contract" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Contract"
  ALTER COLUMN "status" TYPE "ContractStatus"
  USING ("status"::text::"ContractStatus");
ALTER TABLE "Contract" ALTER COLUMN "status" SET DEFAULT 'ATIVO';
DROP TYPE "ContractStatus_old";

ALTER TYPE "CalendarOrigin" RENAME TO "CalendarOrigin_old";
CREATE TYPE "CalendarOrigin" AS ENUM ('TELUN', 'GOOGLE', 'AUTOMACAO');
ALTER TABLE "CalendarEvent" ALTER COLUMN "origin" DROP DEFAULT;
ALTER TABLE "CalendarEvent"
  ALTER COLUMN "origin" TYPE "CalendarOrigin"
  USING ("origin"::text::"CalendarOrigin");
ALTER TABLE "CalendarEvent" ALTER COLUMN "origin" SET DEFAULT 'TELUN';
ALTER TABLE "CalendarEventHistory" ALTER COLUMN "origin" DROP DEFAULT;
ALTER TABLE "CalendarEventHistory"
  ALTER COLUMN "origin" TYPE "CalendarOrigin"
  USING ("origin"::text::"CalendarOrigin");
ALTER TABLE "CalendarEventHistory" ALTER COLUMN "origin" SET DEFAULT 'TELUN';
DROP TYPE "CalendarOrigin_old";

CREATE TYPE "DocumentStatus" AS ENUM (
  'ATIVO',
  'AGUARDANDO_ASSINATURA',
  'ASSINADO',
  'VENCIDO',
  'ARQUIVADO'
);

CREATE TYPE "DocumentPrivacy" AS ENUM (
  'INTERNO',
  'PRIVADO',
  'CONFIDENCIAL'
);

CREATE TYPE "DocumentVersionStatus" AS ENUM ('ATUAL', 'ARQUIVADA');
CREATE TYPE "DocumentAlertStatus" AS ENUM ('PENDENTE', 'CONCLUIDO', 'IGNORADO');

ALTER TABLE "Contract"
  ADD COLUMN "contractNumber" TEXT,
  ADD COLUMN "proposalId" TEXT,
  ADD COLUMN "legacyLegalContractId" TEXT,
  ADD COLUMN "legalResponsibleId" TEXT,
  ADD COLUMN "commercialResponsibleId" TEXT,
  ADD COLUMN "signedAt" TIMESTAMP(3),
  ADD COLUMN "autoRenewal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "renewalNoticeDays" INTEGER,
  ADD COLUMN "billingMethod" TEXT,
  ADD COLUMN "relevantClauses" TEXT,
  ADD COLUMN "signatories" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "previousContractId" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "updatedById" TEXT;

ALTER TABLE "LegalDeadline" ADD COLUMN "contractId" TEXT;
ALTER TABLE "LegalDemand" ADD COLUMN "contractId" TEXT;

ALTER TABLE "CalendarEvent"
  ADD COLUMN "sourceEntityType" TEXT,
  ADD COLUMN "sourceEntityId" TEXT,
  ADD COLUMN "sourceKey" TEXT;

CREATE TABLE "DocumentType" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'default',
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT,
  "icon" TEXT,
  "requiresExpiration" BOOLEAN NOT NULL DEFAULT false,
  "requiresContract" BOOLEAN NOT NULL DEFAULT false,
  "requiresSignature" BOOLEAN NOT NULL DEFAULT false,
  "requiredFields" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentCategory" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'default',
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentTag" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'default',
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "color" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentTag_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Attachment"
  ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN "originalName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "extension" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "sha256" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "externalUrl" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "documentTypeId" TEXT,
  ADD COLUMN "categoryId" TEXT,
  ADD COLUMN "status" "DocumentStatus" NOT NULL DEFAULT 'ATIVO',
  ADD COLUMN "privacy" "DocumentPrivacy" NOT NULL DEFAULT 'INTERNO',
  ADD COLUMN "documentDate" TIMESTAMP(3),
  ADD COLUMN "validFrom" TIMESTAMP(3),
  ADD COLUMN "expirationDate" TIMESTAMP(3),
  ADD COLUMN "responsibleId" TEXT,
  ADD COLUMN "updatedById" TEXT,
  ADD COLUMN "currentVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "DocumentVersion" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "extension" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "uploadedById" TEXT,
  "note" TEXT,
  "reason" TEXT,
  "status" "DocumentVersionStatus" NOT NULL DEFAULT 'ATUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentTagLink" (
  "documentId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentTagLink_pkey" PRIMARY KEY ("documentId", "tagId")
);

CREATE TABLE "DocumentLink" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentExpirationAlert" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "daysBefore" INTEGER NOT NULL,
  "alertDate" TIMESTAMP(3) NOT NULL,
  "status" "DocumentAlertStatus" NOT NULL DEFAULT 'PENDENTE',
  "sourceKey" TEXT NOT NULL,
  "calendarEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentExpirationAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Contract_proposalId_key" ON "Contract"("proposalId");
CREATE UNIQUE INDEX "Contract_legacyLegalContractId_key" ON "Contract"("legacyLegalContractId");
CREATE INDEX "Contract_contractNumber_idx" ON "Contract"("contractNumber");
CREATE INDEX "Contract_legalResponsibleId_idx" ON "Contract"("legalResponsibleId");
CREATE INDEX "Contract_commercialResponsibleId_idx" ON "Contract"("commercialResponsibleId");
CREATE INDEX "Contract_previousContractId_idx" ON "Contract"("previousContractId");
CREATE INDEX "Contract_endDate_idx" ON "Contract"("endDate");
CREATE INDEX "LegalDeadline_contractId_idx" ON "LegalDeadline"("contractId");
CREATE INDEX "LegalDemand_contractId_idx" ON "LegalDemand"("contractId");
CREATE UNIQUE INDEX "CalendarEvent_tenantId_sourceKey_key" ON "CalendarEvent"("tenantId", "sourceKey");
CREATE INDEX "CalendarEvent_sourceEntityType_sourceEntityId_idx" ON "CalendarEvent"("sourceEntityType", "sourceEntityId");
CREATE UNIQUE INDEX "DocumentType_tenantId_slug_key" ON "DocumentType"("tenantId", "slug");
CREATE INDEX "DocumentType_tenantId_active_idx" ON "DocumentType"("tenantId", "active");
CREATE UNIQUE INDEX "DocumentCategory_tenantId_slug_key" ON "DocumentCategory"("tenantId", "slug");
CREATE INDEX "DocumentCategory_tenantId_active_idx" ON "DocumentCategory"("tenantId", "active");
CREATE UNIQUE INDEX "DocumentTag_tenantId_normalizedName_key" ON "DocumentTag"("tenantId", "normalizedName");
CREATE INDEX "DocumentTag_tenantId_name_idx" ON "DocumentTag"("tenantId", "name");
CREATE INDEX "Attachment_tenantId_deletedAt_createdAt_idx" ON "Attachment"("tenantId", "deletedAt", "createdAt");
CREATE INDEX "Attachment_documentTypeId_idx" ON "Attachment"("documentTypeId");
CREATE INDEX "Attachment_categoryId_idx" ON "Attachment"("categoryId");
CREATE INDEX "Attachment_responsibleId_idx" ON "Attachment"("responsibleId");
CREATE INDEX "Attachment_status_idx" ON "Attachment"("status");
CREATE INDEX "Attachment_privacy_idx" ON "Attachment"("privacy");
CREATE INDEX "Attachment_expirationDate_idx" ON "Attachment"("expirationDate");
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");
CREATE INDEX "DocumentVersion_sha256_idx" ON "DocumentVersion"("sha256");
CREATE INDEX "DocumentVersion_uploadedById_idx" ON "DocumentVersion"("uploadedById");
CREATE INDEX "DocumentTagLink_tagId_idx" ON "DocumentTagLink"("tagId");
CREATE UNIQUE INDEX "DocumentLink_documentId_entityType_entityId_key" ON "DocumentLink"("documentId", "entityType", "entityId");
CREATE INDEX "DocumentLink_entityType_entityId_idx" ON "DocumentLink"("entityType", "entityId");
CREATE UNIQUE INDEX "DocumentExpirationAlert_sourceKey_key" ON "DocumentExpirationAlert"("sourceKey");
CREATE UNIQUE INDEX "DocumentExpirationAlert_documentId_daysBefore_key" ON "DocumentExpirationAlert"("documentId", "daysBefore");
CREATE INDEX "DocumentExpirationAlert_alertDate_status_idx" ON "DocumentExpirationAlert"("alertDate", "status");

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_proposalId_fkey"
  FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_legalResponsibleId_fkey"
  FOREIGN KEY ("legalResponsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_commercialResponsibleId_fkey"
  FOREIGN KEY ("commercialResponsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_previousContractId_fkey"
  FOREIGN KEY ("previousContractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalDeadline" ADD CONSTRAINT "LegalDeadline_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalDemand" ADD CONSTRAINT "LegalDemand_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentType" ADD CONSTRAINT "DocumentType_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentCategory" ADD CONSTRAINT "DocumentCategory_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentTag" ADD CONSTRAINT "DocumentTag_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_documentTypeId_fkey"
  FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "DocumentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_responsibleId_fkey"
  FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentTagLink" ADD CONSTRAINT "DocumentTagLink_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentTagLink" ADD CONSTRAINT "DocumentTagLink_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "DocumentTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentExpirationAlert" ADD CONSTRAINT "DocumentExpirationAlert_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "DocumentType" (
  "id", "name", "slug", "description", "color", "requiresExpiration",
  "requiresContract", "requiresSignature"
) VALUES
  ('doctype-contrato', 'Contrato', 'contrato', 'Contrato principal firmado com cliente ou fornecedor.', '#2563eb', true, false, true),
  ('doctype-renovacao', 'Renovação', 'renovacao', 'Documento de renovação contratual.', '#0d9488', true, true, true),
  ('doctype-tap', 'TAP', 'tap', 'Termo de Abertura de Projeto.', '#7c3aed', false, false, false),
  ('doctype-proposta', 'Proposta', 'proposta', 'Registro documental de proposta comercial.', '#0891b2', true, false, false),
  ('doctype-aditivo', 'Aditivo', 'aditivo', 'Aditivo contratual.', '#d97706', false, true, true),
  ('doctype-distrato', 'Distrato', 'distrato', 'Distrato ou encerramento formal.', '#dc2626', false, true, true),
  ('doctype-termo', 'Termo', 'termo', 'Termo jurídico ou operacional.', '#4f46e5', false, false, true),
  ('doctype-procuracao', 'Procuração', 'procuracao', 'Instrumento de procuração.', '#9333ea', true, false, true),
  ('doctype-documento-cliente', 'Documento do cliente', 'documento-do-cliente', 'Documento cadastral do cliente.', '#475569', false, false, false),
  ('doctype-documento-societario', 'Documento societário', 'documento-societario', 'Documento societário.', '#334155', true, false, false),
  ('doctype-comprovante', 'Comprovante', 'comprovante', 'Comprovante ou evidência.', '#16a34a', false, false, false),
  ('doctype-documento-assinado', 'Documento assinado', 'documento-assinado', 'Versão assinada de documento.', '#15803d', false, false, true),
  ('doctype-minuta', 'Minuta', 'minuta', 'Minuta em elaboração ou revisão.', '#ca8a04', false, false, false),
  ('doctype-anexo-contratual', 'Anexo contratual', 'anexo-contratual', 'Anexo integrante do contrato.', '#0369a1', false, true, false),
  ('doctype-outro', 'Outro', 'outro', 'Tipo documental não classificado.', '#64748b', false, false, false)
ON CONFLICT ("tenantId", "slug") DO NOTHING;

INSERT INTO "DocumentCategory" ("id", "name", "slug", "color") VALUES
  ('doccategory-comercial', 'Comercial', 'comercial', '#0891b2'),
  ('doccategory-juridico', 'Jurídico', 'juridico', '#7c3aed'),
  ('doccategory-financeiro', 'Financeiro', 'financeiro', '#16a34a'),
  ('doccategory-operacional', 'Operacional', 'operacional', '#2563eb'),
  ('doccategory-administrativo', 'Administrativo', 'administrativo', '#475569'),
  ('doccategory-cliente', 'Cliente', 'cliente', '#0d9488'),
  ('doccategory-projeto', 'Projeto', 'projeto', '#d97706'),
  ('doccategory-interno', 'Interno', 'interno', '#64748b')
ON CONFLICT ("tenantId", "slug") DO NOTHING;

UPDATE "Attachment"
SET
  "originalName" = CASE WHEN "originalName" = '' THEN "fileName" ELSE "originalName" END,
  "extension" = CASE
    WHEN "extension" = '' AND position('.' in "fileName") > 0
      THEN lower(regexp_replace("fileName", '^.*\.', ''))
    ELSE "extension"
  END,
  "sha256" = CASE WHEN "sha256" = '' THEN 'legacy:' || "id" ELSE "sha256" END,
  "externalUrl" = CASE
    WHEN "fileUrl" ~* '^https?://' THEN "fileUrl"
    ELSE "externalUrl"
  END,
  "fileUrl" = CASE
    WHEN "fileUrl" ~* '^https?://' THEN 'legacy/' || "id"
    ELSE "fileUrl"
  END,
  "updatedAt" = "createdAt";

INSERT INTO "DocumentLink" ("id", "documentId", "entityType", "entityId", "createdAt")
SELECT 'legacy-link-' || "id", "id", "entityType", "entityId", "createdAt"
FROM "Attachment"
ON CONFLICT ("documentId", "entityType", "entityId") DO NOTHING;

INSERT INTO "DocumentVersion" (
  "id", "documentId", "version", "fileUrl", "originalName", "extension",
  "mimeType", "size", "sha256", "uploadedById", "status", "createdAt"
)
SELECT
  'legacy-version-' || "id",
  "id",
  1,
  "fileUrl",
  "originalName",
  "extension",
  COALESCE("mimeType", 'application/octet-stream'),
  COALESCE("size", 0),
  "sha256",
  "uploadedById",
  'ATUAL'::"DocumentVersionStatus",
  "createdAt"
FROM "Attachment"
WHERE "externalUrl" IS NULL
ON CONFLICT ("documentId", "version") DO NOTHING;

-- Converte contratos jurídicos legados vinculados a clientes para o contrato
-- oficial, mantendo o id legado como chave de rastreabilidade.
INSERT INTO "Contract" (
  "id", "clientId", "title", "type", "totalValue", "monthlyValue",
  "startDate", "endDate", "status", "renewalDate", "legalResponsibleId",
  "signedAt", "notes", "legacyLegalContractId", "createdAt", "updatedAt"
)
SELECT
  'legal-contract-' || lc."id",
  lc."clientId",
  lc."title",
  CASE
    WHEN lc."type" IN ('PRESTACAO_SERVICO', 'FREELANCER') THEN 'CONSULTORIA'::"ContractType"
    WHEN lc."type" = 'CLIENTE' THEN 'RECORRENTE'::"ContractType"
    ELSE 'PROJETO_FECHADO'::"ContractType"
  END,
  lc."contractValue",
  lc."monthlyValue",
  lc."startDate",
  COALESCE(lc."endDate", lc."expirationDate"),
  CASE
    WHEN lc."status" = 'RASCUNHO' THEN 'RASCUNHO'::"ContractStatus"
    WHEN lc."status" = 'EM_REVISAO' THEN 'EM_REVISAO'::"ContractStatus"
    WHEN lc."status" = 'ENVIADO' THEN 'AGUARDANDO_ASSINATURA'::"ContractStatus"
    WHEN lc."status" = 'VENCIDO' THEN 'VENCIDO'::"ContractStatus"
    WHEN lc."status" = 'CANCELADO' THEN 'CANCELADO'::"ContractStatus"
    WHEN lc."status" = 'RESCINDIDO' THEN 'RESCINDIDO'::"ContractStatus"
    ELSE 'ATIVO'::"ContractStatus"
  END,
  lc."renewalDate",
  lc."responsibleId",
  COALESCE(lc."signedAt", lc."signatureDate"),
  concat_ws(E'\n', lc."notes", CASE WHEN lc."counterpartyName" IS NOT NULL THEN 'Contraparte legada: ' || lc."counterpartyName" END),
  lc."id",
  lc."createdAt",
  lc."updatedAt"
FROM "LegalContract" lc
WHERE lc."clientId" IS NOT NULL
  AND lc."deletedAt" IS NULL
ON CONFLICT ("legacyLegalContractId") DO NOTHING;

UPDATE "LegalDeadline" ld
SET "contractId" = c."id"
FROM "Contract" c
WHERE c."legacyLegalContractId" = ld."legalContractId"
  AND ld."contractId" IS NULL;

UPDATE "LegalDemand" d
SET "contractId" = c."id"
FROM "Contract" c
WHERE c."legacyLegalContractId" = d."legalContractId"
  AND d."contractId" IS NULL;

INSERT INTO "Attachment" (
  "id", "tenantId", "entityType", "entityId", "fileName", "fileUrl",
  "originalName", "extension", "sha256", "externalUrl", "description",
  "documentTypeId", "categoryId", "status", "privacy", "expirationDate",
  "responsibleId", "uploadedById", "updatedById", "currentVersion",
  "createdAt", "updatedAt"
)
SELECT
  'legal-document-' || ld."id",
  'default',
  CASE
    WHEN ld."clientId" IS NOT NULL THEN 'CLIENT'
    WHEN c."id" IS NOT NULL THEN 'CONTRACT'
    ELSE 'LEGAL'
  END,
  COALESCE(ld."clientId", c."id", ld."id"),
  ld."title",
  'legacy/' || ld."id",
  ld."title",
  '',
  'legacy-legal-document:' || ld."id",
  COALESCE(ld."fileUrl", ld."externalLink"),
  ld."notes",
  CASE ld."type"
    WHEN 'CONTRATO' THEN 'doctype-contrato'
    WHEN 'PROPOSTA' THEN 'doctype-proposta'
    WHEN 'TERMO_RESCISAO' THEN 'doctype-distrato'
    WHEN 'PROCURACAO' THEN 'doctype-procuracao'
    WHEN 'DOC_CLIENTE' THEN 'doctype-documento-cliente'
    ELSE 'doctype-outro'
  END,
  'doccategory-juridico',
  CASE ld."status"
    WHEN 'ARQUIVADO' THEN 'ARQUIVADO'::"DocumentStatus"
    WHEN 'VENCIDO' THEN 'VENCIDO'::"DocumentStatus"
    ELSE 'ATIVO'::"DocumentStatus"
  END,
  'INTERNO'::"DocumentPrivacy",
  ld."expirationDate",
  ld."responsibleId",
  NULL,
  NULL,
  1,
  ld."createdAt",
  ld."updatedAt"
FROM "LegalDocument" ld
LEFT JOIN "Contract" c ON c."legacyLegalContractId" = ld."legalContractId"
WHERE ld."deletedAt" IS NULL
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "DocumentLink" ("id", "documentId", "entityType", "entityId", "createdAt")
SELECT
  'legal-document-primary-link-' || ld."id",
  'legal-document-' || ld."id",
  CASE
    WHEN ld."clientId" IS NOT NULL THEN 'CLIENT'
    WHEN c."id" IS NOT NULL THEN 'CONTRACT'
    ELSE 'LEGAL'
  END,
  COALESCE(ld."clientId", c."id", ld."id"),
  ld."createdAt"
FROM "LegalDocument" ld
LEFT JOIN "Contract" c ON c."legacyLegalContractId" = ld."legalContractId"
WHERE ld."deletedAt" IS NULL
ON CONFLICT ("documentId", "entityType", "entityId") DO NOTHING;

INSERT INTO "DocumentLink" ("id", "documentId", "entityType", "entityId", "createdAt")
SELECT
  'legal-document-contract-link-' || ld."id",
  'legal-document-' || ld."id",
  'CONTRACT',
  c."id",
  ld."createdAt"
FROM "LegalDocument" ld
JOIN "Contract" c ON c."legacyLegalContractId" = ld."legalContractId"
WHERE ld."deletedAt" IS NULL
ON CONFLICT ("documentId", "entityType", "entityId") DO NOTHING;

UPDATE "LegalDocument"
SET "deletedAt" = COALESCE("deletedAt", CURRENT_TIMESTAMP)
WHERE EXISTS (
  SELECT 1 FROM "Attachment" a
  WHERE a."id" = 'legal-document-' || "LegalDocument"."id"
);

UPDATE "LegalContract"
SET "deletedAt" = COALESCE("deletedAt", CURRENT_TIMESTAMP)
WHERE EXISTS (
  SELECT 1 FROM "Contract" c
  WHERE c."legacyLegalContractId" = "LegalContract"."id"
);

INSERT INTO "CalendarEvent" (
  "id", "tenantId", "title", "description", "type", "status", "priority",
  "privacy", "origin", "startAt", "endAt", "allDay", "timezone",
  "category", "color", "department", "clientId", "responsibleId",
  "sourceEntityType", "sourceEntityId", "sourceKey", "syncPending",
  "sourceVersion", "createdAt", "updatedAt"
)
SELECT
  'auto-contract-expiration-' || c."id",
  'default',
  'Vencimento de contrato: ' || c."title",
  'Prazo automático. Abra o contrato de origem no Jurídico para alterar.',
  'PRAZO'::"CalendarEventType",
  'AGENDADO'::"CalendarEventStatus",
  'ALTA'::"CalendarPriority",
  'INTERNO'::"CalendarPrivacy",
  'AUTOMACAO'::"CalendarOrigin",
  c."endDate",
  c."endDate" + INTERVAL '1 hour',
  true,
  'America/Sao_Paulo',
  'Jurídico · Contrato',
  '#7c3aed',
  'JURIDICO',
  c."clientId",
  c."legalResponsibleId",
  'CONTRACT',
  c."id",
  'contract:' || c."id" || ':expiration',
  true,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Contract" c
WHERE c."deletedAt" IS NULL
  AND c."endDate" IS NOT NULL
ON CONFLICT ("tenantId", "sourceKey") DO NOTHING;

INSERT INTO "CalendarEvent" (
  "id", "tenantId", "title", "description", "type", "status", "priority",
  "privacy", "origin", "startAt", "endAt", "allDay", "timezone",
  "category", "color", "department", "clientId", "responsibleId",
  "sourceEntityType", "sourceEntityId", "sourceKey", "syncPending",
  "sourceVersion", "createdAt", "updatedAt"
)
SELECT
  'auto-contract-renewal-' || c."id",
  'default',
  'Renovação de contrato: ' || c."title",
  'Prazo automático. Abra o contrato de origem no Jurídico para alterar.',
  'PRAZO'::"CalendarEventType",
  'AGENDADO'::"CalendarEventStatus",
  'ALTA'::"CalendarPriority",
  'INTERNO'::"CalendarPrivacy",
  'AUTOMACAO'::"CalendarOrigin",
  c."renewalDate",
  c."renewalDate" + INTERVAL '1 hour',
  true,
  'America/Sao_Paulo',
  'Jurídico · Renovação',
  '#7c3aed',
  'JURIDICO',
  c."clientId",
  c."legalResponsibleId",
  'CONTRACT',
  c."id",
  'contract:' || c."id" || ':renewal',
  true,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Contract" c
WHERE c."deletedAt" IS NULL
  AND c."renewalDate" IS NOT NULL
ON CONFLICT ("tenantId", "sourceKey") DO NOTHING;

INSERT INTO "CalendarEvent" (
  "id", "tenantId", "title", "description", "type", "status", "priority",
  "privacy", "origin", "startAt", "endAt", "allDay", "timezone",
  "category", "color", "department", "responsibleId",
  "sourceEntityType", "sourceEntityId", "sourceKey", "syncPending",
  "sourceVersion", "createdAt", "updatedAt"
)
SELECT
  'auto-legal-deadline-' || d."id",
  'default',
  d."title",
  'Prazo jurídico automático. Altere o registro de origem no Jurídico.',
  'PRAZO'::"CalendarEventType",
  CASE
    WHEN d."status" = 'CONCLUIDO' THEN 'CONCLUIDO'::"CalendarEventStatus"
    WHEN d."status" = 'CANCELADO' THEN 'CANCELADO'::"CalendarEventStatus"
    ELSE 'AGENDADO'::"CalendarEventStatus"
  END,
  CASE d."priority"
    WHEN 'CRITICA' THEN 'CRITICA'::"CalendarPriority"
    WHEN 'ALTA' THEN 'ALTA'::"CalendarPriority"
    WHEN 'BAIXA' THEN 'BAIXA'::"CalendarPriority"
    ELSE 'MEDIA'::"CalendarPriority"
  END,
  'INTERNO'::"CalendarPrivacy",
  'AUTOMACAO'::"CalendarOrigin",
  d."date",
  d."date" + INTERVAL '1 hour',
  true,
  'America/Sao_Paulo',
  'Jurídico · Prazo',
  '#7c3aed',
  'JURIDICO',
  d."responsibleId",
  'LEGAL_DEADLINE',
  d."id",
  'legal-deadline:' || d."id",
  true,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "LegalDeadline" d
ON CONFLICT ("tenantId", "sourceKey") DO NOTHING;

INSERT INTO "CalendarEvent" (
  "id", "tenantId", "title", "description", "type", "status", "priority",
  "privacy", "origin", "startAt", "endAt", "allDay", "timezone",
  "category", "color", "department", "responsibleId",
  "sourceEntityType", "sourceEntityId", "sourceKey", "syncPending",
  "sourceVersion", "createdAt", "updatedAt"
)
SELECT
  'auto-document-expiration-' || a."id",
  'default',
  CASE
    WHEN a."privacy" = 'CONFIDENCIAL' THEN 'Validade de documento confidencial'
    ELSE 'Validade: ' || a."fileName"
  END,
  'Prazo automático. Abra o documento de origem no Jurídico.',
  'PRAZO'::"CalendarEventType",
  'AGENDADO'::"CalendarEventStatus",
  'ALTA'::"CalendarPriority",
  CASE
    WHEN a."privacy" = 'CONFIDENCIAL' THEN 'CONFIDENCIAL'::"CalendarPrivacy"
    ELSE 'INTERNO'::"CalendarPrivacy"
  END,
  'AUTOMACAO'::"CalendarOrigin",
  a."expirationDate",
  a."expirationDate" + INTERVAL '1 hour',
  true,
  'America/Sao_Paulo',
  'Jurídico · Documento',
  '#7c3aed',
  'JURIDICO',
  a."responsibleId",
  'DOCUMENT',
  a."id",
  'document:' || a."id" || ':expiration',
  true,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Attachment" a
WHERE a."deletedAt" IS NULL
  AND a."expirationDate" IS NOT NULL
ON CONFLICT ("tenantId", "sourceKey") DO NOTHING;

INSERT INTO "DocumentExpirationAlert" (
  "id", "documentId", "daysBefore", "alertDate", "status", "sourceKey",
  "calendarEventId", "createdAt", "updatedAt"
)
SELECT
  'document-alert-' || a."id" || '-' || days."value",
  a."id",
  days."value",
  a."expirationDate" - make_interval(days => days."value"),
  'PENDENTE'::"DocumentAlertStatus",
  'document:' || a."id" || ':expiration:' || days."value",
  'auto-document-expiration-' || a."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Attachment" a
CROSS JOIN (VALUES (90), (60), (30), (15), (7), (5), (1)) AS days("value")
WHERE a."deletedAt" IS NULL
  AND a."expirationDate" IS NOT NULL
ON CONFLICT ("documentId", "daysBefore") DO NOTHING;
