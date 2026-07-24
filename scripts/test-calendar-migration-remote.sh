#!/usr/bin/env sh
set -eu

BASE="${1:-/root/telun-calendar-migration-test-20260724}"
DB_CONTAINER="${2:-telun-calendar-migration-test-20260724}"
FIXTURE="$BASE/calendar-legacy-drift.sql"
if test ! -f "$FIXTURE"; then
  FIXTURE="$BASE/scripts/fixtures/calendar-legacy-drift.sql"
fi
MIGRATIONS="$BASE/migrations"
if test ! -d "$MIGRATIONS"; then
  MIGRATIONS="$BASE/prisma/migrations"
fi

psql_exec() {
  database="$1"
  shift
  docker exec -e PGPASSWORD=calendar_test "$DB_CONTAINER" \
    psql -U postgres -d "$database" -v ON_ERROR_STOP=1 "$@"
}

psql_file() {
  database="$1"
  file="$2"
  docker exec -i -e PGPASSWORD=calendar_test "$DB_CONTAINER" \
    psql -U postgres -d "$database" -v ON_ERROR_STOP=1 < "$file" >/dev/null
}

psql_exec postgres -c 'CREATE DATABASE clean_calendar' >/dev/null
find "$MIGRATIONS" -mindepth 2 -maxdepth 2 -name migration.sql |
  sort |
  while IFS= read -r file; do
    psql_file clean_calendar "$file"
  done

clean_tables="$(
  psql_exec clean_calendar -Atc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'Calendar%';"
)"

psql_exec postgres -c 'CREATE DATABASE legacy_calendar' >/dev/null
find "$MIGRATIONS" -mindepth 2 -maxdepth 2 -name migration.sql |
  sort |
  grep -v 20260724210000 |
  while IFS= read -r file; do
    psql_file legacy_calendar "$file"
  done
psql_file legacy_calendar "$FIXTURE"

before="$(
  psql_exec legacy_calendar -Atc \
    "SELECT (SELECT count(*) FROM \"CalendarEvent\")::text || ':' || (SELECT count(*) FROM \"CalendarEventParticipant\")::text;"
)"
psql_file legacy_calendar \
  "$MIGRATIONS/20260724210000_calendar_google_integration/migration.sql"
after="$(
  psql_exec legacy_calendar -Atc \
    "SELECT (SELECT count(*) FROM \"CalendarEvent\")::text || ':' || (SELECT count(*) FROM \"CalendarEventParticipant\")::text;"
)"
null_roles="$(
  psql_exec legacy_calendar -Atc \
    "SELECT count(*) FROM \"CalendarEventParticipant\" WHERE role IS NULL;"
)"

printf '%s\n' \
  "clean_calendar_tables=$clean_tables legacy_before=$before legacy_after=$after null_roles=$null_roles"
