#!/usr/bin/env sh
set -eu

RELEASE="${1:?informe a revisão candidata}"
CURRENT="telun-web"
IMAGE="telun-web:$RELEASE"
SHORT="$(printf '%s' "$RELEASE" | cut -c1-7)"
PREVIEW="telun-calendar-preview-$SHORT"
ROLLBACK="telun-web-rollback-5950172-calendar-20260724"
WORKER="telun-calendar-worker"
NETWORK="chronostek_chronostek"
ENV_FILE="/root/telun-runtime-$RELEASE.env"
NGINX_CONTAINER="despachante-nginx"

test -z "$(docker ps -aq --filter "name=^/$PREVIEW$")"
test -z "$(docker ps -aq --filter "name=^/$ROLLBACK$")"
docker inspect "$CURRENT" >/dev/null
docker image inspect "$IMAGE" >/dev/null

docker inspect "$CURRENT" \
  --format '{{range .Config.Env}}{{println .}}{{end}}' > "$ENV_FILE"
chmod 600 "$ENV_FILE"

cleanup_env() {
  rm -f "$ENV_FILE"
}
trap cleanup_env EXIT INT TERM HUP

docker run -d \
  --name "$PREVIEW" \
  --network "$NETWORK" \
  -p 127.0.0.1:18087:3000 \
  --env-file "$ENV_FILE" \
  --label org.opencontainers.image.revision="$RELEASE" \
  --label telun.purpose=calendar-preview \
  --restart unless-stopped \
  "$IMAGE" >/dev/null

preview_ready=false
for _attempt in $(seq 1 45); do
  if curl --fail --silent http://127.0.0.1:18087/api/health >/dev/null; then
    preview_ready=true
    break
  fi
  sleep 1
done
if test "$preview_ready" != true; then
  docker logs --tail 100 "$PREVIEW"
  exit 1
fi

preview_calendar_status="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    http://127.0.0.1:18087/api/calendar/events
)"
preview_google_status="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    http://127.0.0.1:18087/api/integrations/google/calendar/status
)"
test "$preview_calendar_status" = 401
test "$preview_google_status" = 401

docker stop "$PREVIEW" >/dev/null
docker container rm "$PREVIEW" >/dev/null

rollback() {
  docker stop "$CURRENT" >/dev/null 2>&1 || true
  docker container rm "$CURRENT" >/dev/null 2>&1 || true
  if docker inspect "$ROLLBACK" >/dev/null 2>&1; then
    docker rename "$ROLLBACK" "$CURRENT"
    docker update --restart unless-stopped "$CURRENT" >/dev/null
    docker start "$CURRENT" >/dev/null
    docker exec "$NGINX_CONTAINER" nginx -s reload >/dev/null 2>&1 || true
  fi
}

docker update --restart=no "$CURRENT" >/dev/null
docker stop "$CURRENT" >/dev/null
docker rename "$CURRENT" "$ROLLBACK"

if ! docker run -d \
  --name "$CURRENT" \
  --network "$NETWORK" \
  -p 127.0.0.1:18084:3000 \
  --env-file "$ENV_FILE" \
  --label org.opencontainers.image.revision="$RELEASE" \
  --label telun.purpose=production-candidate \
  --label telun.release=20260724-calendar-google \
  --restart unless-stopped \
  "$IMAGE" >/dev/null; then
  rollback
  exit 1
fi

final_ready=false
for _attempt in $(seq 1 45); do
  if curl --fail --silent http://127.0.0.1:18084/api/health >/dev/null; then
    final_ready=true
    break
  fi
  sleep 1
done
if test "$final_ready" != true; then
  docker logs --tail 100 "$CURRENT"
  rollback
  exit 1
fi

docker exec "$NGINX_CONTAINER" nginx -t
docker exec "$NGINX_CONTAINER" nginx -s reload

public_health="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    https://api-interno.chronostek.com.br/api/health
)"
public_calendar="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    https://api-interno.chronostek.com.br/api/calendar/events
)"
public_frontend="$(
  curl --silent --output /dev/null --write-out '%{http_code}' \
    https://chronoshub.chronostek.com.br/login
)"
if test "$public_health" != 200 ||
   test "$public_calendar" != 401 ||
   test "$public_frontend" != 200; then
  rollback
  echo "Smoke público falhou: health=$public_health calendar=$public_calendar frontend=$public_frontend" >&2
  exit 1
fi

if docker inspect "$WORKER" >/dev/null 2>&1; then
  docker update --restart=no "$WORKER" >/dev/null
  docker stop "$WORKER" >/dev/null 2>&1 || true
  docker rename "$WORKER" "$WORKER-before-$SHORT"
fi
docker run -d \
  --name "$WORKER" \
  --network "$NETWORK" \
  --env-file "$ENV_FILE" \
  --label org.opencontainers.image.revision="$RELEASE" \
  --label telun.purpose=calendar-worker \
  --restart unless-stopped \
  "$IMAGE" \
  sh -c 'while true; do npm run calendar:worker -- --max=100; sleep 30; done' \
  >/dev/null

sleep 2
test "$(docker inspect "$CURRENT" --format '{{.State.Running}}')" = true
test "$(docker inspect "$WORKER" --format '{{.State.Running}}')" = true
printf '%s\n' \
  "deploy_ok release=$RELEASE" \
  "rollback_container=$ROLLBACK" \
  "public_health=$public_health" \
  "public_calendar_unauthenticated=$public_calendar" \
  "public_frontend=$public_frontend" \
  "worker=$WORKER"
