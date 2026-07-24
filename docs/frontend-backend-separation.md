# Separação Vercel → VPS da Telun

Atualizado em: 2026-07-24

## Decisão

Foi escolhida a alternativa controlada de proxy/BFF:

```text
Navegador
  → https://chronoshub.chronostek.com.br
  → rewrite externo na Vercel
  → https://api-interno.chronostek.com.br
  → Nginx
  → telun-web:3000
  → chronostek-db:5432 (rede Docker privada)
```

O endereço visível e a origem do navegador continuam sendo `chronoshub`. A
Vercel atua como edge/proxy e não executa o monólito. O processo Next.js
full-stack executa exclusivamente na VPS.

## Motivo

O sistema atual não possui uma divisão frontend/backend:

- 99 arquivos executam consultas Prisma;
- 24 módulos expõem Server Actions;
- Server Components consultam o banco durante a renderização;
- Auth.js valida credenciais, rate limit e status do usuário no PostgreSQL;
- sessão, RBAC, ownership, auditoria e transações são compartilhados pelo
  monólito.

Transformar todos esses fluxos em endpoints HTTP e reimplementar a camada
cliente seria uma reescrita extensa e de maior risco para o deploy atual. O
proxy externo é suportado nativamente pela Vercel e preserva as fronteiras de
segurança já testadas.

## Contrato da Vercel

O deployment da Vercel contém somente:

- `vercel.json`;
- `vercel-proxy/index.html`.

Configurações obrigatórias:

- `framework: null`;
- instalação de dependências desativada;
- nenhum build Next.js;
- nenhum Vercel Function;
- rewrite global para `api-interno.chronostek.com.br`;
- cache desativado explicitamente em `/api/*`.

Consequentemente, a Vercel não recebe nem utiliza:

- `DATABASE_URL`;
- senha do PostgreSQL;
- `AUTH_SECRET`;
- credenciais da VPS;
- variáveis de seed.

Não é necessário `NEXT_PUBLIC_API_URL`, pois o navegador usa a mesma origem
`chronoshub` para páginas, assets, Auth.js e Server Actions.

## Backend e autenticação

O container `telun-web` é a fonte oficial de:

- páginas e componentes renderizados;
- Auth.js e cookies de sessão;
- Server Actions;
- Prisma e PostgreSQL;
- RBAC e ownership;
- auditoria e rate limiting;
- módulos comercial, financeiro, jurídico, metas e tarefas.

`AUTH_URL` aponta para `https://chronoshub.chronostek.com.br`. Os cookies
continuam host-only, `Secure`, `HttpOnly` e `SameSite=Lax`: embora a resposta
seja gerada na VPS, o navegador a recebe da origem `chronoshub`.

O Nginx deverá normalizar `Host`, `X-Forwarded-Host` e
`X-Forwarded-Proto` para a origem pública, permitir somente o Origin
`https://chronoshub.chronostek.com.br` quando houver CORS e encaminhar a
identidade de rede de forma compatível com a cadeia Vercel → Cloudflare → VPS.

## Dados e persistência

- O banco real permanece `chronostek`.
- O volume real permanece `chronostek_chronostek_pgdata`.
- As quatro migrations já aplicadas não serão repetidas.
- Nenhum seed será executado.
- Uploads e configurações permanecem preservados nos backups pré-deploy.

## Cutover

1. Validar o artefato proxy localmente.
2. Endurecer e persistir somente o vhost Telun no Nginx.
3. Validar o backend por HTTPS e Host público.
4. Criar deployment preview da Vercel sem variáveis privadas.
5. Testar login, refresh, logout, Server Actions, RBAC e módulos críticos.
6. Promover o deployment da Vercel.
7. Remover da Vercel `DATABASE_URL`, `AUTH_SECRET` e demais variáveis privadas.
8. Parar o container web antigo.
9. Recriar somente o container PostgreSQL sem publicação de porta, preservando
   o mesmo volume.
10. Remover as liberações públicas de 5432 e 8080.
11. Ativar o proxy Cloudflare somente após validar o certificado da origem.
12. Restringir o tráfego da origem à Cloudflare depois da confirmação ponta a
    ponta.

## Rollback

- Frontend/proxy: promover novamente o deployment Vercel anterior.
- Backend: apontar o vhost para a imagem anterior preservada.
- Nginx: restaurar a cópia pré-cutover do vhost e executar `nginx -t`.
- Banco: não executar rollback automático. As migrations são aditivas; restore
  só é permitido mediante corrupção confirmada e janela aprovada.

O container e a porta antigos só serão removidos depois do smoke autenticado do
proxy, para manter rollback rápido durante a troca.
