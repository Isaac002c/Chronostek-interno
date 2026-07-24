# Calendário Telun e Google Calendar

## Estado e limites

O evento canônico pertence ao Telun (`CalendarEvent`). O identificador externo
do Google nunca substitui o identificador interno: a associação fica em
`CalendarExternalMapping`. Essa decisão permite desconectar uma conta, trocar
o calendário selecionado e manter auditoria sem quebrar referências internas.

A migração `20260724210000_calendar_google_integration` é aditiva. Ela:

- preserva as tabelas legadas `CalendarEvent` e
  `CalendarEventParticipant`;
- amplia os enums existentes com `ADD VALUE IF NOT EXISTS`;
- torna `userId` do participante opcional para aceitar convidados externos;
- cria recorrências, lembretes, tipos visuais, integrações, mapeamentos,
  conflitos, canais de notificação, histórico e fila persistente;
- não apaga eventos, participantes ou qualquer dado operacional.

## Segurança OAuth

Fluxo adotado: OAuth 2.0 Authorization Code para aplicação web, com PKCE,
`state` aleatório de uso único e `access_type=offline`.

Escopos mínimos:

- `openid`
- `email`
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`

Access token, refresh token, sync token e verificador PKCE usam envelope
AES-256-GCM autenticado. O banco armazena apenas o envelope; o `state` e o
token do canal de webhook são armazenados como SHA-256. Nenhum desses valores
deve aparecer em logs, auditoria ou resposta de status.

Variáveis obrigatórias:

```text
GOOGLE_CALENDAR_CLIENT_ID
GOOGLE_CALENDAR_CLIENT_SECRET
GOOGLE_CALENDAR_REDIRECT_URI
GOOGLE_CALENDAR_WEBHOOK_URL
CALENDAR_TOKEN_ENCRYPTION_KEY
PUBLIC_FRONTEND_URL
```

Valores públicos planejados:

```text
GOOGLE_CALENDAR_REDIRECT_URI=https://api.chronostek.com.br/api/integrations/google/calendar/oauth/callback
GOOGLE_CALENDAR_WEBHOOK_URL=https://api.chronostek.com.br/api/integrations/google/calendar/webhook
PUBLIC_FRONTEND_URL=https://chronoshub.chronostek.com.br
```

No Google Cloud Console, habilitar a Google Calendar API, configurar a tela de
consentimento e cadastrar exatamente a URI de callback. Não cadastrar curingas.

## Sincronização e conflitos

O fluxo inicial busca todos os eventos e guarda `nextSyncToken`. As execuções
seguintes usam sincronização incremental. Um `410 Gone` invalida apenas o
`syncToken` da integração e inicia uma nova carga completa controlada; dados do
Telun não são limpos.

Alterações Telun geram jobs idempotentes `PUSH_EVENT`/`DELETE_EVENT`. Alterações
Google chegam por webhook e geram `INCREMENTAL_SYNC`; o webhook só valida os
cabeçalhos do canal, persiste o job e retorna rapidamente.

Se a versão local avançou depois do último push e o `etag` Google também mudou,
o sistema cria `CalendarSyncConflict`. Nenhum lado é sobrescrito
silenciosamente. A resolução permite manter Telun, manter Google ou mesclar os
campos principais.

Canais `events.watch` expiram. O worker agenda renovação quando não há canal
ativo ou quando faltam menos de 48 horas, criando o canal novo antes de marcar
o anterior como substituído.

## Worker

Execução única para diagnóstico:

```bash
npm run calendar:worker -- --once
```

Processamento em lote:

```bash
npm run calendar:worker -- --max=100
```

Em produção, executar um contêiner separado da mesma imagem, na mesma rede e
com o mesmo arquivo de ambiente do backend. Reinício recomendado:
`unless-stopped`. O worker deve repetir o comando em intervalo curto (30–60 s).
Falhas usam backoff exponencial e param após o limite persistido no job.

## Domínios e sessão

Frontend: `https://chronoshub.chronostek.com.br`.

API: `https://api.chronostek.com.br`.

Para frontend e API em subdomínios separados:

```text
AUTH_URL=https://api.chronostek.com.br
AUTH_COOKIE_DOMAIN=.chronostek.com.br
NEXT_PUBLIC_API_BASE_URL=https://api.chronostek.com.br
```

O frontend usa `fetch(..., { credentials: "include" })`. A API permite CORS
somente para a origem exata do frontend e aceita credenciais. O PostgreSQL
continua privado na rede Docker, sem porta publicada.

## Operação e rollback

Antes de migrar:

1. dump completo PostgreSQL;
2. cópia da configuração/imagem/identificador do contêiner ativo;
3. restauração do dump em banco isolado;
4. aplicação da migração no banco restaurado;
5. validação de contagens de `CalendarEvent` e
   `CalendarEventParticipant`.

Rollback de aplicação: reativar a imagem anterior e manter as tabelas/colunas
novas, pois são aditivas. Não executar migração inversa destrutiva. Se for
necessário restaurar banco, usar somente o dump verificado e uma janela de
manutenção aprovada.
