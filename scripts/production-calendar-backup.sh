#!/usr/bin/env sh
set -eu

RELEASE="${1:?informe a revisão candidata}"
STAMP="$(date -u +%Y%m%d-%H%M%SZ)"
NAME="$STAMP-$RELEASE-pre-calendar"
BACKUP="/root/chronostek-backups/$NAME"
MIRROR="/opt/chronostek-backups/$NAME"

install -d -m 700 "$BACKUP"

DB_NAME="$(docker exec chronostek-db printenv POSTGRES_DB)"

docker exec chronostek-db \
  pg_dump -U postgres -d "$DB_NAME" --format=custom --no-owner --no-acl \
  > "$BACKUP/database.dump"
docker exec chronostek-db \
  pg_dump -U postgres -d "$DB_NAME" --schema-only --no-owner --no-acl \
  > "$BACKUP/schema.sql"

docker exec chronostek-db \
  psql -U postgres -d "$DB_NAME" -At -F '	' -c '
    SELECT $$User$$, count(*) FROM "User"
    UNION ALL SELECT $$Client$$, count(*) FROM "Client"
    UNION ALL SELECT $$Contract$$, count(*) FROM "Contract"
    UNION ALL SELECT $$FinancialEntry$$, count(*) FROM "FinancialEntry"
    UNION ALL SELECT $$AuditLog$$, count(*) FROM "AuditLog"
    UNION ALL SELECT $$CalendarEvent$$, count(*) FROM "CalendarEvent"
    UNION ALL SELECT $$CalendarEventParticipant$$, count(*) FROM "CalendarEventParticipant"
    ORDER BY 1;
  ' > "$BACKUP/table-counts.tsv"

{
  printf 'candidate_release=%s\n' "$RELEASE"
  printf 'created_utc=%s\n' "$STAMP"
  docker inspect telun-web --format 'active_container={{.Name}} active_image={{.Config.Image}} restart={{.HostConfig.RestartPolicy.Name}}'
  docker inspect chronostek-db --format 'database_container={{.Name}} database_image={{.Config.Image}} restart={{.HostConfig.RestartPolicy.Name}}'
  docker image inspect "telun-web:$RELEASE" --format 'candidate_image_id={{.Id}} candidate_repo_digests={{json .RepoDigests}}'
} > "$BACKUP/runtime.txt"

if test -f /opt/chronostek/.env; then
  cp -p /opt/chronostek/.env "$BACKUP/production.env"
  chmod 600 "$BACKUP/production.env"
fi
if test -d /etc/nginx; then
  cp -a /etc/nginx "$BACKUP/nginx"
fi
if test -d "/opt/chronostek/releases/$RELEASE/prisma/migrations"; then
  cp -a "/opt/chronostek/releases/$RELEASE/prisma/migrations" "$BACKUP/migrations"
fi

(
  cd "$BACKUP"
  sha256sum database.dump schema.sql table-counts.tsv runtime.txt > SHA256SUMS
)

install -d -m 700 /opt/chronostek-backups
cp -a "$BACKUP" "$MIRROR"
printf '%s\n' "backup_name=$NAME" "backup_path=$BACKUP" "mirror_path=$MIRROR"
