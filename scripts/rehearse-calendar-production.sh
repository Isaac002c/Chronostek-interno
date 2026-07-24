#!/usr/bin/env sh
set -eu

RELEASE="${1:?informe a revisão candidata}"
BACKUP_DUMP="${2:?informe o dump}"
SHORT="$(printf '%s' "$RELEASE" | cut -c1-7)"
NETWORK="telun-calendar-rehearsal-net-$SHORT"
VOLUME="telun-calendar-rehearsal-pgdata-$SHORT"
DB_CONTAINER="telun-calendar-rehearsal-db-$SHORT"
WEB_CONTAINER="telun-calendar-rehearsal-web-$SHORT"
DATABASE_URL="postgresql://postgres:calendar_rehearsal@$DB_CONTAINER:5432/chronostek"

test -f "$BACKUP_DUMP"
test -z "$(docker ps -aq --filter "name=^/$DB_CONTAINER$")"
test -z "$(docker ps -aq --filter "name=^/$WEB_CONTAINER$")"
if docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  echo "O volume de rehearsal já existe: $VOLUME" >&2
  exit 1
fi
if docker network inspect "$NETWORK" >/dev/null 2>&1; then
  echo "A rede de rehearsal já existe: $NETWORK" >&2
  exit 1
fi

on_error() {
  docker stop "$WEB_CONTAINER" >/dev/null 2>&1 || true
  docker stop "$DB_CONTAINER" >/dev/null 2>&1 || true
}
trap on_error INT TERM HUP

docker network create "$NETWORK" >/dev/null
docker volume create "$VOLUME" >/dev/null
docker run -d \
  --name "$DB_CONTAINER" \
  --network "$NETWORK" \
  -e POSTGRES_PASSWORD=calendar_rehearsal \
  -e POSTGRES_DB=chronostek \
  -v "$VOLUME:/var/lib/postgresql/data" \
  postgres:16 >/dev/null

ready=false
for _attempt in $(seq 1 45); do
  if docker exec "$DB_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
test "$ready" = true

docker exec -i "$DB_CONTAINER" \
  pg_restore -U postgres -d chronostek --no-owner --no-acl --exit-on-error \
  < "$BACKUP_DUMP"

counts() {
  docker exec "$DB_CONTAINER" psql -U postgres -d chronostek -At -F ':' -c '
    SELECT
      (SELECT count(*) FROM "User"),
      (SELECT count(*) FROM "Client"),
      (SELECT count(*) FROM "Contract"),
      (SELECT count(*) FROM "FinancialEntry"),
      (SELECT count(*) FROM "AuditLog"),
      (SELECT count(*) FROM "CalendarEvent"),
      (SELECT count(*) FROM "CalendarEventParticipant");
  '
}

before="$(counts)"
docker run --rm \
  --network "$NETWORK" \
  -e DATABASE_URL="$DATABASE_URL" \
  "telun-web:$RELEASE" \
  npm run db:deploy
after="$(counts)"
test "$before" = "$after"

orphan_count="$(
  docker exec "$DB_CONTAINER" psql -U postgres -d chronostek -Atc '
    SELECT
      (SELECT count(*) FROM "CalendarEventParticipant" p LEFT JOIN "CalendarEvent" e ON e.id = p."eventId" WHERE e.id IS NULL)
      +
      (SELECT count(*) FROM "CalendarEvent" e LEFT JOIN "User" u ON u.id = e."createdById" WHERE e."createdById" IS NOT NULL AND u.id IS NULL);
  '
)"
test "$orphan_count" = 0

docker run -d \
  --name "$WEB_CONTAINER" \
  --network "$NETWORK" \
  -p 127.0.0.1:18086:3000 \
  --env-file /opt/chronostek/.env \
  -e DATABASE_URL="$DATABASE_URL" \
  -e AUTH_URL=http://127.0.0.1:18086 \
  "telun-web:$RELEASE" >/dev/null

healthy=false
for _attempt in $(seq 1 45); do
  if curl --fail --silent http://127.0.0.1:18086/api/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 1
done
if test "$healthy" != true; then
  docker logs --tail 100 "$WEB_CONTAINER"
  exit 1
fi

calendar_unauthenticated="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    http://127.0.0.1:18086/api/calendar/events
)"
test "$calendar_unauthenticated" = 401

docker stop "$WEB_CONTAINER" >/dev/null
docker stop "$DB_CONTAINER" >/dev/null
printf '%s\n' \
  "rehearsal_ok release=$RELEASE" \
  "counts_before=$before" \
  "counts_after=$after" \
  "orphan_count=$orphan_count" \
  "calendar_unauthenticated=$calendar_unauthenticated" \
  "retained_volume=$VOLUME" \
  "stopped_web=$WEB_CONTAINER" \
  "stopped_db=$DB_CONTAINER"
