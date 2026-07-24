#!/usr/bin/env sh
set -eu

FRONTEND="https://chronoshub.chronostek.com.br"
BACKEND="https://api-interno.chronostek.com.br"

printf '%s\n' \
  "web_image=$(docker inspect telun-web --format '{{.Config.Image}}')" \
  "web_running=$(docker inspect telun-web --format '{{.State.Running}}')" \
  "web_restart=$(docker inspect telun-web --format '{{.HostConfig.RestartPolicy.Name}}')" \
  "web_ports=$(docker inspect telun-web --format '{{json .HostConfig.PortBindings}}')" \
  "worker_image=$(docker inspect telun-calendar-worker --format '{{.Config.Image}}')" \
  "worker_running=$(docker inspect telun-calendar-worker --format '{{.State.Running}}')" \
  "worker_restart=$(docker inspect telun-calendar-worker --format '{{.HostConfig.RestartPolicy.Name}}')" \
  "rollback_running=$(docker inspect telun-web-rollback-5950172-calendar-20260724 --format '{{.State.Running}}')" \
  "rollback_image=$(docker inspect telun-web-rollback-5950172-calendar-20260724 --format '{{.Config.Image}}')" \
  "db_ports=$(docker inspect chronostek-db --format '{{json .HostConfig.PortBindings}}')"

health="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    "$BACKEND/api/health"
)"
calendar="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    "$BACKEND/api/calendar/events"
)"
google_status="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    "$BACKEND/api/integrations/google/calendar/status"
)"
webhook_invalid="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    --request POST "$BACKEND/api/integrations/google/calendar/webhook"
)"
frontend_login="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    "$FRONTEND/login"
)"
cors_preflight="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    --request OPTIONS \
    --header "Origin: $FRONTEND" \
    --header 'Access-Control-Request-Method: GET' \
    "$BACKEND/api/calendar/events"
)"
cors_allowed="$(
  curl --silent --include \
    --request OPTIONS \
    --header "Origin: $FRONTEND" \
    --header 'Access-Control-Request-Method: GET' \
    "$BACKEND/api/calendar/events" |
    tr -d '\r' |
    awk -F ': ' 'tolower($1) == "access-control-allow-origin" { print $2; exit }'
)"
cors_forbidden="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    --header 'Origin: https://example.invalid' \
    "$BACKEND/api/health"
)"

test "$health" = 200
test "$calendar" = 401
test "$google_status" = 401
test "$webhook_invalid" = 400
test "$frontend_login" = 200
test "$cors_preflight" = 204
test "$cors_allowed" = "$FRONTEND"
test "$cors_forbidden" = 403

google_keys="$(
  docker exec telun-web sh -c \
    "env | cut -d= -f1 | grep -E '^(GOOGLE_CALENDAR_|CALENDAR_TOKEN_ENCRYPTION_KEY)' || true"
)"
critical_logs="$(
  {
    docker logs --since 15m telun-web 2>&1
    docker logs --since 15m telun-calendar-worker 2>&1
  } |
    grep -E -i 'panic|fatal|unhandled|migration failed|prisma[^[:space:]]* error' ||
    true
)"

printf '%s\n' \
  "health=$health" \
  "calendar_unauthenticated=$calendar" \
  "google_status_unauthenticated=$google_status" \
  "webhook_invalid=$webhook_invalid" \
  "frontend_login=$frontend_login" \
  "cors_preflight=$cors_preflight" \
  "cors_allowed=$cors_allowed" \
  "cors_forbidden=$cors_forbidden" \
  "google_configuration_keys_present=$(printf '%s' "$google_keys" | grep -c . || true)" \
  "critical_log_lines=$(printf '%s' "$critical_logs" | grep -c . || true)"

if getent hosts api.chronostek.com.br >/dev/null 2>&1; then
  echo "official_api_dns=present"
else
  echo "official_api_dns=absent"
fi

echo | openssl s_client \
  -servername api-interno.chronostek.com.br \
  -connect api-interno.chronostek.com.br:443 2>/dev/null |
  openssl x509 -noout -subject -dates
