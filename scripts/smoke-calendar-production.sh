#!/usr/bin/env sh
set -eu

BASE_URL="${1:-https://chronoshub.chronostek.com.br}"
MARKER="$(date -u +%Y%m%d%H%M%S)-$$"
EMAIL="calendar-smoke-$MARKER@example.invalid"
PASSWORD="$(openssl rand -hex 24)"
COOKIE_JAR="/tmp/telun-calendar-smoke-$MARKER.cookies"
BODY_FILE="/tmp/telun-calendar-smoke-$MARKER.json"
EVENT_ID=""

delete_user() {
  docker exec \
    -e SMOKE_EMAIL="$EMAIL" \
    -e SMOKE_EVENT_ID="$EVENT_ID" \
    telun-web node -e '
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    (async () => {
      const user = await prisma.user.findUnique({
        where: { email: process.env.SMOKE_EMAIL },
        select: { id: true },
      });
      if (user) {
        if (process.env.SMOKE_EVENT_ID) {
          await prisma.calendarEvent.deleteMany({
            where: { id: process.env.SMOKE_EVENT_ID },
          });
        }
        await prisma.auditLog.deleteMany({
          where: {
            OR: [
              { userId: user.id },
              { entityId: process.env.SMOKE_EVENT_ID || "__none__" },
            ],
          },
        });
        await prisma.user.delete({ where: { id: user.id } });
      }
    })().finally(() => prisma.$disconnect());
  ' >/dev/null 2>&1 || true
}

cleanup() {
  delete_user
  rm -f "$COOKIE_JAR" "$BODY_FILE"
}
trap cleanup EXIT INT TERM HUP

docker exec \
  -e SMOKE_EMAIL="$EMAIL" \
  -e SMOKE_PASSWORD="$PASSWORD" \
  telun-web node -e '
    const { PrismaClient } = require("@prisma/client");
    const bcrypt = require("bcryptjs");
    const prisma = new PrismaClient();
    (async () => {
      const passwordHash = await bcrypt.hash(process.env.SMOKE_PASSWORD, 12);
      await prisma.user.create({
        data: {
          name: "Calendar Production Smoke",
          email: process.env.SMOKE_EMAIL,
          passwordHash,
          role: "SUPER_ADMIN",
          status: "ATIVO",
        },
      });
    })().finally(() => prisma.$disconnect());
  '

csrf="$(
  curl --fail --silent \
    --cookie-jar "$COOKIE_JAR" \
    "$BASE_URL/api/auth/csrf" |
    sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p'
)"
test -n "$csrf"

login_status="$(
  curl --silent --output "$BODY_FILE" --write-out '%{http_code}' \
    --cookie "$COOKIE_JAR" \
    --cookie-jar "$COOKIE_JAR" \
    --request POST \
    --header 'Content-Type: application/x-www-form-urlencoded' \
    --header 'X-Auth-Return-Redirect: 1' \
    --data-urlencode "csrfToken=$csrf" \
    --data-urlencode "email=$EMAIL" \
    --data-urlencode "password=$PASSWORD" \
    --data-urlencode "callbackUrl=$BASE_URL/dashboard" \
    "$BASE_URL/api/auth/callback/credentials"
)"
test "$login_status" = 200
if grep -q '"error"' "$BODY_FILE"; then
  echo "Login de smoke recusado." >&2
  exit 1
fi

session_status="$(
  curl --silent --output "$BODY_FILE" --write-out '%{http_code}' \
    --cookie "$COOKIE_JAR" "$BASE_URL/api/auth/session"
)"
test "$session_status" = 200
grep -q "$EMAIL" "$BODY_FILE"

metadata_status="$(
  curl --silent --output "$BODY_FILE" --write-out '%{http_code}' \
    --cookie "$COOKIE_JAR" "$BASE_URL/api/calendar/metadata"
)"
test "$metadata_status" = 200

list_status="$(
  curl --silent --output "$BODY_FILE" --write-out '%{http_code}' \
    --cookie "$COOKIE_JAR" \
    "$BASE_URL/api/calendar/events?from=2026-07-01T00%3A00%3A00.000Z&to=2026-08-31T23%3A59%3A59.999Z"
)"
test "$list_status" = 200

create_status="$(
  curl --silent --output "$BODY_FILE" --write-out '%{http_code}' \
    --cookie "$COOKIE_JAR" \
    --request POST \
    --header 'Content-Type: application/json' \
    --data "{
      \"title\":\"Smoke calendário $MARKER\",
      \"startAt\":\"2026-08-03T12:00:00.000Z\",
      \"endAt\":\"2026-08-03T13:00:00.000Z\",
      \"timezone\":\"America/Sao_Paulo\",
      \"participants\":[{\"email\":\"external-smoke@example.invalid\",\"kind\":\"EXTERNO\"}],
      \"reminders\":[{\"amount\":15,\"unit\":\"MINUTOS\"}]
    }" \
    "$BASE_URL/api/calendar/events"
)"
test "$create_status" = 201
EVENT_ID="$(sed -n 's/.*"events":\[{"id":"\([^"]*\)".*/\1/p' "$BODY_FILE")"
test -n "$EVENT_ID"

history_status="$(
  curl --silent --output "$BODY_FILE" --write-out '%{http_code}' \
    --cookie "$COOKIE_JAR" \
    "$BASE_URL/api/calendar/events/$EVENT_ID/history"
)"
test "$history_status" = 200

delete_status="$(
  curl --silent --output "$BODY_FILE" --write-out '%{http_code}' \
    --cookie "$COOKIE_JAR" \
    --request DELETE \
    "$BASE_URL/api/calendar/events/$EVENT_ID?scope=current"
)"
test "$delete_status" = 200

calendar_page_status="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    --cookie "$COOKIE_JAR" "$BASE_URL/dashboard/calendario"
)"
test "$calendar_page_status" = 200

printf '%s\n' \
  "authenticated_smoke_ok" \
  "login=$login_status session=$session_status metadata=$metadata_status list=$list_status" \
  "create=$create_status history=$history_status delete=$delete_status page=$calendar_page_status"
