# HARDENING — WhatsApp Gateway (Fase 2.5)
> Guia operacional de produção para CT103 (WhatsApp-Gateway) e CT111 (CenterFlow Financeiro).
> Baseado na arquitetura real: CT111 → Gateway CT103 (Baileys) → WhatsApp

---

## 4. Segurança da Pasta `sessions/`

As credenciais Baileys em `sessions/` são equivalentes a uma sessão WhatsApp autenticada.
Acesso não autorizado = acesso à conta WhatsApp de todos os tenants.

### Permissões corretas (rodar no CT103)

```bash
# Usuário dedicado para o Gateway (se ainda não existe)
sudo adduser --system --group --no-create-home wppgateway

# Ajusta dono dos arquivos da aplicação
sudo chown -R wppgateway:wppgateway /opt/whatsapp-gateway

# sessions/: apenas o dono lê/escreve
chmod 700 /opt/whatsapp-gateway/sessions
find /opt/whatsapp-gateway/sessions -type d -exec chmod 700 {} \;
find /opt/whatsapp-gateway/sessions -type f -exec chmod 600 {} \;

# backups/: idem
chmod 700 /opt/whatsapp-gateway/backups 2>/dev/null || true

# .env: só o dono lê
chmod 600 /opt/whatsapp-gateway/.env

# Verifica resultado
ls -la /opt/whatsapp-gateway/
ls -la /opt/whatsapp-gateway/sessions/
```

### Verificar que a porta 8081 NÃO está exposta para a internet

```bash
# No CT103 — deve mostrar ONLY conexões internas (IP da rede Proxmox)
ss -tlnp | grep 8081

# Se usando UFW no CT103
sudo ufw status
# Esperado: porta 8081 bloqueada para exterior, liberada só para CT111

# Regra UFW para liberar apenas CT111 (substitua IP_CT111 pelo IP real)
sudo ufw allow from IP_CT111 to any port 8081
sudo ufw deny 8081
```

### Variáveis sensíveis no .env do Gateway

```bash
# /opt/whatsapp-gateway/.env
PORT=8081
API_KEY=<chave-forte-32-chars-minimo>   # NUNCA deixar vazio
SESSIONS_DIR=/opt/whatsapp-gateway/sessions
```

> ⚠️ Se `API_KEY` não estiver definida no .env, **toda requisição retorna 401** (comportamento intencional do código).
> Confirmar com: `grep API_KEY /opt/whatsapp-gateway/.env`

---

## 5. Verificação e Instalação do Supervisor (systemd)

### Instalar o service

```bash
# Copiar o service file do repositório
sudo cp /opt/whatsapp-gateway/whatsapp-gateway.service /etc/systemd/system/

# Recarregar systemd
sudo systemctl daemon-reload

# Habilitar para iniciar no boot
sudo systemctl enable whatsapp-gateway

# Iniciar agora
sudo systemctl start whatsapp-gateway
```

### Verificar que está rodando com Restart=always

```bash
# Status atual
sudo systemctl status whatsapp-gateway

# Confirmar Restart=always
sudo systemctl cat whatsapp-gateway | grep Restart

# Ver logs em tempo real
sudo journalctl -u whatsapp-gateway -f

# Ver últimas 100 linhas
sudo journalctl -u whatsapp-gateway -n 100 --no-pager

# Testar restart automático (simula crash)
sudo kill -9 $(systemctl show -p MainPID whatsapp-gateway | cut -d= -f2)
sleep 5
sudo systemctl status whatsapp-gateway   # deve mostrar "active (running)"
```

### Confirmar que sobrevive a reboot

```bash
sudo reboot
# Após reboot:
sudo systemctl status whatsapp-gateway
# Deve mostrar "active (running)" sem intervenção manual
```

### Limites de restart

O service tem `StartLimitBurst=5` em 60s. Se o processo crashar 5× em 1 minuto,
o systemd para de tentar e entra em "failed". Para resetar:

```bash
sudo systemctl reset-failed whatsapp-gateway
sudo systemctl start whatsapp-gateway
```

---

## 6. Auditoria de Memória do Gateway

### Medir consumo por instância

```bash
# Memória total do processo Node.js do Gateway
ps aux | grep "node server.js" | grep -v grep | awk '{print $4"% CPU  "$6"KB RAM  PID="$2}'

# Breakdown detalhado (RSS = memória real usada)
cat /proc/$(systemctl show -p MainPID whatsapp-gateway | cut -d= -f2)/status | grep -E "VmRSS|VmPeak|VmSize"

# Monitorar em tempo real
watch -n 5 'ps aux | grep "node server.js" | grep -v grep | awk "{print \$6/1024 \" MB\"}"'

# Com pmemory (mais detalhado)
sudo apt install -y nodejs-dev 2>/dev/null; node -e "
const { execSync } = require('child_process');
const pid = parseInt(execSync('systemctl show -p MainPID whatsapp-gateway').toString().split('=')[1]);
const mem = parseInt(execSync('cat /proc/'+pid+'/status').toString().match(/VmRSS:\\s+(\\d+)/)[1]);
console.log('RAM usada pelo Gateway:', (mem/1024).toFixed(1), 'MB');
" 2>/dev/null || echo "Use: ps aux | grep 'node server.js'"
```

### Estimativa de consumo por tenant

| Tenants conectados | RAM estimada (Gateway) |
|---|---|
| 1–10 | ~80–150 MB |
| 10–50 | ~150–350 MB |
| 50–100 | ~350–600 MB |
| 100–200 | ~600 MB–1 GB |

> Cada instância Baileys mantém ~5–15 MB de estado em memória (WebSocket aberto + buffers de mensagem).
> O processo Node.js tem overhead base de ~50–80 MB.

### Quando escalar CT103

```
Regra prática:
- RAM CT103 ≥ 1 GB: aguenta ~80 tenants ativos com folga
- RAM CT103 ≥ 2 GB: aguenta ~200 tenants ativos com folga
- RAM CT103 ≥ 4 GB: ≥500 tenants (neste ponto, avaliar sharding)

Sinais de alerta:
- `free -h` mostrando < 200 MB disponível consistentemente
- Processo Gateway sendo SIGKILL por OOM (ver: dmesg | grep -i killed)
- Latência de GET /health > 2s
- Logs de "JavaScript heap out of memory"
```

### Comandos de monitoramento rápido

```bash
# Memória livre do servidor
free -h

# Top processos por memória
ps aux --sort=-%mem | head -10

# OOM killer (se Gateway está morrendo sem motivo)
dmesg | grep -i "killed process" | tail -20
journalctl -k | grep -i "out of memory" | tail -10

# Disco usado por sessions/
du -sh /opt/whatsapp-gateway/sessions/
du -sh /opt/whatsapp-gateway/sessions/*/   # por instância
```

---

## 7. Estratégia de Crescimento

### Até onde a arquitetura atual aguenta

```
Arquitetura atual (CT111 → CT103 único):

  50 tenants ativos:   ✅ sem problema, RAM ~200 MB no Gateway
 100 tenants ativos:   ✅ ok com 1 GB RAM no CT103
 200 tenants ativos:   ⚠️  avaliar RAM, monitorar heap
 500 tenants ativos:   ⚠️  CT103 precisa de 2-4 GB RAM
1000 tenants ativos:   🔴 considerar sharding horizontal (2+ Gateways)
```

### Quando separar outro CT103

**Nunca antes de atingir 300-400 tenants simultâneos com problemas reais de RAM ou latência.**

Sinais concretos para agir:
- `free -h` no CT103 mostrando < 10% livre por horas seguidas
- Health check GET /health retornando > 3s
- Logs de SIGKILL / OOM killer
- Mais de 2 crashes/dia por causa de memória

### Estratégia de sharding simples (quando chegar a hora)

**Não usar service discovery, não usar Redis, não usar load balancer complexo.**

O sharding correto para este projeto é por `usuarioId`:

```javascript
// No Financeiro (CT111): determinístico por usuário
function getGatewayUrl(usuarioId) {
  // Sharding simples por paridade do ID
  // Sem estado externo, sem Redis, sem service registry
  const gateways = [
    process.env.EVOLUTION_API_URL_0,  // http://CT103a:8081
    process.env.EVOLUTION_API_URL_1,  // http://CT103b:8081
  ];
  // UUID → hash numérico simples
  const hash = usuarioId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return gateways[hash % gateways.length];
}
```

Quando shardear, CADA Gateway tem sua própria pasta `sessions/` independente.
Não há sessão compartilhada entre Gateways — usuário sempre vai para o mesmo Gateway
por ser determinístico.

### Quando NÃO shardear

- Problemas de latência que não são de RAM (investigar primeiro: rede, banco, Baileys)
- "Futuro escalabilidade" sem métricas reais de hoje
- Menos de 100 tenants ativos

---

## 8. Logs e Observabilidade Mínima

### Logs do Gateway via journalctl

```bash
# Tempo real
sudo journalctl -u whatsapp-gateway -f

# Últimas 200 linhas
sudo journalctl -u whatsapp-gateway -n 200 --no-pager

# Filtrar por instância (grep por nome do tenant)
sudo journalctl -u whatsapp-gateway -n 500 --no-pager | grep "cf-UUID-DO-USUARIO"

# Só erros
sudo journalctl -u whatsapp-gateway -p err --no-pager -n 100

# Por período
sudo journalctl -u whatsapp-gateway --since "2024-01-15 00:00" --until "2024-01-15 23:59"
```

### Padrões de log que indicam problema

```bash
# Instância em loop de reconexão (normal até 3x, problema se > 10x seguidas)
sudo journalctl -u whatsapp-gateway -n 200 | grep "desconexao transitória" | wc -l

# Webhooks falhando (CT103 não consegue chegar no CT111)
sudo journalctl -u whatsapp-gateway -n 200 | grep "erro webhook"

# Instâncias que foram deslogadas (usuário usou WhatsApp em outro dispositivo)
sudo journalctl -u whatsapp-gateway -n 200 | grep "loggedOut\|close code=401"

# Gateway reiniciando muito (indica crash em loop)
sudo journalctl -u whatsapp-gateway --since "1 hour ago" | grep "Restaurando"
```

### Logs do Financeiro (CT111 via PM2)

```bash
pm2 logs gestor-back --lines 200
pm2 logs gestor-back --lines 500 | grep "\[whatsapp"

# Só erros de WhatsApp
pm2 logs gestor-back --lines 1000 | grep "\[whatsapp" | grep -i "erro\|error\|fail\|timeout"

# Health check do Gateway (ver se está sendo chamado e respondendo)
pm2 logs gestor-back --lines 500 | grep "gateway-health"
```

### Script de health check manual rápido

```bash
# Salvar como /opt/gestorfinanceiro/scripts/wpp-check.sh no CT111
#!/bin/bash
GATEWAY_URL="${EVOLUTION_API_URL:-http://CT103:8081}"
GATEWAY_KEY="${EVOLUTION_API_KEY}"

echo "=== WhatsApp Gateway Health ==="
RESULT=$(curl -sf -H "apikey: $GATEWAY_KEY" "$GATEWAY_URL/health" 2>&1)
if [ $? -eq 0 ]; then
  echo "✅ Gateway OK: $RESULT"
else
  echo "❌ Gateway INDISPONÍVEL: $RESULT"
fi

echo ""
echo "=== Sessões ativas ==="
curl -sf -H "apikey: $GATEWAY_KEY" "$GATEWAY_URL/instance/fetchInstances" 2>/dev/null | \
  python3 -c "import sys,json; data=json.load(sys.stdin); print(f'{len(data)} instância(s) encontrada(s)')" 2>/dev/null || \
  echo "(não foi possível listar)"
```

### Alertas sem ferramentas externas

Adicione este cron no CT103 para alerta por e-mail se o Gateway cair:

```bash
# Crontab CT103 (crontab -e)
# Verifica a cada 5 minutos — envia e-mail se o processo parou
*/5 * * * * systemctl is-active --quiet whatsapp-gateway || echo "ALERTA: whatsapp-gateway parou em $(hostname) às $(date)" | mail -s "[CenterFlow] Gateway WhatsApp OFFLINE" admin@suaempresa.com
```

---

## 9. Checklist Final de Produção

### SEGURANÇA
```
[_] .env do Gateway: API_KEY definida e forte (≥32 chars)
[_] Porta 8081 bloqueada para internet — só CT111 tem acesso
[_] sessions/ com chmod 700, arquivos com chmod 600
[_] .env do Gateway com chmod 600
[_] Usuário dedicado wppgateway (não rodar como root)
[_] WEBHOOK_BASE_URL definida no CT111 (sem barra final)
[_] EVOLUTION_API_URL = http://IP_CT103:8081 (IP interno, não domínio público)
```

### BACKUP
```
[_] Script backup-sessions.sh copiado para /opt/whatsapp-gateway/scripts/
[_] Cron configurado: 0 3 * * * com >> /var/log/wpp-backup.log
[_] Diretório backups/ existe e tem espaço disponível
[_] Testou restore-sessions.sh ao menos uma vez manualmente
[_] Rotina de verificar /var/log/wpp-backup.log a cada semana
[_] Backup do gestor_db (CT111) configurado separadamente
```

### RESTORE (testar antes de precisar)
```
[_] Parar Gateway: sudo systemctl stop whatsapp-gateway
[_] Rodar restore: bash restore-sessions.sh <arquivo>
[_] Iniciar Gateway: sudo systemctl start whatsapp-gateway
[_] Verificar logs: journalctl -u whatsapp-gateway -f
[_] Confirmar reconexão automática sem novo QR (em até 2 min)
```

### DEPLOY / UPDATE DO GATEWAY (CT103)
```
[_] Fazer backup ANTES do update: bash backup-sessions.sh
[_] Parar Gateway: sudo systemctl stop whatsapp-gateway
[_] Pull do código: cd /opt/whatsapp-gateway && git pull origin main
[_] Instalar dependências: npm ci
[_] Iniciar Gateway: sudo systemctl start whatsapp-gateway
[_] Verificar logs por 2 min: journalctl -u whatsapp-gateway -f
[_] Confirmar sessões restauradas: curl -H "apikey: KEY" http://localhost:8081/health
```

### DEPLOY / UPDATE DO FINANCEIRO (CT111)
```
[_] cd /opt/gestorfinanceiro && git pull origin main
[_] npm ci
[_] npm run build
[_] pm2 restart gestor-back --update-env
[_] Verificar: curl http://localhost:3001/api/health
[_] Gateway NÃO precisa ser reiniciado — é independente
```

### ROLLBACK DO GATEWAY
```
[_] Parar: sudo systemctl stop whatsapp-gateway
[_] Voltar código: git checkout <tag-anterior>
[_] npm ci (se package.json mudou)
[_] Iniciar: sudo systemctl start whatsapp-gateway
[_] sessions/ NÃO precisa de rollback — são independentes de versão
```

### ROLLBACK DO FINANCEIRO
```
[_] git checkout <tag-anterior>
[_] npm ci && npm run build
[_] pm2 restart gestor-back --update-env
[_] Se migration nova foi aplicada: reverter SQL manualmente
[_] EVOLUTION_API_URL e EVOLUTION_API_KEY não mudam no rollback
```

### OBSERVABILIDADE
```
[_] sudo journalctl -u whatsapp-gateway -n 100 — sem "erro webhook" em volume
[_] pm2 logs gestor-back --lines 100 — sem timeouts em [whatsapp]
[_] free -h no CT103 — RAM livre > 20% do total
[_] df -h no CT103 — disco > 20% livre (sessions/ cresce com tempo)
[_] curl -H "apikey: KEY" http://CT103:8081/health — resposta < 1s
```

### RECOVERY (após queda inesperada)
```
Cenário: CT103 caiu / foi reiniciado
[_] sudo systemctl status whatsapp-gateway — verificar se subiu automaticamente
[_] journalctl -u whatsapp-gateway -n 50 — ver "Restaurando N sessão(ões)"
[_] Aguardar 1-2 min — Baileys reconecta automaticamente (sem novo QR)
[_] Se não reconectou: verificar conectividade de rede com WhatsApp

Cenário: sessions/ corrompida / apagada acidentalmente
[_] sudo systemctl stop whatsapp-gateway
[_] bash restore-sessions.sh <último-backup>
[_] sudo systemctl start whatsapp-gateway
[_] Tenants precisarão fazer novo QR scan apenas se credenciais expiraram

Cenário: CT111 caiu, Gateway continua
[_] Gateway opera independentemente — sessões permanecem ativas
[_] Webhooks falham (CT111 inacessível) — Gateway loga "erro webhook"
[_] Ao restaurar CT111: estado sincroniza na próxima ação do tenant

Cenário: Loop de reconexão (close → connecting → close)
[_] journalctl -u whatsapp-gateway -n 100 | grep "close code"
[_] Código 401 (loggedOut): tenant abriu WhatsApp em outro dispositivo — normal
[_] Código 515 em loop: problema de rede/servidor WhatsApp — aguardar
[_] Código 428 persistente: reiniciar instância via DELETE + POST no Financeiro
```

### UPGRADE DO NODE.JS / SISTEMA
```
[_] Antes de qualquer upgrade: backup-sessions.sh
[_] Testar em ambiente separado primeiro
[_] O Gateway usa apenas Node.js 20+ (ESM) — verificar compatibilidade
[_] Baileys ^7.x requer Node.js >= 18
```

---

## Setup rápido de cron no CT103

```bash
# Abrir crontab do usuário wppgateway (ou root)
sudo crontab -u wppgateway -e

# Adicionar estas linhas:
# Backup diário às 3h da manhã
0 3 * * * /opt/whatsapp-gateway/scripts/backup-sessions.sh >> /var/log/wpp-backup.log 2>&1

# Verificação a cada 5 min (alerta por e-mail se Gateway parou)
# Substitua admin@suaempresa.com pelo e-mail real:
*/5 * * * * systemctl is-active --quiet whatsapp-gateway || echo "Gateway parou: $(date)" | mail -s "[CenterFlow] Gateway OFFLINE" admin@suaempresa.com 2>/dev/null
```

---

## Comandos de referência rápida

```bash
# ── CT103 ─────────────────────────────────────────────────────────────────────
sudo systemctl status whatsapp-gateway          # status
sudo systemctl restart whatsapp-gateway         # restart
sudo journalctl -u whatsapp-gateway -f          # logs ao vivo
du -sh /opt/whatsapp-gateway/sessions/          # tamanho das sessões
free -h                                         # memória disponível
bash /opt/whatsapp-gateway/scripts/backup-sessions.sh  # backup manual

# ── CT111 ─────────────────────────────────────────────────────────────────────
pm2 status                                      # status dos processos
pm2 logs gestor-back --lines 100                # logs recentes
pm2 restart gestor-back --update-env            # restart com novo .env
curl http://localhost:3001/api/health           # health do Financeiro

# ── Health check completo (rodar no CT111) ────────────────────────────────────
curl http://localhost:3001/api/health && \
  curl -H "apikey: $EVOLUTION_API_KEY" $EVOLUTION_API_URL/health
```
