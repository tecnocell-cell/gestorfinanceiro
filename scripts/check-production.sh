#!/usr/bin/env bash
# Checklist de produção — Etapa 7.5
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API_URL="${CHECK_API_URL:-${PUBLIC_API_URL:-http://127.0.0.1:3001}}"
echo "Fluxiva — check-production ($API_URL)"
node server/homologacao/runProductionCheck.js "$API_URL"
