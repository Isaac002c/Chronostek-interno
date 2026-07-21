-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'SOCIO_ADMIN', 'FINANCEIRO', 'COMERCIAL', 'MARKETING', 'TI', 'JURIDICO', 'BDR', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "ModuleKey" AS ENUM ('DASHBOARD', 'LEADS', 'COMERCIAL', 'FINANCEIRO', 'MARKETING', 'TI', 'JURIDICO', 'METAS', 'TAREFAS', 'GERAL');

-- CreateEnum
CREATE TYPE "CostCenterType" AS ENUM ('FINANCEIRO', 'COMERCIAL', 'MARKETING', 'TI', 'JURIDICO', 'ADMINISTRATIVO', 'OUTRO');

-- CreateEnum
CREATE TYPE "LeadOrigin" AS ENUM ('INSTAGRAM', 'GOOGLE', 'INDICACAO', 'COLD_CALL', 'WHATSAPP', 'EVENTO', 'SITE', 'OUTRO');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NOVO', 'CONTATADO', 'QUALIFICADO', 'REUNIAO_MARCADA', 'PROPOSTA_ENVIADA', 'NEGOCIACAO', 'GANHO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "LeadInteractionType" AS ENUM ('NOTA', 'LIGACAO', 'EMAIL', 'WHATSAPP', 'REUNIAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('PROSPECT', 'ATIVO', 'INATIVO', 'EM_RISCO', 'CHURN');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('RASCUNHO', 'ENVIADA', 'ACEITA', 'RECUSADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('RECORRENTE', 'PROJETO_FECHADO', 'CONSULTORIA', 'SUPORTE', 'MARKETING', 'HIBRIDO');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ATIVO', 'INADIMPLENTE', 'EM_RISCO', 'CANCELADO', 'RENOVACAO_PROXIMA', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "FinancialType" AS ENUM ('RECEITA', 'DESPESA');

-- CreateEnum
CREATE TYPE "FinancialStatus" AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'BOLETO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'TRANSFERENCIA', 'DINHEIRO', 'OUTRO');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('RECEITA', 'DESPESA');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('SISTEMA', 'SITE', 'LANDING_PAGE', 'AUTOMACAO', 'APP', 'SUPORTE', 'INFRAESTRUTURA', 'INTERNO');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANEJADO', 'EM_ANDAMENTO', 'PAUSADO', 'EM_REVISAO', 'ENTREGUE', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TimesheetType" AS ENUM ('DESENVOLVIMENTO', 'REUNIAO', 'SUPORTE', 'RETRABALHO', 'PLANEJAMENTO', 'CORRECAO', 'DEPLOY', 'OUTRO');

-- CreateEnum
CREATE TYPE "CampaignChannel" AS ENUM ('INSTAGRAM', 'GOOGLE_ADS', 'META_ADS', 'INDICACAO', 'ORGANICO', 'WHATSAPP', 'EVENTO', 'EMAIL', 'OUTRO');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('PLANEJADA', 'ATIVA', 'PAUSADA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "BudgetPeriodType" AS ENUM ('MENSAL', 'TRIMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('RASCUNHO', 'APROVADO', 'ATIVO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('ORCAMENTO', 'DESPESA', 'EDICAO_MES_FECHADO', 'CONTRATO', 'RISCO_JURIDICO');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "LegalContractType" AS ENUM ('CLIENTE', 'FORNECEDOR', 'PARCERIA', 'PRESTACAO_SERVICO', 'RESCISAO', 'NDA', 'FUNCIONARIO', 'FREELANCER', 'COMISSAO', 'POLITICA_PRIVACIDADE', 'TERMOS_USO', 'OUTRO');

-- CreateEnum
CREATE TYPE "LegalContractStatus" AS ENUM ('RASCUNHO', 'EM_REVISAO', 'ENVIADO', 'ASSINADO', 'ATIVO', 'VENCIDO', 'CANCELADO', 'RESCINDIDO');

-- CreateEnum
CREATE TYPE "LegalDeadlineStatus" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'ATRASADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM ('CONTRATO', 'NDA', 'PROPOSTA', 'TERMO_RESCISAO', 'NOTIFICACAO', 'PROCURACAO', 'DOC_EMPRESA', 'DOC_CLIENTE', 'OUTRO');

-- CreateEnum
CREATE TYPE "LegalDocumentStatus" AS ENUM ('RASCUNHO', 'VALIDO', 'VENCIDO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "LegalDemandType" AS ENUM ('REVISAO_CONTRATO', 'QUESTAO_CLIENTE', 'QUESTAO_FORNECEDOR', 'COBRANCA', 'POLITICA_INTERNA', 'PRIVACIDADE', 'SOCIETARIO', 'OUTRO');

-- CreateEnum
CREATE TYPE "LegalDemandStatus" AS ENUM ('ABERTA', 'EM_ANALISE', 'AGUARDANDO', 'RESOLVIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "LegalRiskType" AS ENUM ('CONTRATUAL', 'FINANCEIRO', 'COMPLIANCE', 'PRIVACIDADE', 'TRABALHISTA', 'TRIBUTARIO', 'CLIENTE', 'FORNECEDOR', 'OUTRO');

-- CreateEnum
CREATE TYPE "LegalRiskStatus" AS ENUM ('ABERTO', 'MITIGANDO', 'ACEITO', 'RESOLVIDO');

-- CreateEnum
CREATE TYPE "RiskScale" AS ENUM ('BAIXO', 'MEDIO', 'ALTO');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('BAIXO', 'MEDIO', 'ALTO', 'CRITICO');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('RECEITA', 'DESPESA', 'LUCRO', 'LEADS', 'VENDAS', 'PROJETOS', 'CONTRATOS', 'MRR', 'ARR', 'PROJETOS_ENTREGUES', 'TAREFAS_CONCLUIDAS', 'HORAS', 'ROI_CAMPANHA', 'PRAZOS_JURIDICOS', 'MARKETING', 'FINANCEIRO', 'OPERACIONAL', 'JURIDICO', 'MANUAL', 'OUTRO');

-- CreateEnum
CREATE TYPE "GoalPeriod" AS ENUM ('SEMANAL', 'MENSAL', 'TRIMESTRAL', 'ANUAL', 'DIARIA');

-- CreateEnum
CREATE TYPE "GoalLevel" AS ENUM ('TRIMESTRAL', 'MENSAL', 'SEMANAL', 'AVULSA', 'ANUAL', 'DIARIA');

-- CreateEnum
CREATE TYPE "PlanningPeriodType" AS ENUM ('ANUAL', 'TRIMESTRAL', 'MENSAL', 'SEMANAL', 'DIARIO');

-- CreateEnum
CREATE TYPE "PlanningPeriodStatus" AS ENUM ('PLANEJADO', 'ATIVO', 'CONCLUIDO', 'ENCERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ContributionUnit" AS ENUM ('PERCENTUAL', 'QUANTIDADE', 'REAIS', 'LEADS', 'REUNIOES', 'PROPOSTAS', 'CLIENTES', 'HORAS', 'OUTRO');

-- CreateEnum
CREATE TYPE "GoalDistributionType" AS ENUM ('VALOR_FIXO', 'PERCENTUAL', 'COMPARTILHADA', 'IGUALITARIA');

-- CreateEnum
CREATE TYPE "GoalUnit" AS ENUM ('REAIS', 'NUMERO', 'PERCENTUAL', 'HORAS');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('NAO_INICIADA', 'EM_ANDAMENTO', 'NO_PRAZO', 'EM_RISCO', 'BATIDA', 'SUPERADA', 'ATRASADA', 'CANCELADA', 'NAO_BATIDA', 'PAUSADA', 'ARQUIVADA');

-- CreateEnum
CREATE TYPE "GoalCalculationMode" AS ENUM ('AUTOMATICO', 'MANUAL', 'CHECKLIST');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('A_FAZER', 'EM_ANDAMENTO', 'AGUARDANDO', 'CONCLUIDA', 'CANCELADA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "status" "UserStatus" NOT NULL DEFAULT 'ATIVO',
    "costCenterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "CostCenterType" NOT NULL DEFAULT 'OUTRO',
    "responsibleUserId" TEXT,
    "parentCostCenterId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "monthlyBudgetDefault" DOUBLE PRECISION,
    "annualBudgetDefault" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL,
    "costCenterId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "periodType" "BudgetPeriodType" NOT NULL,
    "month" INTEGER,
    "quarter" INTEGER,
    "year" INTEGER NOT NULL,
    "plannedRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plannedExpense" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plannedProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "BudgetStatus" NOT NULL DEFAULT 'RASCUNHO',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "financialCategoryId" TEXT,
    "type" "FinancialType" NOT NULL,
    "plannedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDENTE',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "reason" TEXT,
    "responseNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "origin" "LeadOrigin" NOT NULL DEFAULT 'OUTRO',
    "channel" TEXT,
    "campaignId" TEXT,
    "responsibleId" TEXT,
    "costCenterId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NOVO',
    "estimatedValue" DOUBLE PRECISION,
    "probability" INTEGER,
    "expectedCloseDate" TIMESTAMP(3),
    "notes" TEXT,
    "lossReason" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "convertedClientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadInteraction" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "LeadInteractionType" NOT NULL DEFAULT 'NOTA',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "internalResponsibleId" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'PROSPECT',
    "origin" "LeadOrigin",
    "healthScore" INTEGER NOT NULL DEFAULT 50,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "leadId" TEXT,
    "costCenterId" TEXT,
    "title" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ProposalStatus" NOT NULL DEFAULT 'RASCUNHO',
    "probability" INTEGER,
    "expectedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ContractType" NOT NULL,
    "totalValue" DOUBLE PRECISION,
    "monthlyValue" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "ContractStatus" NOT NULL DEFAULT 'ATIVO',
    "costCenterId" TEXT,
    "categoryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialEntry" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "FinancialType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "competenceMonth" INTEGER NOT NULL,
    "competenceYear" INTEGER NOT NULL,
    "status" "FinancialStatus" NOT NULL DEFAULT 'PENDENTE',
    "costCenterId" TEXT,
    "categoryId" TEXT,
    "clientId" TEXT,
    "contractId" TEXT,
    "projectId" TEXT,
    "campaignId" TEXT,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "installments" INTEGER,
    "installmentNumber" INTEGER,
    "paymentMethod" "PaymentMethod",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "contractId" TEXT,
    "name" TEXT NOT NULL,
    "type" "ProjectType" NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANEJADO',
    "budgetValue" DOUBLE PRECISION,
    "estimatedCost" DOUBLE PRECISION,
    "hourlyRate" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "responsibleId" TEXT,
    "costCenterId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "type" "TimesheetType" NOT NULL DEFAULT 'DESENVOLVIMENTO',
    "productive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "objective" TEXT,
    "budget" DOUBLE PRECISION,
    "actualSpend" DOUBLE PRECISION,
    "leadsGenerated" INTEGER NOT NULL DEFAULT 0,
    "clientsGenerated" INTEGER NOT NULL DEFAULT 0,
    "attributedRevenue" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'PLANEJADA',
    "costCenterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalContract" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "counterpartyName" TEXT,
    "counterpartyDocument" TEXT,
    "supplierName" TEXT,
    "clientId" TEXT,
    "type" "LegalContractType" NOT NULL,
    "status" "LegalContractStatus" NOT NULL DEFAULT 'RASCUNHO',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "signatureDate" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "contractValue" DOUBLE PRECISION,
    "monthlyValue" DOUBLE PRECISION,
    "responsibleId" TEXT,
    "costCenterId" TEXT,
    "fileUrl" TEXT,
    "externalLink" TEXT,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'BAIXO',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LegalContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDeadline" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "legalContractId" TEXT,
    "legalDemandId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIA',
    "status" "LegalDeadlineStatus" NOT NULL DEFAULT 'PENDENTE',
    "responsibleId" TEXT,
    "costCenterId" TEXT,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "LegalDocumentType" NOT NULL,
    "status" "LegalDocumentStatus" NOT NULL DEFAULT 'RASCUNHO',
    "legalContractId" TEXT,
    "clientId" TEXT,
    "fileUrl" TEXT,
    "externalLink" TEXT,
    "expirationDate" TIMESTAMP(3),
    "responsibleId" TEXT,
    "costCenterId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDemand" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "LegalDemandType" NOT NULL,
    "status" "LegalDemandStatus" NOT NULL DEFAULT 'ABERTA',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIA',
    "clientId" TEXT,
    "legalContractId" TEXT,
    "responsibleId" TEXT,
    "costCenterId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LegalDemand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalRisk" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "LegalRiskType" NOT NULL,
    "probability" "RiskScale" NOT NULL DEFAULT 'MEDIO',
    "impact" "RiskScale" NOT NULL DEFAULT 'MEDIO',
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'MEDIO',
    "mitigationPlan" TEXT,
    "status" "LegalRiskStatus" NOT NULL DEFAULT 'ABERTO',
    "responsibleId" TEXT,
    "costCenterId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LegalRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "GoalType" NOT NULL,
    "period" "GoalPeriod" NOT NULL,
    "hierarchyLevel" "GoalLevel" NOT NULL DEFAULT 'AVULSA',
    "parentGoalId" TEXT,
    "planningPeriodId" TEXT,
    "goalIndicatorId" TEXT,
    "month" INTEGER,
    "quarter" INTEGER,
    "week" INTEGER,
    "year" INTEGER NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "progressPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" "GoalUnit" NOT NULL DEFAULT 'REAIS',
    "calculationMode" "GoalCalculationMode" NOT NULL DEFAULT 'MANUAL',
    "includeInParentProgress" BOOLEAN NOT NULL DEFAULT true,
    "parentWeight" DOUBLE PRECISION,
    "responsibleId" TEXT,
    "costCenterId" TEXT,
    "area" TEXT,
    "status" "GoalStatus" NOT NULL DEFAULT 'NO_PRAZO',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "achievedAt" TIMESTAMP(3),
    "exceededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalAssignee" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "distributionType" "GoalDistributionType" NOT NULL DEFAULT 'COMPARTILHADA',
    "plannedValue" DOUBLE PRECISION,
    "realizedValue" DOUBLE PRECISION,
    "percentage" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalContribution" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "unit" "ContributionUnit" NOT NULL DEFAULT 'QUANTIDADE',
    "plannedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "realizedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalIndicator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "ContributionUnit" NOT NULL DEFAULT 'QUANTIDADE',
    "customUnit" TEXT,
    "category" TEXT,
    "icon" TEXT,
    "formula" TEXT,
    "calculationType" TEXT,
    "defaultCostCenterId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningPeriod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PlanningPeriodType" NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER,
    "month" INTEGER,
    "week" INTEGER,
    "date" TIMESTAMP(3),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,
    "status" "PlanningPeriodStatus" NOT NULL DEFAULT 'PLANEJADO',
    "parentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "national" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeId" TEXT,
    "costCenterId" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIA',
    "status" "TaskStatus" NOT NULL DEFAULT 'A_FAZER',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "module" "ModuleKey" DEFAULT 'GERAL',
    "entityType" TEXT,
    "entityId" TEXT,
    "estimatedHours" DOUBLE PRECISION,
    "actualHours" DOUBLE PRECISION,
    "recurrence" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "planningPeriodId" TEXT,
    "contributionUnit" "ContributionUnit",
    "plannedContribution" DOUBLE PRECISION,
    "realizedContribution" DOUBLE PRECISION,
    "contributionWeight" DOUBLE PRECISION,
    "evidenceUrl" TEXT,
    "evidenceNote" TEXT,
    "leadId" TEXT,
    "clientId" TEXT,
    "contractId" TEXT,
    "projectId" TEXT,
    "campaignId" TEXT,
    "goalId" TEXT,
    "legalContractId" TEXT,
    "financialEntryId" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_code_key" ON "CostCenter"("code");

-- CreateIndex
CREATE INDEX "CostCenter_active_idx" ON "CostCenter"("active");

-- CreateIndex
CREATE INDEX "CostCenter_type_idx" ON "CostCenter"("type");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialCategory_code_key" ON "FinancialCategory"("code");

-- CreateIndex
CREATE INDEX "FinancialCategory_type_idx" ON "FinancialCategory"("type");

-- CreateIndex
CREATE INDEX "Budget_costCenterId_idx" ON "Budget"("costCenterId");

-- CreateIndex
CREATE INDEX "Budget_year_month_idx" ON "Budget"("year", "month");

-- CreateIndex
CREATE INDEX "Budget_status_idx" ON "Budget"("status");

-- CreateIndex
CREATE INDEX "BudgetLine_budgetId_idx" ON "BudgetLine"("budgetId");

-- CreateIndex
CREATE INDEX "BudgetLine_costCenterId_idx" ON "BudgetLine"("costCenterId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_type_idx" ON "ApprovalRequest"("type");

-- CreateIndex
CREATE INDEX "ApprovalRequest_entityType_entityId_idx" ON "ApprovalRequest"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_origin_idx" ON "Lead"("origin");

-- CreateIndex
CREATE INDEX "Lead_responsibleId_idx" ON "Lead"("responsibleId");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "LeadInteraction_leadId_idx" ON "LeadInteraction"("leadId");

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE INDEX "Client_internalResponsibleId_idx" ON "Client"("internalResponsibleId");

-- CreateIndex
CREATE INDEX "Proposal_status_idx" ON "Proposal"("status");

-- CreateIndex
CREATE INDEX "Proposal_clientId_idx" ON "Proposal"("clientId");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "Contract_type_idx" ON "Contract"("type");

-- CreateIndex
CREATE INDEX "Contract_clientId_idx" ON "Contract"("clientId");

-- CreateIndex
CREATE INDEX "FinancialEntry_type_idx" ON "FinancialEntry"("type");

-- CreateIndex
CREATE INDEX "FinancialEntry_status_idx" ON "FinancialEntry"("status");

-- CreateIndex
CREATE INDEX "FinancialEntry_competenceYear_competenceMonth_idx" ON "FinancialEntry"("competenceYear", "competenceMonth");

-- CreateIndex
CREATE INDEX "FinancialEntry_dueDate_idx" ON "FinancialEntry"("dueDate");

-- CreateIndex
CREATE INDEX "FinancialEntry_costCenterId_idx" ON "FinancialEntry"("costCenterId");

-- CreateIndex
CREATE INDEX "FinancialEntry_categoryId_idx" ON "FinancialEntry"("categoryId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_type_idx" ON "Project"("type");

-- CreateIndex
CREATE INDEX "Project_responsibleId_idx" ON "Project"("responsibleId");

-- CreateIndex
CREATE INDEX "Timesheet_projectId_idx" ON "Timesheet"("projectId");

-- CreateIndex
CREATE INDEX "Timesheet_userId_idx" ON "Timesheet"("userId");

-- CreateIndex
CREATE INDEX "Timesheet_date_idx" ON "Timesheet"("date");

-- CreateIndex
CREATE INDEX "MarketingCampaign_channel_idx" ON "MarketingCampaign"("channel");

-- CreateIndex
CREATE INDEX "MarketingCampaign_status_idx" ON "MarketingCampaign"("status");

-- CreateIndex
CREATE INDEX "LegalContract_status_idx" ON "LegalContract"("status");

-- CreateIndex
CREATE INDEX "LegalContract_type_idx" ON "LegalContract"("type");

-- CreateIndex
CREATE INDEX "LegalContract_riskLevel_idx" ON "LegalContract"("riskLevel");

-- CreateIndex
CREATE INDEX "LegalDeadline_status_idx" ON "LegalDeadline"("status");

-- CreateIndex
CREATE INDEX "LegalDeadline_date_idx" ON "LegalDeadline"("date");

-- CreateIndex
CREATE INDEX "LegalDocument_status_idx" ON "LegalDocument"("status");

-- CreateIndex
CREATE INDEX "LegalDocument_type_idx" ON "LegalDocument"("type");

-- CreateIndex
CREATE INDEX "LegalDemand_status_idx" ON "LegalDemand"("status");

-- CreateIndex
CREATE INDEX "LegalDemand_type_idx" ON "LegalDemand"("type");

-- CreateIndex
CREATE INDEX "LegalRisk_status_idx" ON "LegalRisk"("status");

-- CreateIndex
CREATE INDEX "LegalRisk_riskLevel_idx" ON "LegalRisk"("riskLevel");

-- CreateIndex
CREATE INDEX "Goal_type_idx" ON "Goal"("type");

-- CreateIndex
CREATE INDEX "Goal_year_month_idx" ON "Goal"("year", "month");

-- CreateIndex
CREATE INDEX "Goal_costCenterId_idx" ON "Goal"("costCenterId");

-- CreateIndex
CREATE INDEX "Goal_parentGoalId_idx" ON "Goal"("parentGoalId");

-- CreateIndex
CREATE INDEX "Goal_planningPeriodId_idx" ON "Goal"("planningPeriodId");

-- CreateIndex
CREATE INDEX "Goal_hierarchyLevel_idx" ON "Goal"("hierarchyLevel");

-- CreateIndex
CREATE INDEX "Goal_status_idx" ON "Goal"("status");

-- CreateIndex
CREATE INDEX "GoalAssignee_goalId_idx" ON "GoalAssignee"("goalId");

-- CreateIndex
CREATE INDEX "GoalAssignee_userId_idx" ON "GoalAssignee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalAssignee_goalId_userId_key" ON "GoalAssignee"("goalId", "userId");

-- CreateIndex
CREATE INDEX "GoalContribution_goalId_idx" ON "GoalContribution"("goalId");

-- CreateIndex
CREATE INDEX "GoalContribution_taskId_idx" ON "GoalContribution"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalContribution_taskId_goalId_key" ON "GoalContribution"("taskId", "goalId");

-- CreateIndex
CREATE INDEX "GoalIndicator_active_idx" ON "GoalIndicator"("active");

-- CreateIndex
CREATE INDEX "PlanningPeriod_type_idx" ON "PlanningPeriod"("type");

-- CreateIndex
CREATE INDEX "PlanningPeriod_year_idx" ON "PlanningPeriod"("year");

-- CreateIndex
CREATE INDEX "PlanningPeriod_parentId_idx" ON "PlanningPeriod"("parentId");

-- CreateIndex
CREATE INDEX "PlanningPeriod_startDate_endDate_idx" ON "PlanningPeriod"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_module_idx" ON "Task"("module");

-- CreateIndex
CREATE INDEX "Task_costCenterId_idx" ON "Task"("costCenterId");

-- CreateIndex
CREATE INDEX "Task_planningPeriodId_idx" ON "Task"("planningPeriodId");

-- CreateIndex
CREATE INDEX "Task_goalId_idx" ON "Task"("goalId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCenter" ADD CONSTRAINT "CostCenter_parentCostCenterId_fkey" FOREIGN KEY ("parentCostCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_financialCategoryId_fkey" FOREIGN KEY ("financialCategoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedClientId_fkey" FOREIGN KEY ("convertedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadInteraction" ADD CONSTRAINT "LeadInteraction_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadInteraction" ADD CONSTRAINT "LeadInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_internalResponsibleId_fkey" FOREIGN KEY ("internalResponsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalContract" ADD CONSTRAINT "LegalContract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalContract" ADD CONSTRAINT "LegalContract_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalContract" ADD CONSTRAINT "LegalContract_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDeadline" ADD CONSTRAINT "LegalDeadline_legalContractId_fkey" FOREIGN KEY ("legalContractId") REFERENCES "LegalContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDeadline" ADD CONSTRAINT "LegalDeadline_legalDemandId_fkey" FOREIGN KEY ("legalDemandId") REFERENCES "LegalDemand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDeadline" ADD CONSTRAINT "LegalDeadline_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDeadline" ADD CONSTRAINT "LegalDeadline_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_legalContractId_fkey" FOREIGN KEY ("legalContractId") REFERENCES "LegalContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDemand" ADD CONSTRAINT "LegalDemand_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDemand" ADD CONSTRAINT "LegalDemand_legalContractId_fkey" FOREIGN KEY ("legalContractId") REFERENCES "LegalContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDemand" ADD CONSTRAINT "LegalDemand_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDemand" ADD CONSTRAINT "LegalDemand_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalRisk" ADD CONSTRAINT "LegalRisk_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalRisk" ADD CONSTRAINT "LegalRisk_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_parentGoalId_fkey" FOREIGN KEY ("parentGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_planningPeriodId_fkey" FOREIGN KEY ("planningPeriodId") REFERENCES "PlanningPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_goalIndicatorId_fkey" FOREIGN KEY ("goalIndicatorId") REFERENCES "GoalIndicator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalAssignee" ADD CONSTRAINT "GoalAssignee_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalAssignee" ADD CONSTRAINT "GoalAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalContribution" ADD CONSTRAINT "GoalContribution_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalContribution" ADD CONSTRAINT "GoalContribution_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalIndicator" ADD CONSTRAINT "GoalIndicator_defaultCostCenterId_fkey" FOREIGN KEY ("defaultCostCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningPeriod" ADD CONSTRAINT "PlanningPeriod_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PlanningPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningPeriod" ADD CONSTRAINT "PlanningPeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_planningPeriodId_fkey" FOREIGN KEY ("planningPeriodId") REFERENCES "PlanningPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_legalContractId_fkey" FOREIGN KEY ("legalContractId") REFERENCES "LegalContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_financialEntryId_fkey" FOREIGN KEY ("financialEntryId") REFERENCES "FinancialEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

