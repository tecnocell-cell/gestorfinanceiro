#!/usr/bin/env bash
# ============================================================
#  Gestor Financeiro — Setup automático para Ubuntu/Debian
#  Testado em: Ubuntu 22.04 LTS (Proxmox LXC)
#
#  Uso:
#    chmod +x setup.sh
#    sudo ./setup.sh
# ============================================================
set -e

# ── Cores ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERRO]${NC} $*"; exit 1; }

# ── Verificações iniciais ────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Execute como root: sudo ./setup.sh"

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
info "Diretório do app: $APP_DIR"

# ── Variáveis configuráveis ──────────────────────────────────
DB_USER="gestor"
DB_PASS="gestor123"
DB_NAME="gestor_db"
APP_PORT="3001"
NODE_VERSION="20"

# Credenciais do admin padrão (criado automaticamente na 1ª instalação)
ADMIN_EMAIL="admin@gestor.local"
ADMIN_SENHA="admin123"

# Gera JWT_SECRET aleatório se não estiver definido no .env
JWT_SECRET_VALUE="$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | head -c 64)"

# ── 1. Atualiza sistema ──────────────────────────────────────
info "Atualizando pacotes do sistema..."
apt-get update -qq
apt-get install -y -qq curl gnupg2 ca-certificates lsb-release wget unzip > /dev/null
success "Pacotes base instalados."

# ── 2. Node.js 20 ────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt "$NODE_VERSION" ]]; then
  info "Instalando Node.js $NODE_VERSION..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null
  apt-get install -y -qq nodejs > /dev/null
  success "Node.js $(node -v) instalado."
else
  success "Node.js $(node -v) já instalado."
fi

# ── 3. PostgreSQL 16 ─────────────────────────────────────────
if ! command -v psql &>/dev/null; then
  info "Instalando PostgreSQL 16..."
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
  echo "deb [signed-by=/etc/apt/trusted.gpg.d/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
  apt-get install -y -qq postgresql-16 > /dev/null
  systemctl enable postgresql
  systemctl start postgresql
  success "PostgreSQL 16 instalado."
else
  success "PostgreSQL já instalado: $(psql --version | head -1)"
fi

# ── 4. Cria banco e usuário ──────────────────────────────────
info "Configurando banco de dados..."

# Verifica se o usuário já existe
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  warn "Usuário '$DB_USER' já existe no PostgreSQL."
else
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" > /dev/null
  success "Usuário '$DB_USER' criado."
fi

# Verifica se o banco já existe
if sudo -u postgres psql -lqt | cut -d'|' -f1 | grep -qw "$DB_NAME"; then
  warn "Banco '$DB_NAME' já existe."
else
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" > /dev/null
  success "Banco '$DB_NAME' criado."
fi

# Aplica o schema (idempotente: usa IF NOT EXISTS)
sudo -u postgres psql -d "$DB_NAME" -f "$APP_DIR/server/schema.sql" > /dev/null
success "Schema aplicado."

# ── 5. Arquivo .env ──────────────────────────────────────────
ENV_FILE="$APP_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  info "Criando .env..."
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=$APP_PORT
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
DATABASE_SSL=false
JWT_SECRET=$JWT_SECRET_VALUE
EOF
  success ".env criado em $ENV_FILE"
else
  warn ".env já existe — não foi sobrescrito."
fi

# ── 6. Instala dependências npm ───────────────────────────────
info "Instalando dependências npm..."
cd "$APP_DIR"
npm ci --omit=dev --silent 2>&1 | tail -5
success "Dependências instaladas."

# ── 7. Build do React ────────────────────────────────────────
info "Gerando build de produção do React..."
# Precisa das devDependencies para o build
npm ci --silent 2>&1 | tail -5
npm run build --silent
# Volta para produção
npm ci --omit=dev --silent 2>&1 | tail -5
success "Build concluído (./dist)."

# ── 8. Cria usuário admin padrão (se banco estiver vazio) ────
info "Verificando usuário admin..."
cd "$APP_DIR"
# Carrega .env para o processo do seed
set -a; source "$ENV_FILE"; set +a
node server/seed.js
node server/seed-centertech.js
# seeds já imprimem o resultado

# ── 9. PM2 (process manager) ─────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  info "Instalando PM2..."
  npm install -g pm2 --silent
  success "PM2 instalado."
fi

# Para qualquer instância anterior
pm2 stop gestor 2>/dev/null || true
pm2 delete gestor 2>/dev/null || true

# Inicia com PM2
cd "$APP_DIR"
pm2 start server/index.js \
  --name gestor \
  --interpreter node \
  --env production \
  --log-date-format "YYYY-MM-DD HH:mm:ss"

# Salva lista de processos e configura startup
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true
success "Aplicação iniciada com PM2."

# ── 10. Resumo final ─────────────────────────────────────────
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅  Gestor Financeiro instalado com sucesso!    ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  🌐 Acesse:  ${BLUE}http://$(hostname -I | awk '{print $1}'):$APP_PORT${NC}"
echo ""
echo -e "  ${YELLOW}┌─ Login padrão ─────────────────────────────────┐${NC}"
echo -e "  ${YELLOW}│  E-mail : ${WHITE}$ADMIN_EMAIL${YELLOW}                 │${NC}"
echo -e "  ${YELLOW}│  Senha  : ${WHITE}$ADMIN_SENHA${YELLOW}                          │${NC}"
echo -e "  ${YELLOW}│  ⚠️  Altere a senha após o primeiro login!      │${NC}"
echo -e "  ${YELLOW}└────────────────────────────────────────────────┘${NC}"
echo ""
echo -e "  📦 Banco:   ${BLUE}PostgreSQL → $DB_NAME${NC}"
echo -e "  ⚙️  PM2:     ${BLUE}pm2 status${NC}"
echo -e "  📋 Logs:    ${BLUE}pm2 logs gestor${NC}"
echo -e "  🔑 Novo usuário: acesse o app e clique em 'Criar Conta'"
echo ""
