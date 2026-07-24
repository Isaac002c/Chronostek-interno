#!/usr/bin/env sh
set -eu

IMAGE="${1:?informe a imagem candidata}"
SUFFIX="${2:-calendar-candidate}"
NETWORK="telun-calendar-runtime-net-$SUFFIX"
DB_CONTAINER="telun-calendar-runtime-db-$SUFFIX"
WEB_CONTAINER="telun-calendar-runtime-web-$SUFFIX"
DATABASE_URL="postgresql://postgres:calendar_test@$DB_CONTAINER:5432/calendar_runtime_test"

cleanup() {
  docker container rm --force "$WEB_CONTAINER" >/dev/null 2>&1 || true
  docker container rm --force "$DB_CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

cleanup
docker network create "$NETWORK" >/dev/null
docker run --rm -d \
  --name "$DB_CONTAINER" \
  --network "$NETWORK" \
  --tmpfs /var/lib/postgresql/data:rw,size=512m \
  -e POSTGRES_PASSWORD=calendar_test \
  -e POSTGRES_DB=calendar_runtime_test \
  postgres:16-alpine >/dev/null

ready=false
for _attempt in $(seq 1 30); do
  if docker exec "$DB_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
test "$ready" = true

docker run --rm \
  --network "$NETWORK" \
  -e DATABASE_URL="$DATABASE_URL" \
  -e ALLOW_CALENDAR_DB_TEST=true \
  "$IMAGE" \
  sh -c 'npm run db:deploy && npm run test:calendar:db'

docker run --rm -d \
  --name "$WEB_CONTAINER" \
  --network "$NETWORK" \
  -p 127.0.0.1:18085:3000 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e AUTH_SECRET=calendar-runtime-test-secret-not-production \
  -e AUTH_TRUST_HOST=true \
  "$IMAGE" >/dev/null

healthy=false
for _attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:18085/api/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 1
done
if test "$healthy" != true; then
  docker logs --tail 100 "$WEB_CONTAINER"
  exit 1
fi

unauthenticated_status="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    http://127.0.0.1:18085/api/calendar/events
)"
invalid_webhook_status="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    --request POST http://127.0.0.1:18085/api/integrations/google/calendar/webhook
)"
calendar_tables="$(
  docker exec -e PGPASSWORD=calendar_test "$DB_CONTAINER" \
    psql -U postgres -d calendar_runtime_test -Atc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'Calendar%';"
)"

test "$unauthenticated_status" = 401
test "$invalid_webhook_status" = 400
printf '%s\n' \
  "candidate_runtime_ok image=$IMAGE calendar_tables=$calendar_tables unauthenticated=$unauthenticated_status webhook_invalid=$invalid_webhook_status"
