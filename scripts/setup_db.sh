#!/usr/bin/env bash
# Creates the LabTrace PostgreSQL database from scratch.
#   With psql installed:   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres ./scripts/setup_db.sh
#   Without psql:          uses the docker compose "postgres" service automatically
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${LABTRACE_DB:-labtrace}

if command -v psql >/dev/null 2>&1; then
  PSQL=(psql)
else
  echo ">> psql not found - using: docker compose exec postgres psql"
  PSQL=(docker compose exec -T postgres psql -U postgres)
fi

echo ">> (re)creating database $DB"
"${PSQL[@]}" -v ON_ERROR_STOP=1 -q -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"

for f in 01_schema 02_functions_triggers 03_views 04_security 05_seed; do
  echo ">> running sql/$f.sql"
  "${PSQL[@]}" -v ON_ERROR_STOP=1 -q -d "$DB" < "sql/$f.sql" > /dev/null
done
"${PSQL[@]}" -q -d "$DB" -c "ALTER ROLE labtrace_app SET search_path = labtrace, public"
echo ">> done. Demo logins (password Password@123): admin@labtrace.edu, tech@labtrace.edu, student@labtrace.edu"
