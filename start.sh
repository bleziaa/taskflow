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
exec npm start
