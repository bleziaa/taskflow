#!/usr/bin/env bash
set -eu
cd -- "$(dirname -- "$0")"
if [ -x runtime/node ]; then
  exec ./runtime/node scripts/start-local.js "$@"
fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo 'Instala Node.js 22 LTS o utiliza el paquete que incluye Node.js.' >&2
  exit 1
fi
if [ ! -d node_modules ]; then
  npm ci --omit=dev
fi
exec node scripts/start-local.js "$@"
