#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$(realpath "$0")")"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Error: instala Node.js 20.16 o superior (incluye npm)." >&2
  exit 1
fi
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if (major<20 || (major===20 && minor<16)) { console.error("Error: TaskFlow requiere Node.js 20.16 o superior."); process.exit(1) }'
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Se creó .env desde la plantilla. Configura MongoDB y SESSION_SECRET y vuelve a ejecutar." >&2
  exit 1
fi
if [[ ! -d node_modules ]]; then npm ci; fi
port="$(sed -n 's/^PORT=//p' .env | head -n 1)"
port="${port:-3000}"
url="http://127.0.0.1:${port}/"
npm start &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true' EXIT INT TERM
for _ in $(seq 1 60); do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    wait "$server_pid"
  fi
  if node -e 'fetch(process.argv[1]).then(()=>process.exit(0)).catch(()=>process.exit(1))' "$url" >/dev/null 2>&1; then
    if command -v xdg-open >/dev/null 2>&1; then xdg-open "$url" >/dev/null 2>&1 || true; fi
    break
  fi
  sleep 0.5
done
wait "$server_pid"
