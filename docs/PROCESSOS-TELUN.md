# Processos Operacionais da Telun

Documentação operacional dos **12 processos** que transformam o sistema interno
em o *sistema operacional da empresa*. A **execução** de cada processo acontece
dentro do módulo onde o trabalho realmente ocorre (Comercial, Financeiro, TI,
Marketing, Jurídico). A **governança** (acompanhamento de dono, status, KPI, SLA
e revisão) fica em **Processos** (`/dashboard/processos`).

> Princípio central: nenhum processo obriga a recadastrar dado que já existe. Um
> registro num fluxo alimenta os demais módulos. KPIs vêm dos dados reais — quando
> ainda não há fonte instrumentada, mostramos empty state (nunca número inventado).

## Como o sistema sustenta a operação

```
MARKETING (gera demanda) → COMERCIAL (qualifica e vende) → JURÍDICO (formaliza)
→ TI (executa) → FINANCEIRO (recebe e mede) → GESTÃO (acompanha e decide)
```

- **Governança de Processos** (`/dashboard/processos`): os 12 processos, dono,
  status, KPI principal (valor **ao vivo** × meta) e SLA. Não executa — acompanha.
- **Minha Operação** (`/dashboard/minha-operacao`): "o que preciso fazer hoje" —
  agrega, por permissão, follow-ups comerciais, títulos vencidos, contratos a
  renovar, prazos jurídicos e tarefas atrasadas, direto dos módulos.
- **Próxima ação transversal**: `nextAction` / `nextActionAt` em Lead, Proposal,
  Contract e FinancialEntry. Item ativo sem próxima ação é sinalizado como exceção.

## Modelo padrão de processo (metadados)

Cada processo (`ProcessDefinition`) carrega: código, nome, centro de custo/área,
dono, objetivo, gatilho, entradas, **etapas**, saída, **SLA**, **KPI principal**
(nome, meta, unidade, fonte de cálculo), cadência de revisão, status
(`PLANEJADO · IMPLANTACAO · ATIVO · EM_REVISAO · INATIVO`), versão, datas de
revisão e documentação. Revisões (`ProcessReview`) e ações corretivas
(`CorrectiveAction`) penduram no processo para sustentar o ritual semanal (§12).

## Os 12 processos

### Financeiro (CC 1000)
| Cód | Processo | Gatilho | KPI principal | Meta | SLA |
|-----|----------|---------|---------------|------|-----|
| **F1** | Faturamento, Recebimento e Cobrança | Contrato/serviço aprovado | Recebíveis vencidos em aberto (ao vivo) | R$ 0 | Nenhum título vencido sem próxima ação |
| **F2** | Tesouraria e Forecast de Caixa | Despesa/competência | Saldo projetado (fim do ano) | > 0 | Forecast semanal |
| **F3** | Fechamento Gerencial Mensal | Virada de mês | Faturamento do mês por competência (ao vivo) | R$ 15.000 (alvo) | D+5 |

Metas de faturamento (configuráveis em Metas): **obrigatória R$ 12.000 · alvo R$ 15.000 · estendida R$ 20.000**.

### Tecnologia / TI (CC 4000)
| Cód | Processo | Gatilho | KPI principal | SLA |
|-----|----------|---------|---------------|-----|
| **T1** | Demanda à Produção | Nova demanda | Projetos/demandas em andamento (ao vivo) | Lead time por prioridade |
| **T2** | Chamados, Incidentes e Suporte | Abertura de chamado | Chamados abertos | SLA por impacto×urgência |
| **T3** | Confiabilidade e Governança Técnica | Sistema em produção | Sistemas com backup OK | Backup testado |

### Marketing (CC 3000)
| Cód | Processo | Gatilho | KPI principal | SLA |
|-----|----------|---------|---------------|-----|
| **M1** | Planejamento, Produção e Publicação | Meta/pauta | Planejado × publicado | Calendário em dia |
| **M2** | Aquisição e Geração de Leads | Campanha no ar | Leads gerados no mês (ao vivo) | Lead roteado no mesmo dia |
| **M3** | Análise, Aprendizado e Otimização | Ciclo semanal | Campanhas analisadas | Relatório semanal |

Estratégia editorial (meta configurável): **~60% Systems · 25% Growth · 15% Institucional**.

### Operação Comercial (CC 2000 — Comercial + Jurídico)
| Cód | Processo | Gatilho | KPI principal | SLA |
|-----|----------|---------|---------------|-----|
| **OC1** | Prospecção e Qualificação | ICP/lista/lead | Leads novos no mês (ao vivo) | Lead ativo sempre com responsável e próxima ação |
| **OC2** | Oportunidade, Proposta e Venda | Lead qualificado | Pipeline aberto (ao vivo) | Proposta enviada sempre com follow-up |
| **OC3** | Contrato, Handoff e Renovação | Venda aprovada | Contratos em renovação (60d, ao vivo) | Alertas de renovação/reajuste |

## Handoffs entre áreas (§8)

1. **Marketing → Comercial**: lead com origem/campanha (sem CRM paralelo; Marketing gera, Comercial trata).
2. **Comercial → Jurídico**: proposta aceita vira contrato (escopo/valor/condições).
3. **Comercial/Jurídico → Financeiro**: contrato ativado gera previsões/contas a receber (recorrências existentes).
4. **Comercial/Jurídico → TI**: venda Systems gera projeto/demanda.
5. **TI → Comercial**: entrega/expansão vira oportunidade de upsell.
6. **Financeiro → Comercial**: inadimplência/risco aparece na visão do cliente (respeitando permissões).

## Estado de implementação (iteração atual)

**Entregue e validado (ponta a ponta, com dados reais):**
- Camada de governança dos 12 processos + KPIs ao vivo + empty states honestos.
- Próxima ação transversal (Lead/Proposal/Contract/FinancialEntry) + captura na tela de Lead.
- "Minha Operação" agregando pendências dos módulos por permissão.
- Migration aditiva, seed idempotente dos 12 processos, RBAC (`PROCESSOS`).

**Próximas iterações (staged):** execução aprofundada por processo — régua de
cobrança operacional (F1), forecast 8–13 semanas (F2), chamados/incidentes +
post-mortem (T2), inventário de sistemas/backups (T3), calendário editorial +
experimentos (M1/M3), pipeline com estágios/win-rate e visão Meta→Pipeline→GAP
(OC2), revisão semanal com ações corretivas e scorecards por CC.
