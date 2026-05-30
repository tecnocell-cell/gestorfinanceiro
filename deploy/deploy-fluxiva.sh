#!/bin/bash
# Deploy Fluxiva: painel (financeiro.fluxiva.app) + landing (fluxiva.app)
set -euo pipefail

REPO="${REPO:-$(cd "$(dirname "$0")/.." && pwd)}"
WWW_APP="${WWW_APP:-/var/www/gestorfinanceiro}"
WWW_LANDING="${WWW_LANDING:-/var/www/fluxiva-landing}"
PM2_NAME="${PM2_NAME:-gestor-back}"

cd "$REPO"

echo ">> git pull"
git pull origin main

echo ">> npm ci + build painel"
npm ci
npm run build

echo ">> .env da landing (URLs produção)"
cat > centerflow-frontend/.env <<'EOF'
VITE_CENTERFLOW_API_URL=https://financeiro.fluxiva.app/api
VITE_CENTERFLOW_APP_URL=https://financeiro.fluxiva.app
EOF

echo ">> build landing"
npm run build:landing

echo ">> publicar painel → $WWW_APP"
rsync -av --delete dist/ "$WWW_APP/"

echo ">> publicar landing → $WWW_LANDING"
rsync -av --delete public-landing/ "$WWW_LANDING/"
cp "$WWW_LANDING/index.spa.html" "$WWW_LANDING/index.html"

echo ">> nginx + pm2"
nginx -t
systemctl reload nginx
pm2 restart "$PM2_NAME" --update-env 2>/dev/null || pm2 restart all --update-env
pm2 save 2>/dev/null || true

echo ""
echo "=== Verificação obrigatória ==="
LANDING_JS=$(ls "$WWW_LANDING"/assets/index.spa-*.js 2>/dev/null | head -1)
APP_JS=$(ls "$WWW_APP"/assets/index-*.js 2>/dev/null | head -1)

fail=0
grep -q 'auth_token' "$LANDING_JS" && echo "OK  landing envia auth_token" || { echo "FALHA landing auth_token"; fail=1; }
grep -q 'auth_token' "$APP_JS" && echo "OK  painel consome auth_token" || { echo "FALHA painel auth_token"; fail=1; }
grep -q 'financeiro\.fluxiva\.app' "$LANDING_JS" && echo "OK  landing APP_URL fluxiva" || { echo "FALHA landing APP_URL"; fail=1; }
grep -q 'gestor_token' "$WWW_APP/index.html" && echo "OK  handoff inline no index.html" || { echo "FALHA handoff inline"; fail=1; }

if [ "$fail" -ne 0 ]; then
  echo "Deploy incompleto — corrija antes de testar login."
  exit 1
fi

echo ""
echo "Deploy OK — teste: https://fluxiva.app/login (aba anônima)"
