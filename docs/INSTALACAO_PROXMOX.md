# Manual de instalação — Gestor Financeiro no Proxmox (LXC)

Este guia instala o **Gestor Financeiro** em um **container LXC** no Proxmox, com frontend em produção (Nginx) e API Node.js.  
Repositório: https://github.com/tecnocell-cell/gestorfinanceiro

**Autor:** Gianderson F J. · giandersonfjs@gmail.com · +55 94 98140-6316

---

## 1. Visão geral da arquitetura

```
[ Navegador ]
      │
      ▼
[ Nginx :80 / :443 ]  ──► arquivos estáticos (pasta dist/)
      │
      └── /api/*  ──► proxy ──► [ Node.js API :3001 ]
```

| Componente | Função |
|------------|--------|
| **Frontend** | React compilado (`npm run build` → `dist/`) |
| **API** | Express em `server/index.js` (status + sync Access) |
| **Dados no browser** | `localStorage` (padrão atual) |

> **Importante — Microsoft Access:** o driver ODBC do Access **não roda em Linux**. No container você terá o painel completo; a sincronização direta com `.accdb` exige **Windows** (PC, VM ou outro container Windows). Veja a seção [12](#12-sincronização-com-access-no-proxmox).

---

## 2. Requisitos no Proxmox

### Container LXC recomendado

| Item | Mínimo | Recomendado |
|------|--------|-------------|
| SO template | Debian 12 ou Ubuntu 22.04 | Debian 12 |
| RAM | 1 GB | 2 GB |
| CPU | 1 vCPU | 2 vCPU |
| Disco | 10 GB | 20 GB |
| Rede | bridge (vmbr0) | IP fixo na LAN |

### Checklist no Proxmox (antes de entrar no container)

1. Criar CT → escolher template **Debian 12** ou **Ubuntu 22.04**.
2. Marcar **Unprivileged container** (padrão seguro).
3. Habilitar **Nesting** se for usar Docker depois (opcional):  
   `Options` → `Features` → `nesting=1`
4. Anotar IP, gateway e DNS.
5. (Opcional) Reservar IP no roteador (DHCP estático).

---

## 3. Preparar o container (primeiro acesso)

Entre no container como `root`:

```bash
apt update && apt upgrade -y
apt install -y curl git ca-certificates gnupg nginx ufw
```

### 3.1 Usuário da aplicação (recomendado)

```bash
adduser --disabled-password --gecos "" gestor
usermod -aG sudo gestor   # opcional; em produção pode omitir sudo
```

### 3.2 Node.js 20 LTS

**Debian / Ubuntu:**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v    # deve mostrar v20.x
npm -v
```

### 3.3 Firewall básico

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

---

## 4. Clonar o projeto

```bash
mkdir -p /opt/gestorfinanceiro
cd /opt/gestorfinanceiro
git clone https://github.com/tecnocell-cell/gestorfinanceiro.git .
chown -R gestor:gestor /opt/gestorfinanceiro
```

Como usuário `gestor`:

```bash
su - gestor
cd /opt/gestorfinanceiro
npm ci
npm run build
```

Se `npm ci` falhar, use `npm install`.

---

## 5. Variáveis de ambiente (API)

Crie o arquivo de ambiente:

```bash
sudo nano /opt/gestorfinanceiro/.env
```

Conteúdo sugerido (copie de `.env.example`):

```env
PORT=3001
NODE_ENV=production
# CORS_ORIGIN=https://gestor.suaempresa.local
```

> O código atual da API usa porta fixa `3001` em `server/index.js`. Para produção avançada, adapte o servidor para ler `process.env.PORT`.

Proteja o arquivo:

```bash
chmod 600 /opt/gestorfinanceiro/.env
chown gestor:gestor /opt/gestorfinanceiro/.env
```

---

## 6. Serviço systemd (API Node)

Copie o exemplo e ajuste:

```bash
sudo cp /opt/gestorfinanceiro/deploy/gestor-api.service.example /etc/systemd/system/gestor-api.service
sudo systemctl daemon-reload
sudo systemctl enable gestor-api
sudo systemctl start gestor-api
sudo systemctl status gestor-api
```

Logs:

```bash
journalctl -u gestor-api -f
```

Teste local:

```bash
curl http://127.0.0.1:3001/api/status
```

Resposta esperada: `{"online":true,...}`

---

## 7. Nginx (frontend + proxy da API)

```bash
sudo cp /opt/gestorfinanceiro/deploy/nginx-gestor.conf.example /etc/nginx/sites-available/gestorfinanceiro
sudo ln -sf /etc/nginx/sites-available/gestorfinanceiro /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

Edite o `server_name` e caminhos:

```bash
sudo nano /etc/nginx/sites-available/gestorfinanceiro
```

Teste e recarregue:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Acesse no navegador: `http://IP_DO_CONTAINER/`

---

## 8. HTTPS (recomendado em produção)

### Opção A — Certificado na rede interna (mkcert / CA interna)

Para uso só na LAN, use certificado da sua CA ou [mkcert](https://github.com/FiloSottile/mkcert).

### Opção B — Let's Encrypt (se tiver domínio público)

```bash
apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d gestor.suaempresa.com.br
```

Renovação automática já é configurada pelo certbot.

---

## 9. Atualizar após mudanças no GitHub

```bash
cd /opt/gestorfinanceiro
git pull origin main
npm ci
npm run build
sudo systemctl restart gestor-api
sudo systemctl reload nginx
```

Script opcional `deploy/update.sh` (crie se quiser automatizar):

```bash
#!/bin/bash
set -e
cd /opt/gestorfinanceiro
git pull
npm ci
npm run build
systemctl restart gestor-api
systemctl reload nginx
echo "Deploy concluído."
```

---

## 10. Backup

| O quê | Onde | Frequência |
|-------|------|------------|
| Código | `/opt/gestorfinanceiro` | A cada deploy (Git) |
| Dados dos usuários | `localStorage` no navegador de cada PC | Export JSON pela tela Importações |
| Banco Access | Arquivo `.accdb` no Windows/servidor Lacus | Backup do arquivo + snapshot Proxmox |

**Snapshot Proxmox:** agende snapshot semanal do CT após instalação estável.

**Export manual no app:** menu **Importações** → exportar JSON periodicamente.

---

## 11. Monitoramento básico

```bash
# API viva?
curl -sf http://127.0.0.1:3001/api/status || echo "API OFF"

# Nginx
systemctl is-active nginx

# Espaço em disco
df -h /opt/gestorfinanceiro
```

---

## 12. Sincronização com Access no Proxmox

| Cenário | Solução |
|---------|---------|
| Painel web na LAN | Container Linux (este guia) ✅ |
| Ler `.accdb` Lacus direto | **VM/container Windows** com driver Access + API, ou PC Windows na rede |
| Sem Windows | Importar XLSX/JSON/OFX pelo navegador ✅ |

**Arquitetura híbrida sugerida:**

```
[ CT Linux ]  Gestor Web (Nginx + Node)
       ▲
       │ HTTP /api/sync (rede interna)
       │
[ VM Windows ]  API + ODBC + pasta compartilhada com .accdb
```

No Windows, clone o mesmo repositório, rode apenas `npm run server` e aponte o frontend (em Empresa/Banco) para `http://IP_WINDOWS:3001`.

---

## 13. Solução de problemas

| Problema | Causa provável | Ação |
|----------|----------------|------|
| Página em branco | Build não feito | `npm run build` |
| 502 Bad Gateway | API parada | `systemctl restart gestor-api` |
| `/api` não responde | Proxy Nginx | Conferir `location /api` no nginx |
| Sync Access falha no Linux | Sem driver MDB | Usar VM Windows ou importação manual |
| `npm ci` erro de permissão | Dono errado | `chown -R gestor:gestor /opt/gestorfinanceiro` |
| Porta 3001 em uso | Processo duplicado | `ss -tlnp \| grep 3001` |

---

## 14. Checklist final

- [ ] Container com IP fixo na LAN
- [ ] `npm run build` sem erros
- [ ] `gestor-api` ativo (`systemctl status`)
- [ ] Nginx servindo `dist/` e proxy `/api`
- [ ] Firewall liberado (80/443)
- [ ] HTTPS configurado (se exposto)
- [ ] Snapshot Proxmox criado
- [ ] Procedimento de backup/export documentado para usuários

---

## 15. Comandos rápidos (cola)

```bash
# Instalação resumida (root no CT Debian 12)
apt update && apt install -y curl git nginx ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
git clone https://github.com/tecnocell-cell/gestorfinanceiro.git /opt/gestorfinanceiro
cd /opt/gestorfinanceiro && npm ci && npm run build
cp deploy/gestor-api.service.example /etc/systemd/system/gestor-api.service
cp deploy/nginx-gestor.conf.example /etc/nginx/sites-available/gestorfinanceiro
ln -sf /etc/nginx/sites-available/gestorfinanceiro /etc/nginx/sites-enabled/default
systemctl daemon-reload && systemctl enable --now gestor-api nginx
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
```

---

*Documento gerado para o projeto Gestor Financeiro — Tecnocell / Gianderson F J.*
