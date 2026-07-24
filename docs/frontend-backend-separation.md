# Separação Vercel → API VPS da Telun

Atualizado em: 2026-07-24

## Estado real

A produção ainda usa, de forma transitória, o rewrite global da Vercel para
`api-interno.chronostek.com.br`. Nesse modo a Vercel não executa Prisma nem
recebe segredos, mas a renderização Next.js ainda acontece na VPS. Esse estado
é seguro para os dados, porém **não é a separação visual final**.

O destino aprovado é:

```text
Navegador
  ├─ interface → https://chronoshub.chronostek.com.br (Vercel)
  └─ HTTPS/JSON → https://api.chronostek.com.br (VPS)
                    ├─ Auth.js / RBAC / auditoria
                    ├─ APIs de negócio e jobs
                    └─ PostgreSQL privado na rede Docker
```

Critérios obrigatórios para remover o modo transitório:

1. `api.chronostek.com.br` deve existir no DNS, resolver para a VPS e possuir
   certificado válido;
2. todos os módulos visuais devem deixar de depender de Server Components,
   Server Actions e imports Prisma no runtime Vercel;
3. login, renovação de sessão e logout cross-origin devem passar usando cookie
   `Secure`, `HttpOnly`, `SameSite=Lax` e `Domain=.chronostek.com.br`;
4. toda autorização deve continuar sendo aplicada na API, nunca somente no
   frontend;
5. smoke autenticado deve cobrir cada módulo antes da promoção do alias.

## Fronteira implementada nesta revisão

O calendário novo já usa a fronteira HTTP no navegador:

- `CalendarClient` renderiza e mantém o estado visual;
- `apiRequest` usa `NEXT_PUBLIC_API_BASE_URL` e
  `credentials: "include"`;
- `/api/calendar/*` implementa consulta unificada, CRUD, recorrência,
  participantes, lembretes, tipos, histórico e conflitos;
- `/api/integrations/google/calendar/*` implementa OAuth, seleção de
  calendário, sincronização, webhook e desconexão;
- tokens e sync tokens permanecem somente no backend;
- o worker executa somente na VPS.

Os demais módulos ainda contêm Server Components/Server Actions com Prisma.
Portanto, trocar agora o rewrite global por um frontend estático reduziria
funcionalidades e não é permitido.

## Sessão no destino final

Backend:

```text
AUTH_URL=https://api.chronostek.com.br
AUTH_COOKIE_DOMAIN=.chronostek.com.br
PUBLIC_FRONTEND_URL=https://chronoshub.chronostek.com.br
```

Frontend:

```text
NEXT_PUBLIC_API_BASE_URL=https://api.chronostek.com.br
```

O Nginx permite CORS somente para
`https://chronoshub.chronostek.com.br`, responde preflight sem encaminhar ao
Next.js e inclui `Access-Control-Allow-Credentials: true`. O domínio oficial da
API publica apenas `/api/*`; páginas visuais retornam 404.

## Dados e segredos

- PostgreSQL permanece sem porta publicada.
- `DATABASE_URL`, `AUTH_SECRET`, credenciais Google, chave de criptografia,
  senha do banco e credenciais da VPS nunca entram na Vercel.
- O frontend recebe apenas `NEXT_PUBLIC_API_BASE_URL`.
- Migrations e worker rodam na VPS.
- Nenhum seed é executado em produção.

## Plano de conversão restante

Converter um módulo por vez:

1. expor loaders/mutações como endpoints JSON autenticados;
2. mover a interface para componentes cliente que usam `apiRequest`;
3. testar RBAC/ownership no endpoint;
4. provar ausência de Prisma e Server Actions no pacote Vercel;
5. repetir para dashboard, comercial, financeiro, projetos/TI, marketing,
   jurídico, metas, tarefas e configurações;
6. gerar um deployment preview frontend-only;
7. executar smoke autenticado completo;
8. promover o alias somente com paridade.

## Cutover final

1. Criar o registro DNS `api.chronostek.com.br`.
2. Emitir o certificado e habilitar `deploy/nginx/api.conf`.
3. Configurar as variáveis privadas somente na VPS.
4. Validar health, CORS, Auth.js e APIs diretamente no domínio novo.
5. Implantar o frontend-only em preview na Vercel.
6. Testar todos os módulos e perfis de acesso.
7. Promover o frontend e remover o rewrite global.
8. Remover da Vercel qualquer variável que não seja pública.
9. Manter o deployment proxy anterior disponível durante a janela de
   observação.

## Rollback

- Vercel: promover o deployment proxy anterior.
- Backend: reativar a imagem anterior preservada.
- Nginx: restaurar o vhost anterior após `nginx -t`.
- Banco: manter as migrations aditivas; não executar downgrade destrutivo.
- Restore só deve ocorrer a partir de dump ensaiado, mediante corrupção
  confirmada e janela aprovada.
