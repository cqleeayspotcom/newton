#!/usr/bin/env bash
# tools/db.sh — MySQL migrate / status / reset / seed for the dockerized DB.
# Deterministic, idempotent. Runs SQL through the `mysql` compose service, so it
# needs no local mysql client and does not depend on the backend being built.
#
# Usage:
#   tools/db.sh migrate   # apply pending migrations (default)
#   tools/db.sh status    # show applied vs pending migrations
#   tools/db.sh reset      # DROP + recreate the database, then migrate
#   tools/db.sh seed       # run db/seeds/*.sql (if any)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Load .env if present so creds/ports match compose.
[ -f .env ] && set -a && . ./.env && set +a

DB_NAME="${DB_NAME:-newfoot}"
DB_USER="${DB_USER:-newfoot}"
DB_PASSWORD="${DB_PASSWORD:-newfoot}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-rootpw}"
MIGRATIONS_DIR="db/migrations"
SEEDS_DIR="db/seeds"

compose() { docker compose "$@"; }

# Run SQL from stdin as the app user against the app DB.
mysql_app() {
  compose exec -T -e MYSQL_PWD="$DB_PASSWORD" mysql \
    mysql -u"$DB_USER" "$DB_NAME"
}

# Run SQL from stdin as root (no default DB) — used for reset.
mysql_root() {
  compose exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql \
    mysql -uroot
}

ensure_mysql_up() {
  if ! compose ps --status running mysql | grep -q mysql; then
    echo "error: mysql service is not running. Start the stack first (./init.sh)." >&2
    exit 1
  fi
}

ensure_migrations_table() {
  echo "CREATE TABLE IF NOT EXISTS schema_migrations (
          filename   VARCHAR(255) NOT NULL PRIMARY KEY,
          applied_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;" | mysql_app
}

applied_migrations() {
  echo "SELECT filename FROM schema_migrations ORDER BY filename;" \
    | mysql_app -N -B 2>/dev/null || true
}

cmd_migrate() {
  ensure_mysql_up
  ensure_migrations_table
  local applied
  applied="$(applied_migrations)"
  local any=0
  shopt -s nullglob
  for f in "$MIGRATIONS_DIR"/*.sql; do
    local base
    base="$(basename "$f")"
    if echo "$applied" | grep -qxF "$base"; then
      continue
    fi
    echo "  applying $base ..."
    mysql_app < "$f"
    printf "INSERT INTO schema_migrations (filename) VALUES ('%s');\n" "$base" | mysql_app
    any=1
  done
  if [ "$any" -eq 0 ]; then
    echo "  database up to date — no pending migrations."
  else
    echo "  migrations applied."
  fi
}

cmd_status() {
  ensure_mysql_up
  ensure_migrations_table
  local applied
  applied="$(applied_migrations)"
  echo "Migration status ($DB_NAME):"
  shopt -s nullglob
  for f in "$MIGRATIONS_DIR"/*.sql; do
    local base
    base="$(basename "$f")"
    if echo "$applied" | grep -qxF "$base"; then
      echo "  [x] $base"
    else
      echo "  [ ] $base (pending)"
    fi
  done
}

cmd_reset() {
  ensure_mysql_up
  echo "Resetting database '$DB_NAME' ..."
  printf "DROP DATABASE IF EXISTS %s; CREATE DATABASE %s CHARACTER SET utf8mb4;\n" \
    "$DB_NAME" "$DB_NAME" | mysql_root
  cmd_migrate
}

cmd_seed() {
  ensure_mysql_up
  shopt -s nullglob
  local seeds=("$SEEDS_DIR"/*.sql)
  if [ ${#seeds[@]} -eq 0 ]; then
    echo "  no seed files in $SEEDS_DIR."
    return 0
  fi
  for f in "${seeds[@]}"; do
    echo "  seeding $(basename "$f") ..."
    mysql_app < "$f"
  done
}

case "${1:-migrate}" in
  migrate) cmd_migrate ;;
  status)  cmd_status ;;
  reset)   cmd_reset ;;
  seed)    cmd_seed ;;
  *) echo "usage: tools/db.sh [migrate|status|reset|seed]" >&2; exit 2 ;;
esac
