#!/bin/bash
# Atualização rápida no servidor (rodar como root ou com sudo)
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/gestorfinanceiro}"
cd "$APP_DIR"

echo ">> git pull"
git pull origin main

echo ">> npm ci"
sudo -u gestor npm ci

echo ">> npm run build"
sudo -u gestor npm run build

echo ">> restart services"
systemctl restart gestor-api
systemctl reload nginx

echo ">> OK — $(date -Iseconds)"
