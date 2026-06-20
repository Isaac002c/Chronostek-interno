# Chronostek · Sistema Interno

CRM/ERP modular interno da Chronostek com **gestão por Centro de Custo** — financeiro, comercial, marketing, inovação/TI, jurídico, metas e tarefas em um único painel, com orçamento, real×orçado, dados reais, RBAC e dashboards.

Stack: **Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL · Tailwind · Auth.js v5 · Zod · Recharts**.

## 🚀 Publicar na VPS (Docker, banco interno)

O projeto já vem com `Dockerfile` + `docker-compose.yml` (Postgres **interno**, sem expor porta; só o app na 8080) e `deploy/remote-setup.sh`. Para publicar na VPS (chave SSH já provisionada):

```powershell
$src="<CAMINHO_DO_PROJETO>"; $key="<SUA_CHAVE_SSH>"; $vps="root@<VPS_IP>"; $tgz="$env:TEMP\chrono.tgz"
tar -czf $tgz -C $src --exclude=node_modules --exclude=.next --exclude=.git --exclude=.vercel --exclude=.env .
scp -i $key -o StrictHostKeyChecking=accept-new $tgz "${vps}:/tmp/chrono.tgz"
ssh -i $key -o StrictHostKeyChecking=accept-new $vps "rm -rf /opt/chronostek && mkdir -p /opt/chronostek && tar -xzf /tmp/chrono.tgz -C /opt/chronostek && bash /opt/chronostek/deploy/remote-setup.sh && ufw allow 8080/tcp"
```

Acesso: **http://<VPS_IP>:8080**. As credenciais iniciais são geradas pelo seed (veja a seção 5).
Para HTTPS (cookies seguros), aponte um domínio para a VPS e coloque um proxy TLS (Caddy/Nginx) na frente — o app já confia no host (`AUTH_TRUST_HOST`).

---

## 1. Requisitos

- Node.js 18.18+ (testado em Node 24)
- Um banco PostgreSQL — recomendado [Neon](https://neon.tech)

## 2. Variáveis de ambiente

Crie um arquivo `.env` na raiz (já existe um gerado em dev; veja `.env.example`):

```env
# Connection string do PostgreSQL/Neon
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"

# Segredo das sessões JWT (Auth.js). Gere com: npx auth secret
AUTH_SECRET="um-segredo-forte-aqui"

# Opcional em produção:
# AUTH_URL="https://interno.chronostek.com.br"
```

## 3. Rodar localmente

```bash
npm install            # instala deps + gera o Prisma Client (postinstall)
npm run db:push        # cria as tabelas no banco a partir do schema
npm run db:seed        # popula dados iniciais (admin, centros de custo, exemplos)
npm run dev            # http://localhost:3000
```

### Build de produção

```bash
npm run build          # prisma generate + next build
npm start
```

## 4. Migrations / Seed

| Comando | O que faz |
| --- | --- |
| `npm run db:push` | Sincroniza o schema com o banco (sem histórico de migration — ideal p/ MVP) |
| `npm run db:migrate` | Cria uma migration versionada (`prisma migrate dev`) |
| `npm run db:seed` | Roda `prisma/seed.ts` (idempotente na parte de referência) |
| `npm run db:studio` | Abre o Prisma Studio |
| `npm run db:reset` | **Apaga** o banco e re-aplica migrations + seed |

## 5. Credenciais de acesso (seed)

O seed cria 8 usuários, um por perfil: `SUPER_ADMIN`, `SOCIO_ADMIN`, `FINANCEIRO`, `COMERCIAL`, `MARKETING`, `TI`, `JURIDICO`, `BDR` (e-mails `*@chronostek.com.br`). A senha inicial de todos vem da variável de ambiente **`SEED_ADMIN_PASSWORD`** — defina-a antes de rodar `npm run db:seed`.

> ⚠️ Defina `SEED_ADMIN_PASSWORD` e troque as senhas após o primeiro acesso.

## 6. Estrutura

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

## 7. Módulos

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

## 8. RBAC (perfis)

`SUPER_ADMIN` e `SOCIO_ADMIN` acessam tudo. Demais perfis têm módulos restritos
(ver `src/lib/rbac.ts`). `VIEWER` é somente leitura. `BDR` vê apenas os próprios
leads e tarefas. A navegação e as ações de escrita são filtradas por perfil.

## 9. O que falta para produção

- **Senhas/seed**: trocar senhas padrão; remover dados de exemplo.
- **Migrations versionadas**: migrar de `db push` para `prisma migrate` no deploy.
- **Decimal para dinheiro**: hoje os valores monetários são `Float` (escolha de
  MVP pela serialização limpa nos gráficos). Para contabilidade fiscal, migrar
  para `Decimal`/inteiro em centavos.
- **Paginação** nas listagens (hoje `take: 100/200`).
- **Auditoria**: o modelo `AuditLog` existe no schema mas ainda não é gravado.
- **Fase CC — pendências**: UI de **aprovações** (`ApprovalRequest` já no schema), tornar `costCenterId` obrigatório (hoje opcional + herança), categorias financeiras vinculadas a CC na UI, e bloco "Real × Orçado consolidado" no dashboard geral (já existe na página dedicada e por CC).
- **Permissões por linha** mais finas além do BDR.
- **Testes** automatizados (unit/e2e) e CI.
- **Rate limiting / 2FA** no login; política de senha forte.
- **Observabilidade** (logs estruturados, Sentry) e backups do banco.

## 10. Próxima fase recomendada

1. Recálculo automático de metas (ex.: meta de receita lê o financeiro).
2. Importação de leads (CSV) e webhooks de formulários do site.
3. Notificações de tarefas/prazos vencendo (e-mail/WhatsApp).
4. Relatórios exportáveis (PDF/Excel) do DRE e do fluxo de caixa.
5. Auditoria efetiva e histórico de alterações por entidade.
