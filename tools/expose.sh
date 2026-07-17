#!/usr/bin/env bash
# tools/expose.sh — start an ngrok HTTPS tunnel to the frontend and print the
# public URL. HTTPS is required for camera access (getUserMedia secure context);
# plain http://<LAN-IP> will NOT grant the camera.
#
# --host-header=rewrite makes ngrok send Host: localhost:<port> upstream, which
# bypasses the Angular dev-server host check so any dynamic ngrok URL works.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -f .env ] && set -a && . ./.env && set +a

PORT="${FRONTEND_HOST_PORT:-4200}"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "error: ngrok is not installed. Install from https://ngrok.com/download" >&2
  exit 1
fi

echo "Exposing http://localhost:${PORT} via ngrok (HTTPS) ..."
echo "The public https:// URL below is what you open on a phone."
echo "Inspect traffic at http://localhost:4040"
echo
exec ngrok http "${PORT}" --host-header=rewrite
