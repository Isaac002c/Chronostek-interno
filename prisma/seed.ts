import { PrismaClient, CostCenterType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Domínio institucional dos usuários-semente. Configurável para instalações
// novas; não afeta usuários já existentes no banco (upsert é por e-mail).
const EMAIL_DOMAIN = process.env.SEED_EMAIL_DOMAIN?.trim() || "telun.com.br";

const now = new Date();
function compOffset(n: number) {
  const d = new Date(now.getFullYear(), now.getMonth() - n, 1);
  return { competenceMonth: d.getMonth() + 1, competenceYear: d.getFullYear() };
}
function dayInMonth(n: number, day = 15) {
  return new Date(now.getFullYear(), now.getMonth() - n, day);
}
function daysFromNow(d: number) {
  return new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("🌱 Seed Telun — iniciando...");

  // ───────────── Centros de custo ─────────────
  const costCentersData = [
    { code: 1000, name: "Diretoria Financeira" },
    { code: 2000, name: "Diretoria Comercial" },
    { code: 3000, name: "Diretoria Marketing" },
    { code: 4000, name: "Diretoria Inovação/TI" },
    { code: 5000, name: "Jurídico" },
  ];
  const costCenters: Record<number, string> = {};
  for (const cc of costCentersData) {
    const rec = await prisma.costCenter.upsert({
      where: { code: cc.code },
      update: { name: cc.name },
      create: cc,
    });
    costCenters[cc.code] = rec.id;
  }

  // ───────────── Categorias financeiras ─────────────
  const categoriesData = [
    { code: "1.1", name: "Desenvolvimento", type: "RECEITA" as const, dreGroup: "RECEITA_BRUTA" as const },
    { code: "1.2", name: "Mensalidades", type: "RECEITA" as const, dreGroup: "RECEITA_BRUTA" as const },
    { code: "1.3", name: "Consultoria", type: "RECEITA" as const, dreGroup: "RECEITA_BRUTA" as const },
    { code: "1.4", name: "Gestão de Tráfego", type: "RECEITA" as const, dreGroup: "RECEITA_BRUTA" as const },
    { code: "1.5", name: "Setup/Implantação", type: "RECEITA" as const, dreGroup: "RECEITA_BRUTA" as const },
    { code: "1.6", name: "Automação", type: "RECEITA" as const, dreGroup: "RECEITA_BRUTA" as const },
    { code: "1.7", name: "Hospedagem", type: "RECEITA" as const, dreGroup: "RECEITA_BRUTA" as const },
    { code: "1.8", name: "Suporte", type: "RECEITA" as const, dreGroup: "RECEITA_BRUTA" as const },
    { code: "2.1", name: "Comissão", type: "DESPESA" as const, dreGroup: "DESPESAS_COMERCIAIS" as const },
    { code: "2.2", name: "VPS/Cloud", type: "DESPESA" as const, dreGroup: "CUSTOS_DIRETOS" as const },
    { code: "2.3", name: "APIs", type: "DESPESA" as const, dreGroup: "CUSTOS_DIRETOS" as const },
    { code: "2.4", name: "Ferramentas", type: "DESPESA" as const, dreGroup: "DESPESAS_TECNOLOGIA" as const },
    { code: "2.5", name: "Domínios", type: "DESPESA" as const, dreGroup: "CUSTOS_DIRETOS" as const },
    { code: "2.6", name: "Marketing Interno", type: "DESPESA" as const, dreGroup: "DESPESAS_MARKETING" as const },
    { code: "2.7", name: "Contabilidade", type: "DESPESA" as const, dreGroup: "DESPESAS_ADMINISTRATIVAS" as const },
    { code: "2.8", name: "Jurídico", type: "DESPESA" as const, dreGroup: "DESPESAS_ADMINISTRATIVAS" as const },
    { code: "2.9", name: "Bancos/Taxas", type: "DESPESA" as const, dreGroup: "DESPESAS_FINANCEIRAS" as const },
    { code: "2.10", name: "Impostos", type: "DESPESA" as const, dreGroup: "DEDUCOES" as const },
  ];
  const categories: Record<string, string> = {};
  for (const c of categoriesData) {
    const rec = await prisma.financialCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, type: c.type, dreGroup: c.dreGroup },
      create: c,
    });
    categories[c.code] = rec.id;
  }

  // ───────────── Configuração da organização (marca vs. dados jurídicos) ─────────────
  if (!(await prisma.organizationSettings.findFirst())) {
    await prisma.organizationSettings.create({
      data: { brandName: "Telun", legalName: "Telun Tecnologia LTDA", tradeName: "Telun" },
    });
  }

  // ───────────── Usuários ─────────────
  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? "changeme", 10);
  const usersData = [
    { name: "Administrador Telun", email: `admin@${EMAIL_DOMAIN}`, role: "SUPER_ADMIN" as const, cc: 4000 },
    { name: "Sócio Diretor", email: `socio@${EMAIL_DOMAIN}`, role: "SOCIO_ADMIN" as const, cc: 1000 },
    { name: "Ana Financeiro", email: `financeiro@${EMAIL_DOMAIN}`, role: "FINANCEIRO" as const, cc: 1000 },
    { name: "Bruno Comercial", email: `comercial@${EMAIL_DOMAIN}`, role: "COMERCIAL" as const, cc: 2000 },
    { name: "Carla Marketing", email: `marketing@${EMAIL_DOMAIN}`, role: "MARKETING" as const, cc: 3000 },
    { name: "Diego TI", email: `ti@${EMAIL_DOMAIN}`, role: "TI" as const, cc: 4000 },
    { name: "Elaine Jurídico", email: `juridico@${EMAIL_DOMAIN}`, role: "JURIDICO" as const, cc: 5000 },
    { name: "Felipe BDR", email: `bdr@${EMAIL_DOMAIN}`, role: "BDR" as const, cc: 2000 },
  ];
  const users: Record<string, string> = {};
  for (const u of usersData) {
    const rec = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, status: "ATIVO", costCenterId: costCenters[u.cc] },
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        status: "ATIVO",
        costCenterId: costCenters[u.cc],
      },
    });
    users[u.role] = rec.id;
  }

  // Enriquecer centros de custo com tipo, responsável e orçamento padrão.
  const ccMeta: Record<number, { type: CostCenterType; respRole: string; monthly: number }> = {
    1000: { type: CostCenterType.FINANCEIRO, respRole: "FINANCEIRO", monthly: 500 },
    2000: { type: CostCenterType.COMERCIAL, respRole: "COMERCIAL", monthly: 1500 },
    3000: { type: CostCenterType.MARKETING, respRole: "MARKETING", monthly: 2000 },
    4000: { type: CostCenterType.TI, respRole: "TI", monthly: 3000 },
    5000: { type: CostCenterType.JURIDICO, respRole: "JURIDICO", monthly: 500 },
  };
  for (const [codeStr, m] of Object.entries(ccMeta)) {
    await prisma.costCenter.update({
      where: { code: Number(codeStr) },
      data: {
        type: m.type,
        responsibleUserId: users[m.respRole],
        monthlyBudgetDefault: m.monthly,
        annualBudgetDefault: m.monthly * 12,
      },
    });
  }

  // Evita duplicar dados transacionais em re-execuções.
  const existingLeads = await prisma.lead.count();
  if (existingLeads > 0) {
    console.log("✓ Dados de exemplo já existem — pulando criação transacional.");
    console.log("✅ Seed concluído (somente referência atualizada).");
    return;
  }

  const comercialId = users.COMERCIAL;
  const bdrId = users.BDR;
  const tiId = users.TI;

  // ───────────── Clientes ─────────────
  const clientsSeed = [
    { name: "Clínica Vida Saudável LTDA", tradeName: "Vida Saudável", status: "ATIVO" as const, health: 82, origin: "INDICACAO" as const },
    { name: "Imobiliária Horizonte LTDA", tradeName: "Horizonte Imóveis", status: "ATIVO" as const, health: 74, origin: "GOOGLE" as const },
    { name: "AutoCenter Premium ME", tradeName: "AutoCenter Premium", status: "EM_RISCO" as const, health: 38, origin: "INSTAGRAM" as const },
    { name: "Escola Futuro Brilhante", tradeName: "Futuro Brilhante", status: "ATIVO" as const, health: 90, origin: "SITE" as const },
    { name: "Restaurante Sabor & Arte", tradeName: "Sabor & Arte", status: "PROSPECT" as const, health: 55, origin: "WHATSAPP" as const },
  ];
  const clients: string[] = [];
  for (const c of clientsSeed) {
    const rec = await prisma.client.create({
      data: {
        name: c.name,
        tradeName: c.tradeName,
        status: c.status,
        healthScore: c.health,
        origin: c.origin,
        email: `contato@${c.tradeName.toLowerCase().replace(/[^a-z]/g, "")}.com.br`,
        phone: "(11) 90000-0000",
        internalResponsibleId: comercialId,
      },
    });
    clients.push(rec.id);
  }

  // ───────────── Leads ─────────────
  const leadsSeed = [
    { name: "Marcos Almeida", company: "Pet Shop Amigo Fiel", origin: "INSTAGRAM" as const, status: "QUALIFICADO" as const, value: 12000, prob: 60, resp: comercialId },
    { name: "Juliana Costa", company: "Academia Corpo em Forma", origin: "GOOGLE" as const, status: "PROPOSTA_ENVIADA" as const, value: 18000, prob: 70, resp: comercialId },
    { name: "Ricardo Souza", company: "Advocacia Souza & Lima", origin: "INDICACAO" as const, status: "NEGOCIACAO" as const, value: 25000, prob: 80, resp: bdrId },
    { name: "Patrícia Mendes", company: "Doceria da Pati", origin: "WHATSAPP" as const, status: "NOVO" as const, value: 6000, prob: 30, resp: bdrId },
    { name: "Fernando Lima", company: "Construtora Forte", origin: "EVENTO" as const, status: "REUNIAO_MARCADA" as const, value: 45000, prob: 50, resp: comercialId },
    { name: "Sandra Oliveira", company: "Estética Bella", origin: "SITE" as const, status: "GANHO" as const, value: 9000, prob: 100, resp: comercialId },
    { name: "Paulo Santos", company: "Mecânica do Paulo", origin: "COLD_CALL" as const, status: "PERDIDO" as const, value: 7000, prob: 0, resp: bdrId, loss: "Optou por concorrente mais barato." },
  ];
  for (const l of leadsSeed) {
    const lead = await prisma.lead.create({
      data: {
        name: l.name,
        company: l.company,
        origin: l.origin,
        status: l.status,
        estimatedValue: l.value,
        probability: l.prob,
        responsibleId: l.resp,
        email: `${l.name.split(" ")[0].toLowerCase()}@empresa.com.br`,
        phone: "(11) 98888-0000",
        expectedCloseDate: daysFromNow(20),
        lossReason: l.loss,
        tags: l.status === "NEGOCIACAO" ? ["quente", "prioridade"] : [],
      },
    });
    await prisma.leadInteraction.create({
      data: {
        leadId: lead.id,
        userId: l.resp,
        type: "LIGACAO",
        content: "Primeiro contato realizado. Cliente demonstrou interesse na solução.",
      },
    });
  }

  // ───────────── Contratos ─────────────
  const contractsSeed = [
    { clientIdx: 0, title: "Sistema de Agendamento + Site", type: "HIBRIDO" as const, total: 24000, monthly: 1500, status: "ATIVO" as const, catRec: "1.2" },
    { clientIdx: 1, title: "CRM Imobiliário + Tráfego", type: "RECORRENTE" as const, total: 0, monthly: 3200, status: "ATIVO" as const, catRec: "1.2" },
    { clientIdx: 3, title: "Portal do Aluno (Projeto)", type: "PROJETO_FECHADO" as const, total: 38000, monthly: 0, status: "ATIVO" as const, catRec: "1.1" },
    { clientIdx: 2, title: "Manutenção e Suporte", type: "SUPORTE" as const, total: 0, monthly: 900, status: "INADIMPLENTE" as const, catRec: "1.8" },
  ];
  const contracts: string[] = [];
  for (const ct of contractsSeed) {
    const rec = await prisma.contract.create({
      data: {
        clientId: clients[ct.clientIdx],
        title: ct.title,
        type: ct.type,
        totalValue: ct.total || null,
        monthlyValue: ct.monthly || null,
        status: ct.status,
        startDate: dayInMonth(3, 1),
        costCenterId: costCenters[2000],
        categoryId: categories[ct.catRec],
      },
    });
    contracts.push(rec.id);
  }

  // ───────────── Projetos ─────────────
  const projectsSeed = [
    { clientIdx: 0, contractIdx: 0, name: "App de Agendamento Vida Saudável", type: "APP" as const, status: "EM_ANDAMENTO" as const, budget: 18000, rate: 90 },
    { clientIdx: 1, contractIdx: 1, name: "CRM Horizonte", type: "SISTEMA" as const, status: "EM_ANDAMENTO" as const, budget: 30000, rate: 95 },
    { clientIdx: 3, contractIdx: 2, name: "Portal do Aluno", type: "SISTEMA" as const, status: "EM_REVISAO" as const, budget: 38000, rate: 100 },
    { clientIdx: 2, contractIdx: null, name: "Landing Page AutoCenter", type: "LANDING_PAGE" as const, status: "ENTREGUE" as const, budget: 4500, rate: 80 },
  ];
  const projects: string[] = [];
  for (const p of projectsSeed) {
    const rec = await prisma.project.create({
      data: {
        clientId: clients[p.clientIdx],
        contractId: p.contractIdx != null ? contracts[p.contractIdx] : null,
        name: p.name,
        type: p.type,
        status: p.status,
        budgetValue: p.budget,
        estimatedCost: p.budget * 0.5,
        hourlyRate: p.rate,
        startDate: dayInMonth(2, 1),
        deadline: daysFromNow(30),
        responsibleId: tiId,
        costCenterId: costCenters[4000],
      },
    });
    projects.push(rec.id);
  }

  // ───────────── Timesheet ─────────────
  const tsTypes = ["DESENVOLVIMENTO", "REUNIAO", "DESENVOLVIMENTO", "RETRABALHO", "DEPLOY"] as const;
  for (let i = 0; i < projects.length; i++) {
    for (let d = 0; d < 5; d++) {
      await prisma.timesheet.create({
        data: {
          userId: tiId,
          projectId: projects[i],
          date: dayInMonth(0, 1 + d * 3),
          hours: 4 + (d % 3),
          type: tsTypes[d],
          productive: tsTypes[d] !== "RETRABALHO",
          description: "Trabalho no projeto.",
        },
      });
    }
  }

  // ───────────── Lançamentos financeiros ─────────────
  for (let n = 0; n < 5; n++) {
    const comp = compOffset(n);
    const pay = dayInMonth(n, 10);
    // Receitas pagas
    await prisma.financialEntry.create({
      data: { description: "Mensalidade recorrente — Horizonte", type: "RECEITA", value: 3200, status: "PAGO", paymentDate: pay, dueDate: pay, ...comp, categoryId: categories["1.2"], costCenterId: costCenters[2000], clientId: clients[1], contractId: contracts[1], recurring: true, paymentMethod: "PIX" },
    });
    await prisma.financialEntry.create({
      data: { description: "Mensalidade — Vida Saudável", type: "RECEITA", value: 1500, status: "PAGO", paymentDate: pay, dueDate: pay, ...comp, categoryId: categories["1.2"], costCenterId: costCenters[2000], clientId: clients[0], contractId: contracts[0], recurring: true, paymentMethod: "BOLETO" },
    });
    if (n % 2 === 0) {
      await prisma.financialEntry.create({
        data: { description: "Desenvolvimento sob medida", type: "RECEITA", value: 9000 + n * 1500, status: "PAGO", paymentDate: pay, dueDate: pay, ...comp, categoryId: categories["1.1"], costCenterId: costCenters[2000] },
      });
    }
    // Despesas pagas
    await prisma.financialEntry.create({
      data: { description: "Servidores VPS/Cloud", type: "DESPESA", value: 850, status: "PAGO", paymentDate: pay, dueDate: pay, ...comp, categoryId: categories["2.2"], costCenterId: costCenters[4000], recurring: true, paymentMethod: "CARTAO_CREDITO" },
    });
    await prisma.financialEntry.create({
      data: { description: "Ferramentas e SaaS", type: "DESPESA", value: 620, status: "PAGO", paymentDate: pay, dueDate: pay, ...comp, categoryId: categories["2.4"], costCenterId: costCenters[4000], recurring: true },
    });
    await prisma.financialEntry.create({
      data: { description: "Comissão comercial", type: "DESPESA", value: 1200 + n * 200, status: "PAGO", paymentDate: pay, dueDate: pay, ...comp, categoryId: categories["2.1"], costCenterId: costCenters[2000] },
    });
    await prisma.financialEntry.create({
      data: { description: "Tráfego pago (Marketing)", type: "DESPESA", value: 1800, status: "PAGO", paymentDate: pay, dueDate: pay, ...comp, categoryId: categories["2.6"], costCenterId: costCenters[3000] },
    });
  }
  // Contas a receber (pendentes) e inadimplência
  const compNow = compOffset(0);
  await prisma.financialEntry.create({
    data: { description: "Setup de implantação — Futuro Brilhante", type: "RECEITA", value: 12000, status: "PENDENTE", dueDate: daysFromNow(12), ...compNow, categoryId: categories["1.5"], costCenterId: costCenters[2000], clientId: clients[3] },
  });
  await prisma.financialEntry.create({
    data: { description: "Suporte AutoCenter (vencido)", type: "RECEITA", value: 900, status: "ATRASADO", dueDate: daysFromNow(-8), ...compNow, categoryId: categories["1.8"], costCenterId: costCenters[2000], clientId: clients[2], contractId: contracts[3] },
  });
  // Contas a pagar (pendentes)
  await prisma.financialEntry.create({
    data: { description: "Impostos do mês", type: "DESPESA", value: 4200, status: "PENDENTE", dueDate: daysFromNow(10), ...compNow, categoryId: categories["2.10"], costCenterId: costCenters[1000] },
  });

  // ───────────── Campanhas ─────────────
  const campaignsSeed = [
    { name: "Black Friday — Sistemas", channel: "META_ADS" as const, budget: 5000, spend: 4800, leads: 42, clients: 6, revenue: 36000, status: "ENCERRADA" as const },
    { name: "Tráfego Google — Clínicas", channel: "GOOGLE_ADS" as const, budget: 3000, spend: 2600, leads: 28, clients: 3, revenue: 18000, status: "ATIVA" as const },
    { name: "Conteúdo Instagram", channel: "INSTAGRAM" as const, budget: 1500, spend: 900, leads: 15, clients: 1, revenue: 4500, status: "ATIVA" as const },
    { name: "Indicações Parceiros", channel: "INDICACAO" as const, budget: 0, spend: 0, leads: 9, clients: 4, revenue: 52000, status: "ATIVA" as const },
  ];
  for (const c of campaignsSeed) {
    await prisma.marketingCampaign.create({
      data: {
        name: c.name,
        channel: c.channel,
        budget: c.budget || null,
        actualSpend: c.spend || null,
        leadsGenerated: c.leads,
        clientsGenerated: c.clients,
        attributedRevenue: c.revenue,
        status: c.status,
        startDate: dayInMonth(2, 1),
        costCenterId: costCenters[3000],
      },
    });
  }

  // ───────────── Jurídico ─────────────
  const legal1 = await prisma.legalContract.create({
    data: { title: "Contrato de Prestação — Vida Saudável", type: "CLIENTE", status: "ASSINADO", clientId: clients[0], signatureDate: dayInMonth(3, 1), expirationDate: daysFromNow(300), responsibleId: users.JURIDICO },
  });
  await prisma.legalContract.create({
    data: { title: "NDA — Fornecedor de Cloud", type: "NDA", status: "EM_REVISAO", counterpartyName: "CloudProvider Inc.", responsibleId: users.JURIDICO },
  });
  await prisma.legalDeadline.create({
    data: { title: "Renovação contrato Vida Saudável", legalContractId: legal1.id, date: daysFromNow(25), priority: "ALTA", status: "PENDENTE", responsibleId: users.JURIDICO },
  });
  await prisma.legalDeadline.create({
    data: { title: "Revisar cláusulas NDA", date: daysFromNow(-3), priority: "MEDIA", status: "PENDENTE", responsibleId: users.JURIDICO },
  });

  // ───────────── Metas ─────────────
  const goalsSeed = [
    { title: "Receita do mês", type: "RECEITA" as const, unit: "REAIS" as const, target: 50000, current: 32000, status: "EM_RISCO" as const, cc: 1000 },
    { title: "Novos leads", type: "LEADS" as const, unit: "NUMERO" as const, target: 60, current: 41, status: "NO_PRAZO" as const, cc: 3000 },
    { title: "Vendas fechadas", type: "VENDAS" as const, unit: "NUMERO" as const, target: 10, current: 6, status: "NO_PRAZO" as const, cc: 2000 },
    { title: "Horas faturáveis", type: "OPERACIONAL" as const, unit: "HORAS" as const, target: 320, current: 280, status: "NO_PRAZO" as const, cc: 4000 },
  ];
  for (const g of goalsSeed) {
    await prisma.goal.create({
      data: {
        title: g.title,
        type: g.type,
        period: "MENSAL",
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        targetValue: g.target,
        currentValue: g.current,
        unit: g.unit,
        status: g.status,
        costCenterId: costCenters[g.cc],
        responsibleId: users.SOCIO_ADMIN,
      },
    });
  }

  // ───────────── Orçamentos por CC (mês atual) ─────────────
  const budgetSeed = [
    { cc: 1000, rev: 0, exp: 500 },
    { cc: 2000, rev: 10000, exp: 1500 },
    { cc: 3000, rev: 8000, exp: 2000 },
    { cc: 4000, rev: 15000, exp: 3000 },
    { cc: 5000, rev: 0, exp: 500 },
  ];
  for (const b of budgetSeed) {
    await prisma.budget.create({
      data: {
        costCenterId: costCenters[b.cc],
        periodType: "MENSAL",
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        plannedRevenue: b.rev,
        plannedExpense: b.exp,
        plannedProfit: b.rev - b.exp,
        status: "ATIVO",
        approvedById: users.SUPER_ADMIN,
        approvedAt: now,
      },
    });
    // orçamento trimestral simples (3x o mensal)
    await prisma.budget.create({
      data: {
        costCenterId: costCenters[b.cc],
        periodType: "TRIMESTRAL",
        quarter: Math.floor(now.getMonth() / 3) + 1,
        year: now.getFullYear(),
        plannedRevenue: b.rev * 3,
        plannedExpense: b.exp * 3,
        plannedProfit: (b.rev - b.exp) * 3,
        status: "APROVADO",
        approvedById: users.SUPER_ADMIN,
        approvedAt: now,
      },
    });
  }

  // ───────────── Tarefas ─────────────
  const moduleCC: Record<string, number> = {
    COMERCIAL: 2000, TI: 4000, FINANCEIRO: 1000, MARKETING: 3000,
    JURIDICO: 5000, LEADS: 2000, METAS: 1000, TAREFAS: 1000, DASHBOARD: 1000, GERAL: 1000,
  };
  const tasksSeed = [
    { title: "Enviar proposta para Construtora Forte", module: "COMERCIAL" as const, priority: "ALTA" as const, status: "A_FAZER" as const, due: 2, assignee: comercialId },
    { title: "Deploy do Portal do Aluno", module: "TI" as const, priority: "CRITICA" as const, status: "EM_ANDAMENTO" as const, due: 1, assignee: tiId },
    { title: "Conciliação bancária do mês", module: "FINANCEIRO" as const, priority: "MEDIA" as const, status: "A_FAZER" as const, due: -2, assignee: users.FINANCEIRO },
    { title: "Revisar criativos da campanha", module: "MARKETING" as const, priority: "MEDIA" as const, status: "A_FAZER" as const, due: 5, assignee: users.MARKETING },
    { title: "Assinar contrato Vida Saudável", module: "JURIDICO" as const, priority: "ALTA" as const, status: "CONCLUIDA" as const, due: -10, assignee: users.JURIDICO },
    { title: "Follow-up leads quentes", module: "LEADS" as const, priority: "ALTA" as const, status: "A_FAZER" as const, due: -1, assignee: bdrId },
    { title: "Planejar metas do trimestre", module: "METAS" as const, priority: "BAIXA" as const, status: "AGUARDANDO" as const, due: 9, assignee: users.SOCIO_ADMIN },
  ];
  for (const t of tasksSeed) {
    await prisma.task.create({
      data: {
        title: t.title,
        module: t.module,
        costCenterId: costCenters[moduleCC[t.module] ?? 1000],
        priority: t.priority,
        status: t.status,
        dueDate: daysFromNow(t.due),
        assigneeId: t.assignee,
        createdById: users.SUPER_ADMIN,
      },
    });
  }

  // ───────────── Aprovações de exemplo ─────────────
  await prisma.approvalRequest.create({
    data: { type: "DESPESA", requestedById: users.FINANCEIRO, status: "PENDENTE", entityType: "FinancialEntry", entityId: "exemplo", amount: 7200, reason: "Despesa acima do limite de R$ 5.000 (exemplo)" },
  });
  await prisma.approvalRequest.create({
    data: { type: "ORCAMENTO", requestedById: users.COMERCIAL, status: "PENDENTE", entityType: "Budget", entityId: "exemplo", amount: 10000, reason: "Aprovação de orçamento comercial (exemplo)" },
  });

  console.log("✅ Seed concluído com sucesso.");
  console.log(`   Login: admin@${EMAIL_DOMAIN} (senha = SEED_ADMIN_PASSWORD)`);
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
