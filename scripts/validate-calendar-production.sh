#!/usr/bin/env sh
set -eu

DB_CONTAINER="${1:-chronostek-db}"
DB_NAME="$(docker exec "$DB_CONTAINER" printenv POSTGRES_DB)"

docker exec "$DB_CONTAINER" psql -U postgres -d "$DB_NAME" -At -F ':' -c '
  SELECT
    (SELECT count(*) FROM "User"),
    (SELECT count(*) FROM "Client"),
    (SELECT count(*) FROM "Contract"),
    (SELECT count(*) FROM "FinancialEntry"),
    (SELECT count(*) FROM "AuditLog"),
    (SELECT count(*) FROM "CalendarEvent"),
    (SELECT count(*) FROM "CalendarEventParticipant"),
    (SELECT count(*) FROM "CalendarIntegration"),
    (SELECT count(*) FROM "CalendarSyncJob");
'

orphans="$(
  docker exec "$DB_CONTAINER" psql -U postgres -d "$DB_NAME" -Atc '
    SELECT
      (SELECT count(*) FROM "CalendarEventParticipant" p LEFT JOIN "CalendarEvent" e ON e.id=p."eventId" WHERE e.id IS NULL)
      +
      (SELECT count(*) FROM "CalendarEvent" e LEFT JOIN "User" u ON u.id=e."createdById" WHERE e."createdById" IS NOT NULL AND u.id IS NULL);
  '
)"
migrations="$(
  docker exec "$DB_CONTAINER" psql -U postgres -d "$DB_NAME" -Atc '
    SELECT count(*) FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
  '
)"
tables="$(
  docker exec "$DB_CONTAINER" psql -U postgres -d "$DB_NAME" -Atc '
    SELECT count(*) FROM information_schema.tables WHERE table_schema=$$public$$;
  '
)"
calendar_tables="$(
  docker exec "$DB_CONTAINER" psql -U postgres -d "$DB_NAME" -Atc '
    SELECT count(*) FROM information_schema.tables
    WHERE table_schema=$$public$$ AND table_name LIKE $$Calendar%$$;
  '
)"

test "$orphans" = 0
test "$migrations" -ge 6
test "$calendar_tables" -ge 11
printf '%s\n' \
  "orphan_count=$orphans" \
  "applied_migrations=$migrations" \
  "public_tables=$tables" \
  "calendar_tables=$calendar_tables"
