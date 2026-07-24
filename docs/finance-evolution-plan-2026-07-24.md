# Evolução do Financeiro — recorrências, mês a mês, projeções e DRE

Atualizado em: 2026-07-24

## Estado de partida

- O produto é single-tenant e executa integralmente na VPS; a Vercel é um
  proxy externo sem Prisma ou `DATABASE_URL`.
- O PostgreSQL real permanece no volume `chronostek_chronostek_pgdata`, sem
  porta publicada.
- A produção iniciou esta fase com 72 lançamentos financeiros, nenhuma série
  recorrente, nenhuma conta bancária e nenhum fornecedor.
- Já existem `FinancialEntry`, `RecurringEntry`, `FinancialCategory`,
  `BankAccount`, `Supplier`, orçamento, fechamento mensal, auditoria e regras
  financeiras puras.

## Estratégia

Esta fase é aditiva e reutiliza as entidades existentes:

1. `RecurringEntry` passa a representar a série; `FinancialEntry` continua
   representando cada ocorrência.
2. Cada ocorrência recebe chave idempotente e número sequencial únicos dentro
   da série.
3. Criação da série e das ocorrências ocorre em uma única transação.
4. Edições e cancelamentos exigem alcance explícito: ocorrência, futuras ou
   série inteira. Itens liquidados são protegidos.
5. Projeções manuais são persistidas em cenário, linhas, valores mensais e
   histórico. Valor manual nunca é sobrescrito por recálculo automático.
6. A DRE configurável usa modelos versionados, linhas hierárquicas, mapeamentos
   e fórmulas declarativas; nenhuma expressão JavaScript é armazenada ou
   executada.
7. O “Mês a Mês” agrega os doze meses em uma única consulta por ano e suporta
   caixa ou competência.
8. As permissões financeiras são validadas no backend por capacidade, além do
   acesso ao módulo.

## Compatibilidade e dados

- Nenhuma tabela, coluna ou enum existente será removido.
- Campos novos são opcionais ou possuem default seguro.
- Os 72 lançamentos atuais não serão vinculados retroativamente a séries.
- Valores permanecem em `Float` nesta migration para evitar uma conversão
  monetária destrutiva misturada ao novo domínio. A migração para `Decimal`
  continua sendo trabalho separado.
- O campo `tenantId` das novas entidades recebe `default`, preparando isolamento
  futuro sem alterar o modelo single-tenant atual.

## Ordem de validação

1. regras puras e schema;
2. migration em PostgreSQL descartável vazio;
3. restore do dump de produção em cópia isolada;
4. migration na cópia, testes integrados e comparação de contagens;
5. imagem candidata e smoke contra a cópia;
6. novo backup de produção;
7. migration aditiva real;
8. promoção do mesmo artefato;
9. smoke e observação de logs.

## Rollback

- A aplicação anterior permanece disponível como imagem/container.
- As tabelas e colunas novas são compatíveis com a versão anterior e podem
  permanecer após rollback do código.
- Não existe rollback automático de dados.
- Restore só é permitido após corrupção confirmada, com escritores parados e
  dump de emergência do estado atual.
