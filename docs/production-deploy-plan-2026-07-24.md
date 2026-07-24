# Plano controlado de produção — 2026-07-24

## Objetivo e regra de segurança

Publicar a revisão `605e059598b45f355482a8f2ef5ccefa59d37087` (mais o health
check operacional desta preparação) sem perder nem recriar os dados existentes.
O banco PostgreSQL e os arquivos persistentes atuais são fontes de verdade.

São proibidos neste procedimento: `prisma migrate reset`, recriação do banco,
`DROP`, `TRUNCATE`, limpeza de volume e execução de seed na produção.

## Inventário confirmado

### Aplicação

- Repositório: `Isaac002c/Chronostek-interno`.
- Branch auditada: `feat/telun-rebrand-financeiro`.
- Arquitetura: uma aplicação Next.js full-stack. Páginas, Auth.js, Server
  Actions e Prisma executam no mesmo processo; não há backend HTTP separado.
- Revisão pública anterior: `a025a14bf0c6f6b6b90cd9bb6d40097049745c30`.
- Domínio público: `chronoshub.chronostek.com.br`, atendido pela Vercel.
- Instância de contingência na VPS: container `chronostek-web`, porta 8080.

### VPS

- Host: `chronostek-prod-01`, Ubuntu 26.04 LTS.
- Compose atual: `/opt/chronostek/docker-compose.yml` e
  `/opt/chronostek/docker-compose.override.yml`.
- Imagem atual de rollback:
  `sha256:68689f7e281c8edfe0a537dd1a4d52266cac562a4bfe0c26b404449d00819b3b`.
- Serviços de outros produtos compartilham o host e estão fora do escopo.

### Banco e persistência

- PostgreSQL 16.14, database `chronostek`, volume
  `chronostek_chronostek_pgdata`.
- Banco real identificado: 35 tabelas, aproximadamente 11 MB.
- Contagens de referência: 12 usuários, 17 clientes, 41 leads, 15 contratos,
  5 projetos, 40 tarefas, 71 lançamentos financeiros e 126 eventos de auditoria.
- A tabela `_prisma_migrations` ainda não existe.
- O schema existente corresponde à migration baseline
  `00000000000000_init`.
- O volume `chronostek-backend-uploads` contém arquivos e será preservado,
  embora não esteja montado no container web atual.

## Validação do artefato

- `npm test`: 48/48.
- `npm run test:auth`: 14/14.
- `npm run test:finance`: 10/10.
- TypeScript, lint e build de produção: aprovados.
- `npm audit`: zero vulnerabilidades conhecidas.

## Risco bloqueador de rede

O PostgreSQL está publicado na Internet, aceita conexões em todas as interfaces
e não usa TLS. A aplicação pública da Vercel depende hoje dessa exposição.
Fechar a porta antes de oferecer uma rota privada ou uma origem estática
permitida quebraria a produção.

A promoção pública só será considerada pronta quando uma destas opções estiver
implantada e testada:

1. Vercel com egress estático/Secure Compute, firewall restrito à origem e TLS
   no PostgreSQL; ou
2. aplicação full-stack executada na VPS, com PostgreSQL apenas na rede Docker
   e domínio/reverse proxy apontado para a VPS; ou
3. proxy de banco autenticado, criptografado e restrito, aprovado como
   componente permanente.

Até lá, é permitido preparar e validar artefatos, backups, restore, migrations
em cópia isolada e preview; não é permitido declarar a produção segura.

## Sequência de execução

1. Criar dump PostgreSQL em formato custom, checksum SHA-256 e inventário.
2. Arquivar os arquivos persistentes e as configurações operacionais atuais,
   com permissões restritas.
3. Manter duas cópias do conjunto de backup fora do volume do banco.
4. Restaurar o dump em um PostgreSQL 16 descartável e isolado.
5. Comparar contagens e objetos principais antes de qualquer migration.
6. Registrar `00000000000000_init` como aplicada somente na cópia.
7. Aplicar as três migrations incrementais na cópia e repetir as contagens.
8. Construir uma imagem imutável da revisão-alvo e executar smoke tests contra
   a cópia restaurada.
9. Somente após o ensaio, repetir baseline + migrations no banco real, sem seed.
10. Publicar preview, validar health/auth/rotas críticas e promover o mesmo
    artefato.
11. Observar logs, saúde, autenticação e integridade das contagens após a troca.

## Critérios de aceite

- Dump restaurável e checksum conferido.
- Contagens de referência preservadas após as migrations.
- `prisma migrate status` sem migrations pendentes.
- `/api/health` retorna 200 e confirma acesso ao banco sem expor detalhes.
- Login e páginas críticas funcionam com sessão real.
- Nenhum erro crítico novo nos logs.
- Porta do PostgreSQL não fica aberta indiscriminadamente na Internet.
- Rollback da aplicação e do banco está documentado e executável.

## Rollback

### Aplicação

- Vercel: promover novamente o deployment
  `dpl_3ET3VqvtEMbqUtGi4W2hK6Sh2NTf`.
- VPS: recriar `chronostek-web` com a imagem preservada pelo digest acima e as
  configurações arquivadas.

### Banco

As migrations desta versão são aditivas. Em falha de aplicação, a primeira
opção é reverter somente o artefato, mantendo as novas colunas/tabelas
compatíveis. Restore do banco só deve ocorrer se houver corrupção ou alteração
de dados comprovada, pois ele descarta gravações posteriores ao backup. Nesse
caso:

1. interromper escritores;
2. gerar um dump de emergência do estado defeituoso;
3. restaurar o dump pré-deploy em um banco novo;
4. validar contagens e autenticação;
5. trocar a conexão de forma atômica;
6. manter o banco anterior intacto até a confirmação final.

## Pendências após a publicação

- Automatizar backup diário com retenção, cópia externa e teste periódico de
  restore.
- Remover a publicação direta das portas PostgreSQL da VPS.
- Formalizar monitoramento de disponibilidade, erros, capacidade e expiração
  de certificados.
- Planejar a migração de valores monetários de `Float` para `Decimal` ou
  centavos inteiros antes de uso fiscal/contábil.
