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
    echo "AUTH_URL=${AUTH_URL:-http://localhost:8080}"
  } > .env
  chmod 600 .env
  echo ".env gerado"
fi

echo "== docker compose up --build (pode levar alguns minutos) =="
docker compose up -d --build

echo "== aguardando Postgres =="
for i in $(seq 1 40); do
  if docker compose exec -T db pg_isready -U postgres -d chronostek >/dev/null 2>&1; then echo "db pronto"; break; fi
  sleep 2
done

echo "== criando schema (prisma db push) =="
docker compose exec -T web npx prisma db push --skip-generate --accept-data-loss

echo "== seed =="
docker compose exec -T web npx prisma db seed || echo "seed: provavelmente ja populado"

docker compose ps
echo ""
echo "OK -> aplicacao no ar na porta 8080"
echo "login: admin@${SEED_EMAIL_DOMAIN:-telun.com.br} (senha definida via SEED_ADMIN_PASSWORD)"
echo "(se nao abrir externamente, rode: ufw allow 8080/tcp)"
