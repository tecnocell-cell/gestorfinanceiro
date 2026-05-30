# FLUXO DE DEPLOY — CenterFlow Financeiro
> Guia completo de deploy em VPS/LXC Ubuntu, incluindo PM2, Docker, Nginx, SSL e Cloudflare.

---

## 1. Visão Geral dos Ambientes

| Ambiente | Como rodar | URL |
|---|---|---|
| Desenvolvimento | `npm run dev:all` | http://localhost:5173 (frontend) + http://localhost:3001 (API) |
| Docker local | `docker-compose up` | http://localhost:3001 |
| Produção (VPS) | PM2 + Nginx | https://gestor.suaempresa.com |
| Produção (Docker) | docker-compose + Nginx reverse proxy | https://gestor.suaempresa.com |

---

## 2. Requisitos do Servidor

- **OS:** Ubuntu 22.04 LTS (recomendado)
- **RAM mínima:** 1 GB (recomendado 2 GB+)
- **Disco:** 10 GB+
- **Node.js:** 20.x
- **PostgreSQL:** 16
- **Nginx:** 1.18+
- **PM2:** `npm install -g pm2`
- **Certbot:** para SSL (opcional com Cloudflare)

---

## 3. Estrutura de Arquivos em Produção

```
/opt/gestorfinanceiro/        ← raiz da aplicação
├── dist/                     ← build React (gerado por npm run build)
│   ├── index.html
│   └── assets/
├── server/                   ← backend Node.js
│   ├── index.js
│   ├── db.js
│   ├── middleware/
│   ├── routes/
│   ├── whatsapp/
│   └── migrations/
├── .env                      ← variáveis de produção (NÃO commitado)
├── package.json
├── package-lock.json
└── node_modules/

/var/log/nginx/               ← logs do Nginx
/etc/nginx/sites-available/   ← configuração Nginx
/etc/systemd/system/          ← serviço systemd (se não usar PM2)
```

---

## 4. Instalação Inicial no Servidor

### 4.1 Instalar Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # deve ser v20.x
```

### 4.2 Instalar PostgreSQL 16
```bash
sudo apt install postgresql-16 -y
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Criar usuário e banco
sudo -u postgres psql -c "CREATE USER gestor WITH PASSWORD 'gestor123';"
sudo -u postgres psql -c "CREATE DATABASE gestor_db OWNER gestor;"
```

### 4.3 Instalar Nginx
```bash
sudo apt install nginx -y
sudo systemctl enable nginx
```

### 4.4 Instalar PM2
```bash
sudo npm install -g pm2
```

### 4.5 Criar usuário do sistema
```bash
sudo adduser --system --group gestor
```

### 4.6 Clonar o repositório
```bash
sudo mkdir /opt/gestorfinanceiro
sudo git clone <url-do-repo> /opt/gestorfinanceiro
sudo chown -R gestor:gestor /opt/gestorfinanceiro
```

### 4.7 Instalar dependências
```bash
cd /opt/gestorfinanceiro
sudo -u gestor npm ci
```

### 4.8 Configurar variáveis de ambiente
```bash
sudo -u gestor cp /opt/gestorfinanceiro/.env.example /opt/gestorfinanceiro/.env
sudo nano /opt/gestorfinanceiro/.env

# Conteúdo mínimo para produção:
DATABASE_URL=postgresql://gestor:gestor123@localhost:5432/gestor_db
DATABASE_SSL=false
JWT_SECRET=<gere com: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://gestor.suaempresa.com
WEBHOOK_BASE_URL=https://gestor.suaempresa.com
```

### 4.9 Build do frontend
```bash
sudo -u gestor npm run build
```

### 4.10 Rodar migrations e seed
```bash
sudo -u gestor node server/seed.js
# Opcional: seed de demonstração
sudo -u gestor node server/seed-centertech.js
```

---

## 5. PM2 — Gerenciamento de Processo

### Iniciar a aplicação
```bash
# Como usuário gestor
sudo -u gestor pm2 start server/index.js --name gestor-back --cwd /opt/gestorfinanceiro

# Ou via npm start
sudo -u gestor pm2 start "npm start" --name gestor-back --cwd /opt/gestorfinanceiro
```

### Configurar auto-start
```bash
pm2 save
pm2 startup   # gera o comando systemd
# executar o comando gerado como root
```

### Comandos PM2 úteis
```bash
pm2 status                              # ver todos os processos
pm2 logs gestor-back                    # ver logs em tempo real
pm2 logs gestor-back --lines 200        # últimas 200 linhas
pm2 restart gestor-back --update-env    # reiniciar com novo .env
pm2 stop gestor-back                    # parar
pm2 delete gestor-back                  # remover
pm2 monit                               # dashboard de monitoramento
```

---

## 6. Nginx — Configuração

Arquivo de exemplo: `/opt/gestorfinanceiro/deploy/nginx-gestor.conf.example`

### Config básica (HTTP)
```bash
sudo nano /etc/nginx/sites-available/centerflow
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name gestor.suaempresa.com;

    root /opt/gestorfinanceiro/dist;
    index index.html;

    # Frontend SPA
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

    # Cache de assets
    location /assets/ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/centerflow /etc/nginx/sites-enabled/
sudo nginx -t        # testar configuração
sudo systemctl reload nginx
```

---

## 7. SSL com Certbot

```bash
# Instalar certbot
sudo apt install certbot python3-certbot-nginx -y

# Gerar certificado (substitui automático no nginx.conf)
sudo certbot --nginx -d gestor.suaempresa.com

# Verificar renovação automática
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

---

## 8. SSL com Cloudflare (Proxy)

Se o domínio usa Cloudflare como proxy:

1. No Cloudflare: ativar proxy (laranja) para o subdomínio `gestor`
2. SSL/TLS mode: **Full** ou **Full (strict)**
3. No Nginx: pode manter HTTPS local ou usar HTTP simples (Cloudflare faz o SSL externo)

```nginx
# Com Cloudflare proxy, o Nginx pode ouvir apenas na porta 80 localmente
# O SSL é gerenciado pelo Cloudflare
server {
    listen 80;
    server_name gestor.suaempresa.com;
    
    # Forçar HTTPS (via Cloudflare)
    location / { ... }
    location /api/ { ... }
}
```

Para o webhook do WhatsApp funcionar com Cloudflare:
- `WEBHOOK_BASE_URL=https://gestor.suaempresa.com` (URL pública com HTTPS)
- O Cloudflare deve permitir POST no path `/api/whatsapp/webhook/*`

---

## 9. Docker em Produção

### Opção A — Apenas banco no Docker, app via PM2
```bash
# Subir apenas o banco
docker-compose up -d db

# Configurar .env com host do banco
DATABASE_URL=postgresql://gestor:gestor123@localhost:5432/gestor_db

# Rodar app via PM2 normalmente
pm2 start server/index.js --name gestor-back
```

### Opção B — App completo no Docker
```bash
# .env com JWT_SECRET obrigatório
docker-compose up -d --build

# Ver logs
docker-compose logs -f app

# Nginx como reverse proxy (externo ao Docker)
location /api/ {
    proxy_pass http://127.0.0.1:3001/api/;
}
```

> **Nota:** O `docker-compose.yml` expõe a porta `3001:3001`. O Nginx faz o proxy para essa porta.

---

## 10. Instalação Proxmox (LXC)

Ver: `docs/INSTALACAO_PROXMOX.md`

---

## 11. Script de Atualização

Arquivo: `/opt/gestorfinanceiro/deploy/update.sh`

```bash
#!/bin/bash
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/gestorfinanceiro}"
cd "$APP_DIR"

git pull origin main
sudo -u gestor npm ci
sudo -u gestor npm run build
systemctl restart gestor-api     # ou: pm2 restart gestor-back --update-env
systemctl reload nginx
echo ">> OK — $(date -Iseconds)"
```

```bash
# Execução
bash /opt/gestorfinanceiro/deploy/update.sh

# Ou com PM2 (substituir as linhas systemctl)
cd /opt/gestorfinanceiro
git pull origin main
sudo -u gestor npm ci
sudo -u gestor npm run build
pm2 restart gestor-back --update-env
sudo systemctl reload nginx
```

---

## 12. Atualização Manual Passo a Passo

```bash
# 1. Entrar no diretório
cd /opt/gestorfinanceiro

# 2. Atualizar código
git pull origin main
git log -1 --oneline   # confirmar último commit

# 3. Instalar dependências
sudo -u gestor npm ci

# 4. Build do frontend
sudo -u gestor npm run build

# 5. Reiniciar backend
pm2 restart gestor-back --update-env

# 6. Verificar
pm2 status
curl http://localhost:3001/api/health
# deve retornar: {"ok":true}

# 7. Reload Nginx (se configuração mudou)
sudo nginx -t && sudo systemctl reload nginx
```

---

## 13. Variáveis de Ambiente de Produção

```env
# Banco
DATABASE_URL=postgresql://gestor:SENHA_FORTE@localhost:5432/gestor_db
DATABASE_SSL=false

# JWT — OBRIGATÓRIO TROCAR
JWT_SECRET=<node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">

# Servidor
PORT=3001
NODE_ENV=production

# CORS — domínio da aplicação
CORS_ORIGIN=https://gestor.suaempresa.com

# WhatsApp (opcional)
EVOLUTION_API_URL=https://evo.suaempresa.com
EVOLUTION_API_KEY=<sua_api_key>
WEBHOOK_BASE_URL=https://gestor.suaempresa.com

# E-mail (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@suaempresa.com
SMTP_PASS=<senha_de_app>
SMTP_FROM="CenterFlow <noreply@suaempresa.com>"
VERIFY_CODE_TTL_MIN=15

# SMS (opcional)
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_FROM=+5511999999999
```

---

## 14. Verificações Pós-Deploy

```bash
# Health check
curl https://gestor.suaempresa.com/api/health
# {"ok":true}

# Status
curl https://gestor.suaempresa.com/api/status
# {"online":true,"version":"2.0","port":"3001"}

# Logs sem erros
pm2 logs gestor-back --lines 50

# PostgreSQL acessível
node /opt/gestorfinanceiro/check-db.mjs

# Frontend carregando
curl -I https://gestor.suaempresa.com/
# HTTP/2 200
```

---

## 15. Troubleshooting de Deploy

### Nginx 502 Bad Gateway
```bash
# Backend não está rodando
pm2 status
pm2 restart gestor-back

# Ou porta errada
curl http://localhost:3001/api/health
```

### "Cannot find module"
```bash
# node_modules não instalado
cd /opt/gestorfinanceiro && npm ci
```

### Build falha
```bash
npm run lint        # verificar erros de ESLint
npm run build 2>&1  # ver erro completo
```

### Banco não conecta
```bash
# Verificar se PostgreSQL está rodando
systemctl status postgresql

# Testar conexão
psql postgresql://gestor:gestor123@localhost:5432/gestor_db -c "SELECT 1;"
```

### Migrations não rodam automaticamente
```bash
# Rodar manualmente
node /opt/gestorfinanceiro/server/migrate.js
```

### PM2 não inicia após reboot
```bash
# Verificar startup
pm2 startup
# executar o comando gerado
pm2 save
```
