# Telun · Sistema Interno

Plataforma interna modular da **Telun** com **gestão por Centro de Custo** — financeiro, comercial, projetos e tecnologia, marketing, jurídico, metas e tarefas em um único painel, com orçamento, real×orçado, dados reais, RBAC e dashboards.

> **Rebranding:** o produto foi renomeado de Chronostek para **Telun**. A marca exibida é sempre Telun; razão social e nome fantasia são dados jurídicos configuráveis. O **nome do banco de dados** permanece `chronostek` de propósito, para preservar os dados existentes (renomear exigiria dump+restore).

Stack: **Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL · Tailwind · Auth.js v5 · Zod · Recharts**.

## 🚀 Publicar na VPS (Docker, banco interno)

O projeto já vem com `Dockerfile` + `docker-compose.yml` (Postgres **interno**, sem expor porta; só o app na 8080) e `deploy/remote-setup.sh`. Para publicar na VPS (chave SSH já provisionada):

```powershell
$src="<CAMINHO_DO_PROJETO>"; $key="<SUA_CHAVE_SSH>"; $vps="root@<VPS_IP>"; $tgz="$env:TEMP\telun.tgz"
tar -czf $tgz -C $src --exclude=node_modules --exclude=.next --exclude=.git --exclude=.vercel --exclude=.env .
scp -i $key -o StrictHostKeyChecking=accept-new $tgz "${vps}:/tmp/telun.tgz"
ssh -i $key -o StrictHostKeyChecking=accept-new $vps "rm -rf /opt/telun && mkdir -p /opt/telun && tar -xzf /tmp/telun.tgz -C /opt/telun && bash /opt/telun/deploy/remote-setup.sh && ufw allow 8080/tcp"
```

Acesso: **http://<VPS_IP>:8080**. As credenciais iniciais são geradas pelo seed (veja a seção 5).
Para HTTPS (cookies seguros), aponte um domínio para a VPS e coloque um proxy TLS (Caddy/Nginx) na frente — o app já confia no host (`AUTH_TRUST_HOST`).

---

## 1. Requisitos

- Node.js 20.9+ (testado em Node 24)
- Um banco PostgreSQL — recomendado [Neon](https://neon.tech)

## 2. Variáveis de ambiente

Crie um arquivo `.env` na raiz (já existe um gerado em dev; veja `.env.example`):

```env
# Connection string do PostgreSQL/Neon
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"

# Segredo das sessões JWT (Auth.js). Gere com: npx auth secret
AUTH_SECRET="um-segredo-forte-aqui"

# Senha inicial forte (mínimo de 12 caracteres) para os usuários de referência
SEED_ADMIN_PASSWORD="gere-uma-senha-unica-e-forte"

# Produção:
# AUTH_URL="https://interno.telun.com.br"
# AUTH_TRUST_HOST="true" # apenas atrás de proxy confiável

# Dados fictícios são opt-in e devem ficar desativados em produção
SEED_DEMO_DATA="false"
```

## 3. Rodar localmente

```bash
npm install            # instala deps + gera o Prisma Client (postinstall)
npm run db:deploy      # aplica as migrations versionadas
npm run db:seed        # cria referências e usuários iniciais
npm run dev            # http://localhost:3000
```

### Build de produção

```bash
npm run build          # prisma generate + next build
npm start
```

## 4. Migrations / Seed

> **Migrations versionadas (correção do drift de schema).** O projeto passou a
> usar `prisma migrate` em vez de `db push` no deploy. Isso corrige a causa raiz
> das telas que exibiam "Não foi possível carregar" — colunas novas do schema
> que não existiam no banco por o deploy nunca ter aplicado as alterações.
>
> **Banco NOVO** (vazio): `npm run db:deploy` cria tudo (baseline + migrations).
>
> **Banco JÁ EXISTENTE** (criado anteriormente por `db push`): rode o baseline
> **uma única vez** para o Prisma marcar o schema atual como aplicado, depois siga
> com `db:deploy`:
> ```bash
> npm run db:baseline    # prisma migrate resolve --applied 00000000000000_init
> npm run db:deploy      # aplica migrations pendentes (ex.: novos models do Financeiro)
> ```

| Comando | O que faz |
| --- | --- |
| `npm run db:deploy` | **Produção**: aplica migrations pendentes (`prisma migrate deploy`) |
| `npm run db:baseline` | Marca o schema atual como aplicado (banco pré-existente, roda 1×) |
| `npm run db:migrate` | **Dev**: cria uma migration versionada (`prisma migrate dev`) |
| `npm run db:push` | Sincroniza schema sem histórico (só p/ protótipo local rápido) |
| `npm run db:seed` | Roda `prisma/seed.ts` (idempotente e sem dados fictícios por padrão) |
| `npm run db:studio` | Abre o Prisma Studio |
| `npm run db:reset` | **Apaga** o banco e re-aplica migrations + seed |

## 5. Credenciais de acesso (seed)

O seed cria 8 usuários, um por perfil: `SUPER_ADMIN`, `SOCIO_ADMIN`, `FINANCEIRO`, `COMERCIAL`, `MARKETING`, `TI`, `JURIDICO`, `BDR` (e-mails `*@telun.com.br`, ou o domínio definido em **`SEED_EMAIL_DOMAIN`**). A senha inicial de todos vem da variável de ambiente **`SEED_ADMIN_PASSWORD`**, que deve ter ao menos 12 caracteres. Defina-a antes de rodar `npm run db:seed`.

> ⚠️ Defina uma senha única e forte, proteja o arquivo `.env` e troque as senhas após o primeiro acesso. O seed nunca reativa, promove ou troca a senha de usuários já existentes. Para popular dados fictícios somente em desenvolvimento, use `SEED_DEMO_DATA=true`.

## 6. Validação

```bash
npm run lint
npm test
npm run test:finance
npm run build
npm audit
```

O teste integrado exige um PostgreSQL **descartável e exclusivo**, pois cria e
remove registros dentro de uma transação:

```bash
ALLOW_INTEGRATION_TESTS=true npm run test:integration
```

## 7. Estrutura

```
prisma/
  schema.prisma        # 18 modelos + enums
  seed.ts              # dados iniciais
src/
  auth.ts              # Auth.js v5 (Credentials + bcrypt)
  auth.config.ts       # config edge-safe (middleware)
  middleware.ts        # proteção de /dashboard
  lib/
    prisma.ts  rbac.ts  session.ts  enums.ts  format.ts
    actions.ts  options.ts  metrics.ts  finance.ts
  components/
    ui/        # button, card, table, badge, select, stat-card...
    form/      # field, submit-button, delete-button, action-button
    charts/    # gráficos Recharts (dashboard + financeiro)
    shell/     # app-shell (sidebar + topbar + user menu)
  app/
    login/                       # tela de login
    dashboard/                   # layout protegido + dashboard
      leads/  comercial/  financeiro/  ti/
      marketing/  juridico/  metas/  tarefas/  configuracoes/
```

## 8. Módulos

| Módulo | CRUD | Destaques |
| --- | --- | --- |
| Dashboard | — | 12 KPIs + 5 gráficos (receita×despesa, leads, pipeline, centro de custo, margem) |
| Leads / CRM | ✅ | Filtros, interações, conversão em cliente, tarefas vinculadas |
| Comercial | ✅ | Clientes (health score), propostas, contratos (MRR/ARR) |
| Financeiro | ✅ | Competência, lançamentos, DRE mensal, fluxo de caixa, contas a pagar/receber |
| Inovação/TI | ✅ | Projetos (custo real/margem por horas), timesheet, retrabalho |
| Marketing | ✅ | Campanhas, CAC, ROI por canal |
| Jurídico | ✅ | Contratos jurídicos, NDAs, prazos com alerta de atraso |
| Metas | ✅ | Progresso por período/centro de custo |
| Tarefas | ✅ | Polimórficas, filtros, conclusão rápida, atrasadas no dashboard |
| Config/Usuários | ✅ | RBAC, criação de usuários, perfis |
| **Centros de Custo** | ✅ | CRUD (tipo, responsável, hierarquia, orçamento padrão) + dashboard por CC com abas (visão geral, orçamento, financeiro, metas, tarefas) |
| **Orçamentos** | ✅ | Budget mensal/trimestral/anual por CC, fluxo rascunho→aprovado→ativo→encerrado |
| **Real × Orçado** | ✅ | Variação R$/% por CC e categoria, gráfico, alertas de estouro/queda |
| **Metas (auto)** | ✅ | Cálculo automático (receita, despesa, lucro, MRR/ARR, leads, vendas, horas, projetos, prazos jurídicos…) + recalcular |
| **Jurídico completo** | ✅ | Contratos, prazos, **documentos, demandas, riscos** (prob×impacto) + dashboard com KPIs (CC 5000) |

### Gestão por Centro de Custo
Centros oficiais: **1000** Financeiro · **2000** Comercial · **3000** Marketing · **4000** Inovação/TI · **5000** Jurídico. Cada CC tem responsável, orçamento (mensal/trimestral/anual), receitas/despesas por competência, metas, tarefas e dashboard próprio. Lançamentos, contratos, propostas, campanhas, projetos e tarefas carregam `costCenterId`.

## 9. RBAC (perfis)

`SUPER_ADMIN` e `SOCIO_ADMIN` acessam tudo. Demais perfis têm módulos restritos
(ver `src/lib/rbac.ts`). `VIEWER` é somente leitura. `BDR` vê apenas os próprios
leads e tarefas. A navegação e as ações de escrita são filtradas por perfil.

## 10. O que falta para produção

- **Operação de credenciais**: rotacionar senhas iniciais e segredos, restringir o
  `.env` e formalizar o processo de recuperação de conta.
- **Decimal para dinheiro**: hoje os valores monetários são `Float` (escolha de
  MVP pela serialização limpa nos gráficos). Para contabilidade fiscal, migrar
  para `Decimal`/inteiro em centavos.
- **Paginação** nas listagens (hoje `take: 100/200`).
- **Auditoria**: o modelo `AuditLog` existe no schema mas ainda não é gravado.
- **Fase CC — pendências**: UI de **aprovações** (`ApprovalRequest` já no schema), tornar `costCenterId` obrigatório (hoje opcional + herança), categorias financeiras vinculadas a CC na UI, e bloco "Real × Orçado consolidado" no dashboard geral (já existe na página dedicada e por CC).
- **Permissões por linha** mais finas além do BDR.
- **Cobertura E2E e CI**: existem testes puros e um smoke integrado transacional,
  mas ainda falta uma suíte E2E contínua.
- **Rate limiting / 2FA** no login.
- **Observabilidade** (logs estruturados, Sentry) e backups do banco.

## 11. Próxima fase recomendada

1. Recálculo automático de metas (ex.: meta de receita lê o financeiro).
2. Importação de leads (CSV) e webhooks de formulários do site.
3. Notificações de tarefas/prazos vencendo (e-mail/WhatsApp).
4. Relatórios exportáveis (PDF/Excel) do DRE e do fluxo de caixa.
5. Auditoria efetiva e histórico de alterações por entidade.
