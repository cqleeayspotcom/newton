#!/usr/bin/env bash
# init.sh — bring up the full Newfoot stack from a clean clone. Idempotent:
# safe to re-run. Builds images, starts docker-compose, waits for healthchecks,
# applies DB migrations, then prints the local URL and the ngrok command.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

info()  { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m!\033[0m %s\n' "$*"; }
fail()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# --- preflight -------------------------------------------------------------
command -v docker >/dev/null 2>&1 || fail "docker is not installed."
docker info >/dev/null 2>&1 || fail "Docker daemon is not running. Start Docker Desktop."

if [ ! -f .env ]; then
  cp .env.example .env
  info "Created .env from .env.example (default local POC credentials)."
fi
set -a && . ./.env && set +a
FRONTEND_HOST_PORT="${FRONTEND_HOST_PORT:-4200}"
BACKEND_HOST_PORT="${BACKEND_HOST_PORT:-3000}"

# --- build + start ---------------------------------------------------------
info "Building and starting containers (first run installs deps — be patient)..."
docker compose up -d --build

# --- wait for backend ------------------------------------------------------
wait_http() { # url, name, max_tries
  local url="$1" name="$2" tries="${3:-120}" i=1
  info "Waiting for $name ($url) ..."
  while [ "$i" -le "$tries" ]; do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then ok "$name is up."; return 0; fi
    sleep 2; i=$((i+1))
  done
  warn "$name did not become ready in time. Recent logs:"
  docker compose logs --tail=40 "$name" || true
  return 1
}

wait_http "http://localhost:${BACKEND_HOST_PORT}/api/health" backend 120 \
  || fail "Backend never became healthy."

# --- migrations ------------------------------------------------------------
info "Applying database migrations ..."
bash tools/db.sh migrate

# --- wait for frontend -----------------------------------------------------
wait_http "http://localhost:${FRONTEND_HOST_PORT}" frontend 150 \
  || warn "Frontend not ready yet — the Angular dev server can take a bit on first compile. Check: docker compose logs -f frontend"

# --- summary ---------------------------------------------------------------
echo
ok "Newfoot stack is up."
echo   "  Frontend : http://localhost:${FRONTEND_HOST_PORT}"
echo   "  Backend  : http://localhost:${BACKEND_HOST_PORT}/api/health"
echo   "  DB       : localhost:${DB_HOST_PORT:-3307} (mysql, db '${DB_NAME:-newfoot}')"
echo
info "To share publicly over HTTPS (required for camera on a phone):"
echo   "  ./tools/expose.sh        # or: ngrok http ${FRONTEND_HOST_PORT} --host-header=rewrite"
echo
info "Plain http://<LAN-IP> will NOT grant camera access — a secure (HTTPS) context is required."
