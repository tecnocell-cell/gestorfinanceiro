# WhatsApp Financeiro — Checkpoint (27/05/2026)

Documento para retomar o trabalho. Branch: `main` · Último commit relevante: `8d1f994`.

---

## Onde estamos

| Item | Status |
|------|--------|
| Tabelas `whatsapp_sessions` / `whatsapp_pending` (migration 005) | ✅ No repo |
| API: connect, status, qrcode, disconnect, webhook | ✅ Implementado |
| Frontend: página WhatsApp + hook `useWhatsApp` | ✅ Implementado |
| Webhook autenticado (header `X-CenterFlow-Webhook-Secret`) | ✅ Funciona (`auth ok via header`) |
| QR code exibido e escaneável no app | ❌ **Bloqueado pela Evolution** |
| Produção (servidor Financeiro) | ⚠️ Precisa `git pull` até `8d1f994` + `npm run build` |

---

## Sintoma atual (logs de 27/05)

1. Usuário clica **Conectar WhatsApp** → tela fica em **"Carregando QR…"**.
2. Backend salva sessão: `[whatsapp/connect] sessao salva: cf-{usuario_id}`.
3. `createInstance` OK, mas `qrcode` da resposta só tem `{ count }` — **sem PNG/código**.
4. `hash` (36 chars) é **ID da instância**, não pairing do WhatsApp — **não usar como QR**.
5. Webhook recebe só **`CONNECTION_UPDATE`**, nunca **`QRCODE_UPDATED`**.
6. Loop Evolution: `connecting` (statusReason **200**) → `close` (statusReason **405** ou **401**).
7. `GET /instance/connect` e `fetchInstances` na v2.1.1 retornam `{ count }` ou lista sem campo QR.

### Significado provável dos `statusReason`

| Código | Interpretação (Baileys/Evolution) |
|--------|-----------------------------------|
| **200** | Tentativa de conexão em andamento |
| **405** | Falha na conexão / método ou versão WhatsApp Web incompatível |
| **401** | Não autorizado / sessão rejeitada pelo WhatsApp |

Isso aponta para **problema na Evolution (versão/config)**, não no CenterFlow.

---

## O que já foi corrigido no código (CenterFlow)

1. Sessão salva **antes** de chamar Evolution (webhook encontra registro).
2. Webhook aceita secret por **header** (Evolution não repassa `?secret=`).
3. Não gera QR falso a partir do `hash` UUID.
4. Poll do frontend **não** chama mais `/instance/connect` em loop (evitava derrubar sessão).
5. `close` transitório não zera mais o timeout (bug do `updated_at` corrigido em `8d1f994`).
6. Timeout 2 min sem QR → mensagem na UI + `disconnected`.
7. 404 na Evolution → limpa sessão local (sem spam de log).

### Commits principais (ordem)

```
c140796 feat: add whatsapp finance tables
0540428 feat: add whatsapp connection qr flow
2d3096e fix: save whatsapp session before qr webhook
0e9a943 fix: reject fake hash qr + webhook auth header
81642c8 fix: stop connect polling loop
de17a5f fix: evolution 404 stale session
8d1f994 fix: qr wait timeout + webhook close loop
```

---

## Variáveis de ambiente (CenterFlow `.env`)

```env
EVOLUTION_API_URL=https://...      # URL base da Evolution (sem barra final)
EVOLUTION_API_KEY=...              # Global API Key
WEBHOOK_BASE_URL=https://...       # URL pública do CenterFlow (nginx → :3001)
```

Sem `WEBHOOK_BASE_URL`, o connect retorna 503.

---

## Próximos passos (amanhã)

### 1. Deploy no servidor (obrigatório)

```bash
cd /root/gestorfinanceiro
git pull origin main
git log -1 --oneline   # deve ser 8d1f994 ou mais novo
npm install
npm run build
pm2 restart gestor-back --update-env
```

Limpar sessão antiga antes de testar:

```bash
sudo -u postgres psql gestor_db -c "DELETE FROM whatsapp_sessions;"
```

### 2. Evolution API (causa raiz do QR)

- [ ] **Atualizar imagem** para `v2.3.7+` (v2.1.1 tem bug conhecido: `/connect` só retorna `{ count }`).
- [ ] No `docker-compose` da Evolution:
  - `SERVER_URL` = URL pública da Evolution
  - `CONFIG_SESSION_PHONE_VERSION` = versão recente ([wppconnect.io/whatsapp-versions](https://wppconnect.io/pt-BR/whatsapp-versions/))
  - `CONFIG_SESSION_PHONE_CLIENT=Chrome`
- [ ] Testar QR no **Manager** da Evolution; se não aparecer lá, o CenterFlow também não receberá.
- [ ] Após conectar no Manager, testar de novo pelo CenterFlow.

### 3. Validar webhook

```bash
# Deve bater com WEBHOOK_BASE_URL do CenterFlow
curl -I "https://SEU_DOMINIO/api/whatsapp/webhook/cf-TESTE?secret=test"
```

Logs esperados após fix da Evolution:

```
[whatsapp/webhook] QRCODE_UPDATED via header: cf-...
[whatsapp/webhook] QR atualizado: cf-...
```

### 4. Se `statusReason 405/401` continuar

- Conferir logs `disconnectionReasonCode` em `fetchInstances`.
- Ver issue Evolution: [#2385](https://github.com/EvolutionAPI/evolution-api/issues/2385), [#2430](https://github.com/EvolutionAPI/evolution-api/issues/2430).

### 5. Código (só se Evolution v2.3.7+ enviar QR)

- [ ] Confirmar evento `QRCODE_UPDATED` no webhook após upgrade.
- [ ] Logar `connectionStatus` de `fetchInstances` uma vez (já lista keys).
- [ ] Fase 3+: mensagens, confirmação, `whatsapp_pending` (ainda não implementado).

---

## Arquivos principais

| Arquivo | Função |
|---------|--------|
| `server/routes/whatsapp.js` | Rotas + webhook + extração QR |
| `server/whatsapp/evolutionProvider.js` | Cliente Evolution API |
| `server/migrations/005_whatsapp_tables.sql` | Schema |
| `src/gestor/hooks/useWhatsApp.js` | Poll status/QR no frontend |
| `src/gestor/pages/WhatsAppPage.jsx` | UI QR / conectar / desconectar |
| `plano-whatsapp-centerflow.docx` | Plano do módulo (7 fases) |

---

## Teste rápido amanhã

1. `pm2 logs gestor-back` — limpar error.log antigo se confundir (`directConnect` no `/qrcode` é **código velho**).
2. App → WhatsApp → **Conectar**.
3. Aguardar até 2 min → deve aparecer **mensagem de erro** (timeout) ou **QR** (se Evolution OK).
4. Enviar trecho de log com: `statusReason`, `QRCODE_UPDATED` (se houver), versão da imagem Docker Evolution.

---

*Atualizado: 27/05/2026 — sessão de debug QR com instância `cf-9206ff38-cfb7-4b32-9235-79c4ca41302a` (usuário Fábio).*
