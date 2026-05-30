# STATUS E OPERAÇÕES — CenterFlow Financeiro
> Guia operacional completo: como rodar localmente, fazer deploy, configurar Docker, PM2, Nginx e resolver problemas.

---

## 1. Como Rodar Localmente

### Pré-requisitos
- Node.js 20+
- PostgreSQL 16 rodando localmente **OU** Docker instalado

### Opção A — Node direto + PostgreSQL local

```bash
# 1. Clonar e instalar dependências
cd C:\Users\root\Documents\Projetos\CenterFlow   # (ou seu caminho)
npm install

# 2. Criar o banco no PostgreSQL local
psql -U postgres -c "CREATE USER gestor WITH PASSWORD 'gestor123';"
psql -U postgres -c "CREATE DATABASE gestor_db OWNER gestor;"

# 3. Copiar variáveis de ambiente
copy .env.example .env   # Windows
# cp .env.example .env   # Linux/Mac

# 4. Editar .env (mínimo obrigatório para rodar local):
# DATABASE_URL=postgresql://gestor:gestor123@localhost:5432/gestor_db
# DATABASE_SSL=false
# JWT_SECRET=qualquer_string_longa_aqui
# PORT=3001
# NODE_ENV=development

# 5. Rodar seed (cria usuário admin padrão)
node server/seed.js
node server/seed-centertech.js  # opcional: cria tenant de demonstração

# 6. Iniciar frontend + backend juntos
npm run dev:all
```

- **Frontend:** http://localhost:5173
- **Backend/API:** http://localhost:3001/api
- **Health check:** http://localhost:3001/api/health

### Opção B — Docker Compose (banco + app)

```bash
# 1. Copiar e configurar .env
copy .env.example .env

# 2. Definir JWT_SECRET no .env ou na linha de comando
# $env:JWT_SECRET="minha_chave_segura_aqui"   # PowerShell

# 3. Subir todos os serviços
docker-compose up --build -d

# 4. Verificar logs
docker-compose logs -f app
docker-compose logs -f db
```

A aplicação ficará em: http://localhost:3001

---

## 2. Scripts npm

| Script | Comando | Descrição |
|---|---|---|
| `npm run dev` | `vite` | Apenas o frontend React (porta 5173) |
| `npm run dev:all` | `concurrently vite node server/index.js` | Frontend + backend juntos |
| `npm run server` | `node server/index.js` | Apenas o backend |
| `npm start` | `node server/index.js` | Alias do server (usado em produção) |
| `npm run build` | `vite build` | Gera build React em `/dist` |
| `npm run migrate` | `node server/migrate.js` | Roda todas as migrations pendentes |
| `npm run seed:centertech` | `node server/seed-centertech.js` | Cria tenant de demo |
| `npm run repair:tenants` | `node server/repairTenants.js` | Repara estados corrompidos |
| `npm run test:api` | `node server/integrationTest.js` | Testes de integração da API |
| `npm run lint` | `eslint .` | Lint do código |
| `npm run preview` | `vite preview` | Preview do build estático |

---

## 3. Variáveis de Ambiente (`.env`)

Arquivo de referência: `C:\Users\root\Documents\Projetos\CenterFlow\.env.example`

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://gestor:gestor123@localhost:5432/gestor_db` | Connection string PostgreSQL |
| `DATABASE_SSL` | ✅ | `false` | `true` em produção com certificado SSL |
| `JWT_SECRET` | ✅ | `troque_essa_chave_...` | Chave JWT — min. 32 chars em produção |
| `PORT` | | `3001` | Porta do servidor Node.js |
| `NODE_ENV` | | `development` | `production` em produção |
| `CORS_ORIGIN` | | — | Origens extras separadas por vírgula |
| `SMTP_HOST` | | — | SMTP para verificação por e-mail |
| `SMTP_PORT` | | — | Porta SMTP (ex: 587) |
| `SMTP_SECURE` | | — | `true` para TLS |
| `SMTP_USER` | | — | Usuário SMTP |
| `SMTP_PASS` | | — | Senha de app SMTP |
| `SMTP_FROM` | | — | Endereço remetente |
| `VERIFY_CODE_TTL_MIN` | | `15` | Expiração do código (minutos) |
| `TWILIO_ACCOUNT_SID` | | — | Para verificação SMS |
| `TWILIO_AUTH_TOKEN` | | — | Para verificação SMS |
| `TWILIO_FROM` | | — | Número Twilio (ex: +5511999999999) |
| `EVOLUTION_API_URL` | | — | URL da Evolution API (WhatsApp) |
| `EVOLUTION_API_KEY` | | — | Global API Key da Evolution |
| `WEBHOOK_BASE_URL` | | — | URL pública do CenterFlow (para webhook) |

> **ATENÇÃO:** Sem `WEBHOOK_BASE_URL`, `/api/whatsapp/connect` retorna 503.

---

## 4. Docker

### Serviços (`docker-compose.yml`)

| Serviço | Container | Imagem | Porta | Volume |
|---|---|---|---|---|
| db | `gestor_db` | postgres:16-alpine | — (interno) | `gestor_db_data` |
| app | `gestor_app` | build local | 3001:3001 | — |

### Rede
- `gestor_net` / `gestor_network` — rede interna Docker

### Volume
- `gestor_db_data` (nome: `gestor_db_data`) — persiste dados PostgreSQL

### Health Check do banco
```yaml
test: ["CMD-SHELL", "pg_isready -U gestor -d gestor_db"]
interval: 10s
timeout: 5s
retries: 5
```

O serviço `app` só inicia após o banco estar healthy (`condition: service_healthy`).

### Dockerfile (multi-stage)
```
Stage 1 (builder): node:20-alpine — npm ci + vite build
Stage 2 (production): node:20-alpine — npm ci --omit=dev + copia dist/ + server/
```

### Health Check da aplicação (Dockerfile)
```
HEALTHCHECK CMD wget -qO- http://localhost:3001/api/health || exit 1
interval: 30s, timeout: 10s, start-period: 20s, retries: 3
```

### Comandos Docker úteis
```bash
# Subir em background
docker-compose up -d

# Ver logs em tempo real
docker-compose logs -f app

# Rebuild após mudança de código
docker-compose up --build -d

# Parar tudo
docker-compose down

# Parar e apagar volume (⚠️ apaga todos os dados)
docker-compose down -v

# Acessar PostgreSQL dentro do container
docker exec -it gestor_db psql -U gestor -d gestor_db
```

---

## 5. Deploy em Produção (VPS/LXC Ubuntu)

### Estrutura de diretórios em produção
```
/opt/gestorfinanceiro/          ← raiz da aplicação
├── dist/                       ← build React (gerado por npm run build)
├── server/                     ← código do backend
├── .env                        ← variáveis de produção (não commitado)
├── package.json
└── node_modules/
```

### Usuário de sistema
- User: `gestor`
- Group: `gestor`

### Instalação inicial
```bash
# Criar usuário
adduser --system --group gestor

# Clonar repositório
git clone <repo> /opt/gestorfinanceiro
chown -R gestor:gestor /opt/gestorfinanceiro

# Instalar dependências
sudo -u gestor npm ci

# Build
sudo -u gestor npm run build

# Configurar .env de produção
cp /opt/gestorfinanceiro/.env.example /opt/gestorfinanceiro/.env
# editar .env com valores reais
```

---

## 6. PM2

O sistema é gerenciado por PM2 em produção. Referência encontrada em `docs/WHATSAPP_CHECKPOINT.md`:

```bash
# Iniciar/reiniciar com novo .env
pm2 restart gestor-back --update-env

# Ver logs
pm2 logs gestor-back

# Monitorar
pm2 monit

# Salvar para auto-start
pm2 save
pm2 startup
```

> **Nota:** O `deploy/gestor-api.service.example` mostra alternativa com systemd (ver seção 7).

---

## 7. Systemd (alternativa ao PM2)

Arquivo de exemplo: `C:\Users\root\Documents\Projetos\CenterFlow\deploy\gestor-api.service.example`

```ini
[Unit]
Description=Gestor Financeiro API
After=network.target

[Service]
Type=simple
User=gestor
Group=gestor
WorkingDirectory=/opt/gestorfinanceiro
Environment=NODE_ENV=production
EnvironmentFile=-/opt/gestorfinanceiro/.env
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Instalar o serviço
cp /opt/gestorfinanceiro/deploy/gestor-api.service.example \
   /etc/systemd/system/gestor-api.service
systemctl daemon-reload
systemctl enable gestor-api
systemctl start gestor-api
systemctl status gestor-api
```

---

## 8. Nginx

Arquivo de exemplo: `C:\Users\root\Documents\Projetos\CenterFlow\deploy\nginx-gestor.conf.example`

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name gestor.local _;

    root /opt/gestorfinanceiro/dist;
    index index.html;

    # Frontend SPA (React)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache de assets buildados
    location /assets/ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

### Com SSL (Certbot/Cloudflare)
```bash
# Instalar certbot
apt install certbot python3-certbot-nginx

# Gerar certificado
certbot --nginx -d gestor.suaempresa.com

# Renovação automática
systemctl enable certbot.timer
```

---

## 9. Script de Atualização

Arquivo: `C:\Users\root\Documents\Projetos\CenterFlow\deploy\update.sh`

```bash
#!/bin/bash
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/gestorfinanceiro}"
cd "$APP_DIR"

git pull origin main
sudo -u gestor npm ci
sudo -u gestor npm run build
systemctl restart gestor-api
systemctl reload nginx
echo ">> OK — $(date -Iseconds)"
```

```bash
# Executar
bash /opt/gestorfinanceiro/deploy/update.sh
```

---

## 10. PostgreSQL

### Conexão padrão
```
Host: localhost (ou 'db' dentro do Docker)
Porta: 5432
Database: gestor_db
User: gestor
Password: gestor123 (MUDE EM PRODUÇÃO)
```

### Pool de conexões (`server/db.js`)
```javascript
max: 20
idleTimeoutMillis: 30000
connectionTimeoutMillis: 3000
```

### Aplicar migrations manualmente
```bash
node server/migrate.js
```

As migrations rodam automaticamente no `start()` do `server/index.js`.

### Migrations existentes (em ordem)
| Arquivo | O que cria/altera |
|---|---|
| `server/schema.sql` | `usuarios`, `estados`, triggers, índices base |
| `server/migrations/002_verificacao.sql` | Colunas de verificação em `usuarios`, tabela `verificacoes` |
| `server/migrations/003_recorrencias.sql` | Tabela `recorrencias` |
| `server/migrations/004_conexoes_bancarias.sql` | Tabelas `conexoes_bancarias`, `conexoes_interesse` |
| `server/migrations/005_whatsapp_tables.sql` | Tabelas `whatsapp_sessions`, `whatsapp_pending` |

### Comandos úteis PostgreSQL
```bash
# Conectar ao banco
psql postgresql://gestor:gestor123@localhost:5432/gestor_db

# Dentro do Docker
docker exec -it gestor_db psql -U gestor -d gestor_db

# Listar tabelas
\dt

# Ver usuários cadastrados
SELECT id, email, nome, role, ativo FROM usuarios;

# Limpar sessões WhatsApp (troubleshooting)
DELETE FROM whatsapp_sessions;

# Verificar tamanho do estado de um tenant
SELECT usuario_id, pg_size_pretty(pg_column_size(dados)::bigint) FROM estados;
```

---

## 11. Health Checks

### API Health
```
GET /api/health → { ok: true }
GET /api/status → { online: true, version: "2.0", port: 3001 }
```

### Verificar conexão com banco
```bash
node check-db.mjs
```

### Verificar container Docker
```bash
docker inspect --format='{{.State.Health.Status}}' gestor_app
```

---

## 12. Backups

### Backup do banco (PostgreSQL)
```bash
# Backup completo
pg_dump postgresql://gestor:gestor123@localhost:5432/gestor_db > backup_$(date +%F).sql

# Restaurar
psql postgresql://gestor:gestor123@localhost:5432/gestor_db < backup_YYYY-MM-DD.sql
```

### Backup do estado de um tenant (JSON)
Via frontend: menu **Importações → Backup JSON → Exportar JSON**

---

## 13. Problemas Comuns

### "Servidor indisponível. Inicie o backend com: npm run server"
- Backend não está rodando.
- Execute: `npm run dev:all` (dev) ou `pm2 start` / `systemctl start gestor-api` (produção).

### "CORS bloqueado para origem: ..."
- A origem do frontend não está na whitelist.
- Adicione ao `.env`: `CORS_ORIGIN=https://gestor.suaempresa.com`

### Login retorna "E-mail ou senha incorretos"
- Verificar se o seed foi executado: `node server/seed.js`
- Verificar se o banco está acessível: `node check-db.mjs`

### "QR code não aparece" (WhatsApp)
- Ver `docs/WHATSAPP_CHECKPOINT.md` para diagnóstico completo.
- Causa mais provável: Evolution API v2.1.1 com bug de QR. Atualizar para v2.3.7+.
- Verificar se `WEBHOOK_BASE_URL` está configurado no `.env`.

### Migrations falham ao iniciar
- Verificar se o banco está rodando e acessível.
- Verificar se o usuário `gestor` tem permissão de CREATE TABLE.
- Rodar manualmente: `node server/migrate.js`

### Estado JSONB não carrega / volta ao inicial
- Executar: `npm run repair:tenants`
- Verificar logs do servidor para erros de `normalizeStateForUser`.

### Porta 3001 já em uso
- `netstat -ano | findstr :3001` (Windows)
- `lsof -i :3001` (Linux)
- Matar o processo ou alterar `PORT` no `.env`.

### Build falha (npm run build)
- Verificar se `node_modules` está atualizado: `npm ci`
- Verificar erros de ESLint: `npm run lint`
