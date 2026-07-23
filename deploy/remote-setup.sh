#!/usr/bin/env bash
# Provisiona a Telun (sistema interno) na VPS de forma ISOLADA:
#  - Postgres em container SEM publicar porta (apenas rede interna do compose)
#  - App web exposto na porta 8080
# Rode a partir de /opt/telun (o comando de publicação já faz isso).
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  {
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
    echo "AUTH_SECRET=$(openssl rand -base64 32 | tr -d '\n')"
    echo "SEED_ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')"
    echo "SEED_EMAIL_DOMAIN=${SEED_EMAIL_DOMAIN:-telun.com.br}"
    echo "AUTH_URL=${AUTH_URL:-http://localhost:8080}"
  } > .env
  chmod 600 .env
  echo ".env gerado"
fi

if ! grep -q '^SEED_ADMIN_PASSWORD=.\{12,\}$' .env; then
  seed_password="$(openssl rand -base64 24 | tr -d '\n')"
  if grep -q '^SEED_ADMIN_PASSWORD=' .env; then
    sed -i "s|^SEED_ADMIN_PASSWORD=.*$|SEED_ADMIN_PASSWORD=${seed_password}|" .env
  else
    echo "SEED_ADMIN_PASSWORD=${seed_password}" >> .env
  fi
  unset seed_password
  echo "Senha inicial forte configurada no .env"
fi
if ! grep -q '^SEED_EMAIL_DOMAIN=' .env; then
  echo "SEED_EMAIL_DOMAIN=${SEED_EMAIL_DOMAIN:-telun.com.br}" >> .env
fi
chmod 600 .env

echo "== docker compose up --build (pode levar alguns minutos) =="
docker compose up -d --build

echo "== aguardando Postgres =="
for i in $(seq 1 40); do
  if docker compose exec -T db pg_isready -U postgres -d chronostek >/dev/null 2>&1; then echo "db pronto"; break; fi
  sleep 2
done

echo "== aplicando migrations (prisma migrate deploy) =="
# Migrations versionadas (corrige o drift de schema que quebrava telas).
# Banco PRÉ-EXISTENTE (criado por 'db push' antes das migrations) precisa de
# baseline UMA vez antes do primeiro deploy:
#   docker compose exec -T web npx prisma migrate resolve --applied 00000000000000_init
if ! docker compose exec -T web npx prisma migrate deploy; then
  echo "!! migrate deploy falhou."
  echo "   Se este banco já existia (criado por db push), rode o baseline UMA vez:"
  echo "   docker compose exec -T web npx prisma migrate resolve --applied 00000000000000_init"
  echo "   e execute o deploy novamente."
  exit 1
fi

echo "== seed =="
docker compose exec -T web npx prisma db seed

docker compose ps
echo ""
echo "OK -> aplicacao no ar na porta 8080"
seed_email_domain="$(sed -n 's/^SEED_EMAIL_DOMAIN=//p' .env | tail -n 1)"
echo "login: admin@${seed_email_domain:-telun.com.br} (senha definida via SEED_ADMIN_PASSWORD)"
unset seed_email_domain
echo "credencial inicial armazenada em /opt/telun/.env (permissao 600); troque-a apos o primeiro acesso"
echo "(se nao abrir externamente, rode: ufw allow 8080/tcp)"
