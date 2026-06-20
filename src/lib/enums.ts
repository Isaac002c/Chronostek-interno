// Rótulos PT-BR e opções de select para todos os enums do schema.
// Centralizar aqui evita duplicação entre formulários, filtros e badges.

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "purple";

export type Option = { value: string; label: string };

function toOptions(map: Record<string, string>): Option[] {
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}

// ───────────────────────── Usuários / RBAC ─────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  SOCIO_ADMIN: "Sócio / Admin",
  FINANCEIRO: "Financeiro",
  COMERCIAL: "Comercial",
  MARKETING: "Marketing",
  TI: "Inovação / TI",
  JURIDICO: "Jurídico",
  BDR: "BDR / SDR",
  VIEWER: "Visualizador",
};

export const USER_STATUS_LABELS: Record<string, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
};

export const MODULE_LABELS: Record<string, string> = {
  DASHBOARD: "Dashboard",
  LEADS: "Leads / CRM",
  COMERCIAL: "Comercial",
  FINANCEIRO: "Financeiro",
  MARKETING: "Marketing",
  TI: "Inovação / TI",
  JURIDICO: "Jurídico",
  METAS: "Metas",
  TAREFAS: "Tarefas",
  GERAL: "Geral",
};

// ───────────────────────── Leads ─────────────────────────

export const LEAD_ORIGIN_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  GOOGLE: "Google",
  INDICACAO: "Indicação",
  COLD_CALL: "Cold Call",
  WHATSAPP: "WhatsApp",
  EVENTO: "Evento",
  SITE: "Site",
  OUTRO: "Outro",
};

export const LEAD_STATUS_LABELS: Record<string, string> = {
  NOVO: "Novo",
  CONTATADO: "Contatado",
  QUALIFICADO: "Qualificado",
  REUNIAO_MARCADA: "Reunião Marcada",
  PROPOSTA_ENVIADA: "Proposta Enviada",
  NEGOCIACAO: "Negociação",
  GANHO: "Ganho",
  PERDIDO: "Perdido",
};

export const LEAD_STATUS_TONE: Record<string, BadgeTone> = {
  NOVO: "neutral",
  CONTATADO: "info",
  QUALIFICADO: "info",
  REUNIAO_MARCADA: "purple",
  PROPOSTA_ENVIADA: "warning",
  NEGOCIACAO: "warning",
  GANHO: "success",
  PERDIDO: "danger",
};

export const LEAD_INTERACTION_TYPE_LABELS: Record<string, string> = {
  NOTA: "Nota",
  LIGACAO: "Ligação",
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  REUNIAO: "Reunião",
  OUTRO: "Outro",
};

// ───────────────────────── Comercial ─────────────────────────

export const CLIENT_STATUS_LABELS: Record<string, string> = {
  PROSPECT: "Prospect",
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  EM_RISCO: "Em Risco",
  CHURN: "Churn",
};

export const CLIENT_STATUS_TONE: Record<string, BadgeTone> = {
  PROSPECT: "info",
  ATIVO: "success",
  INATIVO: "neutral",
  EM_RISCO: "warning",
  CHURN: "danger",
};

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ENVIADA: "Enviada",
  ACEITA: "Aceita",
  RECUSADA: "Recusada",
  EXPIRADA: "Expirada",
};

export const PROPOSAL_STATUS_TONE: Record<string, BadgeTone> = {
  RASCUNHO: "neutral",
  ENVIADA: "info",
  ACEITA: "success",
  RECUSADA: "danger",
  EXPIRADA: "warning",
};

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  RECORRENTE: "Recorrente",
  PROJETO_FECHADO: "Projeto Fechado",
  CONSULTORIA: "Consultoria",
  SUPORTE: "Suporte",
  MARKETING: "Marketing",
  HIBRIDO: "Híbrido",
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  ATIVO: "Ativo",
  INADIMPLENTE: "Inadimplente",
  EM_RISCO: "Em Risco",
  CANCELADO: "Cancelado",
  RENOVACAO_PROXIMA: "Renovação Próxima",
  ENCERRADO: "Encerrado",
};

export const CONTRACT_STATUS_TONE: Record<string, BadgeTone> = {
  ATIVO: "success",
  INADIMPLENTE: "danger",
  EM_RISCO: "warning",
  CANCELADO: "neutral",
  RENOVACAO_PROXIMA: "info",
  ENCERRADO: "neutral",
};

// ───────────────────────── Financeiro ─────────────────────────

export const FINANCIAL_TYPE_LABELS: Record<string, string> = {
  RECEITA: "Receita",
  DESPESA: "Despesa",
};

export const FINANCIAL_STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  ATRASADO: "Atrasado",
  CANCELADO: "Cancelado",
};

export const FINANCIAL_STATUS_TONE: Record<string, BadgeTone> = {
  PENDENTE: "warning",
  PAGO: "success",
  ATRASADO: "danger",
  CANCELADO: "neutral",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CARTAO_CREDITO: "Cartão de Crédito",
  CARTAO_DEBITO: "Cartão de Débito",
  TRANSFERENCIA: "Transferência",
  DINHEIRO: "Dinheiro",
  OUTRO: "Outro",
};

export const CATEGORY_TYPE_LABELS: Record<string, string> = {
  RECEITA: "Receita",
  DESPESA: "Despesa",
};

// ───────────────────────── Projetos / TI ─────────────────────────

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  SISTEMA: "Sistema",
  SITE: "Site",
  LANDING_PAGE: "Landing Page",
  AUTOMACAO: "Automação",
  APP: "App / PWA",
  SUPORTE: "Suporte",
  INFRAESTRUTURA: "Infraestrutura",
  INTERNO: "Interno",
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  PLANEJADO: "Planejado",
  EM_ANDAMENTO: "Em Andamento",
  PAUSADO: "Pausado",
  EM_REVISAO: "Em Revisão",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

export const PROJECT_STATUS_TONE: Record<string, BadgeTone> = {
  PLANEJADO: "neutral",
  EM_ANDAMENTO: "info",
  PAUSADO: "warning",
  EM_REVISAO: "purple",
  ENTREGUE: "success",
  CANCELADO: "danger",
};

export const TIMESHEET_TYPE_LABELS: Record<string, string> = {
  DESENVOLVIMENTO: "Desenvolvimento",
  REUNIAO: "Reunião",
  SUPORTE: "Suporte",
  RETRABALHO: "Retrabalho",
  PLANEJAMENTO: "Planejamento",
  CORRECAO: "Correção",
  DEPLOY: "Deploy",
  OUTRO: "Outro",
};

// ───────────────────────── Marketing ─────────────────────────

export const CAMPAIGN_CHANNEL_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  INDICACAO: "Indicação",
  ORGANICO: "Orgânico",
  WHATSAPP: "WhatsApp",
  EVENTO: "Evento",
  EMAIL: "E-mail",
  OUTRO: "Outro",
};

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  PLANEJADA: "Planejada",
  ATIVA: "Ativa",
  PAUSADA: "Pausada",
  ENCERRADA: "Encerrada",
};

export const CAMPAIGN_STATUS_TONE: Record<string, BadgeTone> = {
  PLANEJADA: "neutral",
  ATIVA: "success",
  PAUSADA: "warning",
  ENCERRADA: "neutral",
};

// ───────────────────────── Jurídico ─────────────────────────

export const LEGAL_CONTRACT_TYPE_LABELS: Record<string, string> = {
  CLIENTE: "Cliente",
  FORNECEDOR: "Fornecedor",
  PARCERIA: "Parceria",
  PRESTACAO_SERVICO: "Prestação de Serviço",
  RESCISAO: "Rescisão",
  NDA: "NDA",
  OUTRO: "Outro",
};

export const LEGAL_CONTRACT_STATUS_LABELS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  EM_REVISAO: "Em Revisão",
  ASSINADO: "Assinado",
  VENCIDO: "Vencido",
  CANCELADO: "Cancelado",
};

export const LEGAL_CONTRACT_STATUS_TONE: Record<string, BadgeTone> = {
  RASCUNHO: "neutral",
  EM_REVISAO: "info",
  ASSINADO: "success",
  VENCIDO: "danger",
  CANCELADO: "neutral",
};

export const LEGAL_DEADLINE_STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em Andamento",
  CONCLUIDO: "Concluído",
  ATRASADO: "Atrasado",
};

export const LEGAL_DEADLINE_STATUS_TONE: Record<string, BadgeTone> = {
  PENDENTE: "warning",
  EM_ANDAMENTO: "info",
  CONCLUIDO: "success",
  ATRASADO: "danger",
};

// ───────────────────────── Metas ─────────────────────────

export const GOAL_TYPE_LABELS: Record<string, string> = {
  RECEITA: "Receita",
  DESPESA: "Despesa",
  LUCRO: "Lucro",
  LEADS: "Leads",
  VENDAS: "Vendas",
  PROJETOS: "Projetos",
  CONTRATOS: "Contratos",
  MRR: "MRR",
  ARR: "ARR",
  PROJETOS_ENTREGUES: "Projetos entregues",
  TAREFAS_CONCLUIDAS: "Tarefas concluídas",
  HORAS: "Horas trabalhadas",
  ROI_CAMPANHA: "ROI de campanha",
  PRAZOS_JURIDICOS: "Prazos jurídicos",
  MARKETING: "Marketing",
  FINANCEIRO: "Financeiro",
  OPERACIONAL: "Operacional",
  JURIDICO: "Jurídico",
  MANUAL: "Manual",
  OUTRO: "Outro",
};

/** Tipos de meta que o sistema calcula automaticamente a partir dos dados. */
export const GOAL_AUTOMATIC_TYPES = [
  "RECEITA",
  "DESPESA",
  "LUCRO",
  "LEADS",
  "VENDAS",
  "CONTRATOS",
  "MRR",
  "ARR",
  "PROJETOS_ENTREGUES",
  "TAREFAS_CONCLUIDAS",
  "HORAS",
  "ROI_CAMPANHA",
  "PRAZOS_JURIDICOS",
] as const;

export const GOAL_CALCULATION_MODE_LABELS: Record<string, string> = {
  AUTOMATICO: "Automático",
  MANUAL: "Manual",
};

export const GOAL_PERIOD_LABELS: Record<string, string> = {
  MENSAL: "Mensal",
  TRIMESTRAL: "Trimestral",
  ANUAL: "Anual",
};

export const GOAL_UNIT_LABELS: Record<string, string> = {
  REAIS: "R$",
  NUMERO: "Número",
  PERCENTUAL: "%",
  HORAS: "Horas",
};

export const GOAL_STATUS_LABELS: Record<string, string> = {
  NO_PRAZO: "No Prazo",
  EM_RISCO: "Em Risco",
  BATIDA: "Batida",
  NAO_BATIDA: "Não Batida",
};

export const GOAL_STATUS_TONE: Record<string, BadgeTone> = {
  NO_PRAZO: "info",
  EM_RISCO: "warning",
  BATIDA: "success",
  NAO_BATIDA: "danger",
};

// ───────────────────────── Tarefas ─────────────────────────

export const PRIORITY_LABELS: Record<string, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

export const PRIORITY_TONE: Record<string, BadgeTone> = {
  BAIXA: "neutral",
  MEDIA: "info",
  ALTA: "warning",
  CRITICA: "danger",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  A_FAZER: "A Fazer",
  EM_ANDAMENTO: "Em Andamento",
  AGUARDANDO: "Aguardando",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

export const TASK_STATUS_TONE: Record<string, BadgeTone> = {
  A_FAZER: "neutral",
  EM_ANDAMENTO: "info",
  AGUARDANDO: "warning",
  CONCLUIDA: "success",
  CANCELADA: "danger",
};

// ───────────────────────── Helpers de opções ─────────────────────────

export const ROLE_OPTIONS = toOptions(ROLE_LABELS);
export const USER_STATUS_OPTIONS = toOptions(USER_STATUS_LABELS);
export const LEAD_ORIGIN_OPTIONS = toOptions(LEAD_ORIGIN_LABELS);
export const LEAD_STATUS_OPTIONS = toOptions(LEAD_STATUS_LABELS);
export const LEAD_INTERACTION_TYPE_OPTIONS = toOptions(LEAD_INTERACTION_TYPE_LABELS);
export const CLIENT_STATUS_OPTIONS = toOptions(CLIENT_STATUS_LABELS);
export const PROPOSAL_STATUS_OPTIONS = toOptions(PROPOSAL_STATUS_LABELS);
export const CONTRACT_TYPE_OPTIONS = toOptions(CONTRACT_TYPE_LABELS);
export const CONTRACT_STATUS_OPTIONS = toOptions(CONTRACT_STATUS_LABELS);
export const FINANCIAL_TYPE_OPTIONS = toOptions(FINANCIAL_TYPE_LABELS);
export const FINANCIAL_STATUS_OPTIONS = toOptions(FINANCIAL_STATUS_LABELS);
export const PAYMENT_METHOD_OPTIONS = toOptions(PAYMENT_METHOD_LABELS);
export const PROJECT_TYPE_OPTIONS = toOptions(PROJECT_TYPE_LABELS);
export const PROJECT_STATUS_OPTIONS = toOptions(PROJECT_STATUS_LABELS);
export const TIMESHEET_TYPE_OPTIONS = toOptions(TIMESHEET_TYPE_LABELS);
export const CAMPAIGN_CHANNEL_OPTIONS = toOptions(CAMPAIGN_CHANNEL_LABELS);
export const CAMPAIGN_STATUS_OPTIONS = toOptions(CAMPAIGN_STATUS_LABELS);
export const LEGAL_CONTRACT_TYPE_OPTIONS = toOptions(LEGAL_CONTRACT_TYPE_LABELS);
export const LEGAL_CONTRACT_STATUS_OPTIONS = toOptions(LEGAL_CONTRACT_STATUS_LABELS);
export const LEGAL_DEADLINE_STATUS_OPTIONS = toOptions(LEGAL_DEADLINE_STATUS_LABELS);
export const GOAL_TYPE_OPTIONS = toOptions(GOAL_TYPE_LABELS);
export const GOAL_PERIOD_OPTIONS = toOptions(GOAL_PERIOD_LABELS);
export const GOAL_UNIT_OPTIONS = toOptions(GOAL_UNIT_LABELS);
export const GOAL_STATUS_OPTIONS = toOptions(GOAL_STATUS_LABELS);
export const PRIORITY_OPTIONS = toOptions(PRIORITY_LABELS);
export const TASK_STATUS_OPTIONS = toOptions(TASK_STATUS_LABELS);
export const MODULE_OPTIONS = toOptions(MODULE_LABELS);

export function labelOf(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "—";
  return map[value] ?? value;
}

// ───────────────────────── Centro de Custo ─────────────────────────

export const COST_CENTER_TYPE_LABELS: Record<string, string> = {
  FINANCEIRO: "Financeiro",
  COMERCIAL: "Comercial",
  MARKETING: "Marketing",
  TI: "Inovação / TI",
  JURIDICO: "Jurídico",
  ADMINISTRATIVO: "Administrativo",
  OUTRO: "Outro",
};

export const COST_CENTER_TYPE_OPTIONS = toOptions(COST_CENTER_TYPE_LABELS);

// ───────────────────────── Orçamento ─────────────────────────

export const BUDGET_PERIOD_LABELS: Record<string, string> = {
  MENSAL: "Mensal",
  TRIMESTRAL: "Trimestral",
  ANUAL: "Anual",
};

export const BUDGET_STATUS_LABELS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  APROVADO: "Aprovado",
  ATIVO: "Ativo",
  ENCERRADO: "Encerrado",
};

export const BUDGET_STATUS_TONE: Record<string, BadgeTone> = {
  RASCUNHO: "neutral",
  APROVADO: "info",
  ATIVO: "success",
  ENCERRADO: "neutral",
};

export const BUDGET_PERIOD_OPTIONS = toOptions(BUDGET_PERIOD_LABELS);
export const BUDGET_STATUS_OPTIONS = toOptions(BUDGET_STATUS_LABELS);

// ───────────────────────── Aprovações ─────────────────────────

export const APPROVAL_TYPE_LABELS: Record<string, string> = {
  ORCAMENTO: "Orçamento",
  DESPESA: "Despesa",
  EDICAO_MES_FECHADO: "Edição de mês fechado",
  CONTRATO: "Contrato",
  RISCO_JURIDICO: "Risco jurídico",
};

export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
};

export const APPROVAL_STATUS_TONE: Record<string, BadgeTone> = {
  PENDENTE: "warning",
  APROVADO: "success",
  REJEITADO: "danger",
};

// ───────────────────────── Jurídico (entidades novas) ─────────────────────────

export const LEGAL_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CONTRATO: "Contrato",
  NDA: "NDA",
  PROPOSTA: "Proposta",
  TERMO_RESCISAO: "Termo de rescisão",
  NOTIFICACAO: "Notificação",
  PROCURACAO: "Procuração",
  DOC_EMPRESA: "Documento da empresa",
  DOC_CLIENTE: "Documento do cliente",
  OUTRO: "Outro",
};

export const LEGAL_DOCUMENT_STATUS_LABELS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  VALIDO: "Válido",
  VENCIDO: "Vencido",
  ARQUIVADO: "Arquivado",
};

export const LEGAL_DOCUMENT_STATUS_TONE: Record<string, BadgeTone> = {
  RASCUNHO: "neutral",
  VALIDO: "success",
  VENCIDO: "danger",
  ARQUIVADO: "neutral",
};

export const LEGAL_DEMAND_TYPE_LABELS: Record<string, string> = {
  REVISAO_CONTRATO: "Revisão de contrato",
  QUESTAO_CLIENTE: "Questão com cliente",
  QUESTAO_FORNECEDOR: "Questão com fornecedor",
  COBRANCA: "Cobrança",
  POLITICA_INTERNA: "Política interna",
  PRIVACIDADE: "Privacidade / LGPD",
  SOCIETARIO: "Societário",
  OUTRO: "Outro",
};

export const LEGAL_DEMAND_STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANALISE: "Em análise",
  AGUARDANDO: "Aguardando",
  RESOLVIDA: "Resolvida",
  CANCELADA: "Cancelada",
};

export const LEGAL_DEMAND_STATUS_TONE: Record<string, BadgeTone> = {
  ABERTA: "warning",
  EM_ANALISE: "info",
  AGUARDANDO: "neutral",
  RESOLVIDA: "success",
  CANCELADA: "neutral",
};

export const LEGAL_RISK_TYPE_LABELS: Record<string, string> = {
  CONTRATUAL: "Contratual",
  FINANCEIRO: "Financeiro",
  COMPLIANCE: "Compliance",
  PRIVACIDADE: "Privacidade / LGPD",
  TRABALHISTA: "Trabalhista",
  TRIBUTARIO: "Tributário",
  CLIENTE: "Cliente",
  FORNECEDOR: "Fornecedor",
  OUTRO: "Outro",
};

export const LEGAL_RISK_STATUS_LABELS: Record<string, string> = {
  ABERTO: "Aberto",
  MITIGANDO: "Mitigando",
  ACEITO: "Aceito",
  RESOLVIDO: "Resolvido",
};

export const LEGAL_RISK_STATUS_TONE: Record<string, BadgeTone> = {
  ABERTO: "warning",
  MITIGANDO: "info",
  ACEITO: "neutral",
  RESOLVIDO: "success",
};

export const RISK_SCALE_LABELS: Record<string, string> = {
  BAIXO: "Baixo",
  MEDIO: "Médio",
  ALTO: "Alto",
};

export const RISK_LEVEL_LABELS: Record<string, string> = {
  BAIXO: "Baixo",
  MEDIO: "Médio",
  ALTO: "Alto",
  CRITICO: "Crítico",
};

export const RISK_LEVEL_TONE: Record<string, BadgeTone> = {
  BAIXO: "success",
  MEDIO: "info",
  ALTO: "warning",
  CRITICO: "danger",
};

export const LEGAL_DOCUMENT_TYPE_OPTIONS = toOptions(LEGAL_DOCUMENT_TYPE_LABELS);
export const LEGAL_DOCUMENT_STATUS_OPTIONS = toOptions(LEGAL_DOCUMENT_STATUS_LABELS);
export const LEGAL_DEMAND_TYPE_OPTIONS = toOptions(LEGAL_DEMAND_TYPE_LABELS);
export const LEGAL_DEMAND_STATUS_OPTIONS = toOptions(LEGAL_DEMAND_STATUS_LABELS);
export const LEGAL_RISK_TYPE_OPTIONS = toOptions(LEGAL_RISK_TYPE_LABELS);
export const LEGAL_RISK_STATUS_OPTIONS = toOptions(LEGAL_RISK_STATUS_LABELS);
export const RISK_SCALE_OPTIONS = toOptions(RISK_SCALE_LABELS);
export const RISK_LEVEL_OPTIONS = toOptions(RISK_LEVEL_LABELS);
