/**
 * Catálogo PURO dos 12 processos (sem I/O, sem alias) — pode ser importado tanto
 * pela app (via @/lib/processes) quanto pelo seed (import relativo), pois o tsx
 * do seed não resolve o alias "@/".
 */
export type ProcessSeed = {
  code: string;
  name: string;
  costCenterCode: number; // 1000 Fin · 2000 Com · 3000 Mkt · 4000 TI · 5000 Jur
  objective: string;
  trigger: string;
  steps: string[];
  sla: string;
  kpiPrimaryName: string;
  kpiPrimaryTarget: string;
  kpiPrimaryUnit: string;
  /** Chave de cálculo ao vivo (ver computeProcessKpis). null = sem fonte ainda. */
  kpiSource: string | null;
  order: number;
};

export const PROCESS_CATALOG: ProcessSeed[] = [
  // ───────── FINANCEIRO (CC 1000) ─────────
  {
    code: "F1",
    name: "Faturamento, Recebimento e Cobrança",
    costCenterCode: 1000,
    objective: "Garantir que toda receita contratada seja faturada, cobrada, recebida e conciliada.",
    trigger: "Contrato/serviço aprovado",
    steps: ["Agenda financeira", "Conta a receber", "NF (quando aplicável)", "Cobrança", "Vencimento", "Régua de cobrança", "Recebimento", "Baixa", "Conciliação"],
    sla: "Nenhum título vencido sem próxima ação",
    kpiPrimaryName: "Recebíveis vencidos em aberto",
    kpiPrimaryTarget: "0",
    kpiPrimaryUnit: "R$",
    kpiSource: "receber_vencido",
    order: 1,
  },
  {
    code: "F2",
    name: "Tesouraria e Forecast de Caixa",
    costCenterCode: 1000,
    objective: "Manter previsibilidade de caixa (8–13 semanas) e disciplina de contas a pagar.",
    trigger: "Despesa registrada / competência aberta",
    steps: ["Classificação", "Centro de custo", "Aprovação", "Vencimento", "Pagamento", "Comprovante", "Conciliação", "Forecast"],
    sla: "Forecast atualizado semanalmente",
    kpiPrimaryName: "Saldo projetado (fim do ano)",
    kpiPrimaryTarget: "> 0",
    kpiPrimaryUnit: "R$",
    kpiSource: "saldo_projetado",
    order: 2,
  },
  {
    code: "F3",
    name: "Fechamento Gerencial Mensal",
    costCenterCode: 1000,
    objective: "Entregar números confiáveis do mês anterior até D+5.",
    trigger: "Virada de mês",
    steps: ["Conciliação", "Revisão", "Classificação", "Fechamento", "DRE", "Orçado x Realizado", "Forecast", "Aprovação"],
    sla: "D+5 do mês seguinte",
    kpiPrimaryName: "Faturamento do mês (competência)",
    kpiPrimaryTarget: "15000",
    kpiPrimaryUnit: "R$",
    kpiSource: "faturamento_mes",
    order: 3,
  },
  // ───────── TECNOLOGIA / TI (CC 4000) ─────────
  {
    code: "T1",
    name: "Demanda à Produção",
    costCenterCode: 4000,
    objective: "Levar uma demanda de entendimento a produção com qualidade e Definition of Done.",
    trigger: "Nova demanda (feature/bug/melhoria)",
    steps: ["Backlog", "Análise", "Planejado", "Em desenvolvimento", "Code review", "Teste", "Homologação", "Deploy", "Documentação", "Concluído"],
    sla: "Lead time alvo por prioridade",
    kpiPrimaryName: "Projetos/demandas em andamento",
    kpiPrimaryTarget: "—",
    kpiPrimaryUnit: "un",
    kpiSource: "projetos_andamento",
    order: 4,
  },
  {
    code: "T2",
    name: "Chamados, Incidentes e Suporte",
    costCenterCode: 4000,
    objective: "Atender solicitações/incidentes dentro do SLA e tratar causa raiz de recorrências.",
    trigger: "Abertura de chamado/incidente",
    steps: ["Entrada", "Classificação", "Prioridade (impacto×urgência)", "SLA", "Atendimento", "Resolução", "Validação", "Encerramento"],
    sla: "SLA por prioridade (impacto×urgência)",
    kpiPrimaryName: "Chamados abertos",
    kpiPrimaryTarget: "—",
    kpiPrimaryUnit: "un",
    kpiSource: null,
    order: 5,
  },
  {
    code: "T3",
    name: "Confiabilidade e Governança Técnica",
    costCenterCode: 4000,
    objective: "Manter inventário de sistemas, backups testados e monitoramento ativo.",
    trigger: "Cadastro/alteração de sistema em produção",
    steps: ["Inventário", "Monitoramento", "Backup", "Teste de restauração", "Documentação", "Revisão"],
    sla: "Backup testado por sistema crítico",
    kpiPrimaryName: "Sistemas com backup OK",
    kpiPrimaryTarget: "100%",
    kpiPrimaryUnit: "%",
    kpiSource: null,
    order: 6,
  },
  // ───────── MARKETING (CC 3000) ─────────
  {
    code: "M1",
    name: "Planejamento, Produção e Publicação",
    costCenterCode: 3000,
    objective: "Transformar metas comerciais em conteúdo publicado (Systems/Growth/Institucional).",
    trigger: "Meta comercial / pauta",
    steps: ["Meta", "ICP", "Campanha", "Pauta", "Produção", "Aprovação", "Publicação", "Resultado"],
    sla: "Calendário editorial em dia",
    kpiPrimaryName: "Planejado x publicado",
    kpiPrimaryTarget: "≥ 90%",
    kpiPrimaryUnit: "%",
    kpiSource: null,
    order: 7,
  },
  {
    code: "M2",
    name: "Aquisição e Geração de Leads",
    costCenterCode: 3000,
    objective: "Gerar leads qualificados para a Operação Comercial (Systems em foco).",
    trigger: "Campanha/anúncio no ar",
    steps: ["Campanha", "Anúncio/Conteúdo", "Interação", "Lead", "Origem", "Qualificação", "Handoff comercial"],
    sla: "Lead roteado ao comercial no mesmo dia",
    kpiPrimaryName: "Leads gerados no mês",
    kpiPrimaryTarget: "—",
    kpiPrimaryUnit: "un",
    kpiSource: "leads_novos_mes",
    order: 8,
  },
  {
    code: "M3",
    name: "Análise, Aprendizado e Otimização",
    costCenterCode: 3000,
    objective: "Rotina semanal de análise (continuar/parar/testar) das ações de marketing.",
    trigger: "Ciclo semanal de campanhas",
    steps: ["Coleta de resultados", "Aprendizado", "Hipótese", "Decisão (continuar/parar/testar)", "Próxima ação"],
    sla: "Relatório semanal",
    kpiPrimaryName: "Campanhas ativas analisadas",
    kpiPrimaryTarget: "100%",
    kpiPrimaryUnit: "%",
    kpiSource: null,
    order: 9,
  },
  // ───────── OPERAÇÃO COMERCIAL (CC 2000) ─────────
  {
    code: "OC1",
    name: "Prospecção e Qualificação",
    costCenterCode: 2000,
    objective: "Gerar leads qualificados a partir do ICP e múltiplos canais.",
    trigger: "ICP / lista / lead recebido",
    steps: ["ICP", "Lista", "Prospecção", "Contato", "Follow-up", "Resposta", "Qualificação", "Oportunidade"],
    sla: "Nenhum lead ativo sem responsável e próxima ação",
    kpiPrimaryName: "Leads novos no mês",
    kpiPrimaryTarget: "—",
    kpiPrimaryUnit: "un",
    kpiSource: "leads_novos_mes",
    order: 10,
  },
  {
    code: "OC2",
    name: "Oportunidade, Proposta e Venda",
    costCenterCode: 2000,
    objective: "Conduzir oportunidades até o fechamento com follow-up disciplinado.",
    trigger: "Lead qualificado",
    steps: ["Diagnóstico", "Solução", "Oportunidade", "Proposta", "Follow-up", "Negociação", "Ganho/Perdido"],
    sla: "Nenhuma proposta enviada sem follow-up programado",
    kpiPrimaryName: "Pipeline aberto (propostas)",
    kpiPrimaryTarget: "—",
    kpiPrimaryUnit: "R$",
    kpiSource: "pipeline_aberto",
    order: 11,
  },
  {
    code: "OC3",
    name: "Contrato, Handoff e Renovação",
    costCenterCode: 2000,
    objective: "Formalizar a venda, ativar entrega e gerir renovação/reajuste (Com+Jur+Fin+TI).",
    trigger: "Venda aprovada",
    steps: ["Contrato", "Revisão", "Assinatura", "Ativação", "Handoff", "Execução", "Acompanhamento", "Renovação/Encerramento"],
    sla: "Alertas de renovação e reajuste ativos",
    kpiPrimaryName: "Contratos próximos da renovação (60d)",
    kpiPrimaryTarget: "—",
    kpiPrimaryUnit: "un",
    kpiSource: "contratos_renovacao",
    order: 12,
  },
];
