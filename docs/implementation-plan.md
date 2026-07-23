# Plano de implementação e auditoria

Atualizado em: 2026-07-23

Branch auditada: `feat/telun-rebrand-financeiro`

## Escopo recebido

O anexo recebido contém o protocolo de auditoria e execução, mas termina em
"siga integralmente o restante do escopo abaixo" sem trazer requisitos
funcionais adicionais. Por isso, o repositório, o `README.md` e o
`RELATORIO-TELUN.md` foram usados como fonte de verdade desta rodada.

Status da rodada: **implementação e validação concluídas**. A aplicação está
tecnicamente pronta para homologação/deploy, condicionada aos pré-requisitos
operacionais descritos em "Riscos residuais".

## Diagnóstico

- Next.js 15 com App Router e Server Actions, Auth.js v5/JWT e Prisma/PostgreSQL.
- Produto single-tenant: o schema não possui `tenantId`.
- Módulos ativos: dashboard, leads/CRM, comercial, financeiro, projetos/TI,
  marketing, jurídico, metas/planejamento, tarefas e configurações.
- O baseline compilava e os testes puros passavam, mas havia vulnerabilidades
  transitivas, autorização de escrita apenas global, falhas de ownership para
  BDR, visibilidade incompleta de metas, seed inseguro e avisos de lint.
- O smoke test autenticado encontrou ainda uma falha de runtime não detectada
  pelo build: páginas com `Button` retornavam 500 porque o componente que usa
  Radix não declarava a fronteira Client Component.

## Implementação concluída

### Dependências e configuração

- Next.js/Auth.js/React e dependências compatíveis atualizados dentro da linha
  arquitetural existente.
- `npm audit` corrigido para zero vulnerabilidades conhecidas.
- Configuração do seed movida do campo depreciado de `package.json` para
  `prisma.config.ts`.
- Cabeçalhos de segurança, remoção de `X-Powered-By`, sessão de oito horas e
  `trustHost` explícito por ambiente.

### Autorização e isolamento por registro

- Toda Server Action de domínio exige sessão ativa, permissão de escrita e
  acesso ao módulo correspondente.
- A sessão JWT é revalidada contra o usuário ativo no banco a cada requisição;
  desativação, exclusão e troca de papel têm efeito imediato.
- BDR consulta e altera somente os próprios leads e tarefas, inclusive em
  detalhes, edição, interações, conversão e conclusão/exclusão.
- Conversão de lead em cliente é transacional e faz o claim condicional do lead,
  evitando dupla conversão concorrente.
- Metas aplicam o mesmo filtro de visibilidade em listas, detalhes, edição,
  mutações, opções e vínculo de meta-pai.
- Metas anuais/trimestrais e períodos estratégicos são administrados somente por
  `SUPER_ADMIN`/`SOCIO_ADMIN`.
- `VIEWER` permanece estritamente somente leitura.
- O último `SUPER_ADMIN` ativo não pode ser removido, desativado ou rebaixado.

### Seed e deploy

- `SEED_ADMIN_PASSWORD` é obrigatória, tem mínimo de 12 caracteres e usa bcrypt
  com custo 12.
- Reexecução do seed não reativa, promove ou troca senha de usuários existentes,
  nem sobrescreve responsáveis já configurados.
- Dados transacionais fictícios são opt-in com `SEED_DEMO_DATA=true`; o padrão
  de produção é `false`.
- O setup remoto gera segredos fortes, protege `.env` com modo 600 e falha caso
  migrations ou seed falhem.
- Compose repassa explicitamente as variáveis do seed.

### Qualidade e runtime

- Sete avisos de código não usado removidos.
- Matriz de RBAC/ownership adicionada aos testes de metas.
- Smoke integrado transacional adicionado em `scripts/test-integration.ts`, com
  trava explícita para banco descartável e rollback deliberado.
- `Button` marcado como Client Component, eliminando os 500 observados em
  páginas autenticadas.
- README atualizado com Node mínimo, migrations, seed seguro e comandos de
  validação.

## Evidências de validação

| Verificação | Resultado |
| --- | --- |
| `npx prisma validate` | aprovado |
| Migrations em PostgreSQL descartável | 2/2 aplicadas em banco vazio |
| Seed inicial | aprovado |
| Reexecução segura do seed | usuário desativado não foi reativado/promovido; dados demo não duplicaram |
| `npm run test:integration` | CRUD, relações, transação e rollback aprovados |
| `npm test` | 48/48 |
| `npm run test:finance` | 10/10 |
| `npx tsc --noEmit` | aprovado |
| `npm run lint` | zero erros e zero avisos |
| `npm audit --audit-level=low` | zero vulnerabilidades |
| `npm run build` | build de produção aprovado |
| Smoke autenticado | login e dashboard aprovados |
| Rotas críticas autenticadas | dashboard, leads, financeiro, metas, tarefas e usuários responderam 200 |
| Ownership BDR | lead alheio e edição de tarefa alheia responderam 404 |
| Módulo negado ao BDR | Financeiro redirecionou para `/dashboard` |
| `git diff --check` | aprovado |

O navegador embutido não conseguiu anexar uma webview nesta sessão. Para não
deixar o runtime sem validação, o smoke foi executado por HTTP real contra o
servidor Next.js, incluindo CSRF, login por credenciais, cookie de sessão,
renderização autenticada e verificações de autorização.

## Migrations

Nenhuma migration foi criada ou alterada nesta rodada. As migrations existentes
foram aplicadas, na ordem, a um PostgreSQL descartável iniciado do zero.

## Riscos residuais e pré-requisitos de produção

- O PostgreSQL configurado no `.env` local continua indisponível em
  `127.0.0.1:5433`; a validação de banco usou uma instância descartável.
- A senha de seed do `.env` local existente não atende ao novo mínimo. Ela não
  foi modificada silenciosamente; deve ser rotacionada antes do próximo seed.
- O deploy público exige domínio, HTTPS/reverse proxy confiável, firewall,
  backup testado e monitoramento.
- Rate limiting/2FA, observabilidade estruturada, paginação ampla e cobertura
  E2E contínua continuam como evolução de produção.
- Valores monetários ainda usam `Float`; contabilidade fiscal deve migrar para
  `Decimal` ou inteiro em centavos mediante migration planejada.
- O modelo `AuditLog` existe, mas a cobertura de auditoria ainda não engloba
  todas as entidades e mutações.

## Próximos passos recomendados

1. Rotacionar `SEED_ADMIN_PASSWORD` e validar `AUTH_URL`/TLS no ambiente real.
2. Fazer backup e executar `npm run db:deploy` no PostgreSQL de homologação.
3. Rodar `SEED_DEMO_DATA=false npm run db:seed` e trocar as credenciais iniciais.
4. Repetir o smoke autenticado em homologação e validar restore de backup.
5. Só então promover a mesma imagem para produção.
