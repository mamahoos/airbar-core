#!/bin/sh
set -eu

MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"

: "${PGHOST:?PGHOST is required}"
: "${PGPORT:=5432}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"

export PGPASSWORD

until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" >/dev/null 2>&1; do
  sleep 1
done

psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" <<'SQL'
CREATE TABLE IF NOT EXISTS public.airbar_local_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

for file in "$MIGRATIONS_DIR"/*.sql; do
  version="$(basename "$file" .sql)"
  applied="$(
    psql -At -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
      -c "SELECT 1 FROM public.airbar_local_migrations WHERE version = '$version'"
  )"

  if [ "$applied" = "1" ]; then
    echo "finance migration $version already applied"
    continue
  fi

  echo "applying finance migration $version"
  up_sql="/tmp/${version}.up.sql"
  awk '
    /^-- \+goose Down/ { exit }
    seen { print }
    /^-- \+goose Up/ { seen = 1 }
  ' "$file" > "$up_sql"

  psql -v ON_ERROR_STOP=1 -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" <<SQL
BEGIN;
\i $up_sql
INSERT INTO public.airbar_local_migrations(version) VALUES ('$version');
COMMIT;
SQL
done
