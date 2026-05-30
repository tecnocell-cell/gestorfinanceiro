# FLUXO WHATSAPP — CenterFlow Financeiro
> Documentação técnica completa do módulo WhatsApp Financeiro.
> Última atualização do código: commit `8d1f994` (27/05/2026).

---

## 1. Visão Geral

O módulo WhatsApp Financeiro permite ao tenant conectar seu número de WhatsApp ao CenterFlow e, futuramente, registrar lançamentos via mensagem. A integração usa a **Evolution API v2** self-hosted como bridge.

**Status atual (2026-05-27):**
- Infraestrutura (tabelas, API, webhook, UI): ✅ Implementado
- QR Code exibido no app: ⚠️ Bloqueado por bug na Evolution v2.1.1
- Recebimento de mensagens / confirmação: 🔲 Fase 3+ (roadmap)

---

## 2. Arquivos do Módulo

| Arquivo | Função |
|---|---|
| `server/routes/whatsapp.js` | Rotas REST + lógica de webhook + extração de QR |
| `server/whatsapp/evolutionProvider.js` | Cliente HTTP para a Evolution API |
| `server/migrations/005_whatsapp_tables.sql` | Schema das tabelas WhatsApp |
| `src/gestor/hooks/useWhatsApp.js` | Hook React para polling de status/QR |
| `src/gestor/pages/WhatsAppPage.jsx` | Página de conexão (UI) |
| `docs/WHATSAPP_CHECKPOINT.md` | Log de debug e próximos passos |

---

## 3. Tabelas do Banco

### `whatsapp_sessions`
Armazena a sessão WhatsApp por tenant (máximo 1 por usuário).

```sql
CREATE TABLE whatsapp_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  instance_name  TEXT NOT NULL UNIQUE,   -- convenção: cf-{usuario_id}
  phone_number   TEXT,                   -- NULL até conectar; ex: 5511999999999
  status         TEXT NOT NULL DEFAULT 'disconnected'
                 CHECK (status IN ('disconnected', 'connecting', 'connected')),
  qrcode_base64  TEXT,                   -- NULL após conexão
  webhook_secret TEXT NOT NULL,          -- crypto.randomBytes(32).hex por instância
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `whatsapp_pending`
Lançamentos aguardando confirmação do usuário via WhatsApp (Fase 3+).

```sql
CREATE TABLE whatsapp_pending (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  from_number    TEXT NOT NULL,          -- validação de origem (só o dono responde)
  payload        JSONB NOT NULL,         -- objeto do lançamento pronto para gravação
  tipo_criacao   TEXT NOT NULL
                 CHECK (tipo_criacao IN ('avulso', 'recorrencia')),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Regras `whatsapp_pending`:**
- Máximo 1 pendente ativo por tenant (DELETE + INSERT ao criar novo)
- Expira em 24 horas — descartado silenciosamente
- Após confirmação: DELETE imediato para evitar dupla gravação
- `payload.tipo` para lançamento avulso: `"Entrada"` | `"Saida"`
- `payload.tipo` para recorrência: `"Receita"` | `"Despesa"`

---

## 4. Variáveis de Ambiente Necessárias

```env
EVOLUTION_API_URL=https://evo.suaempresa.com   # URL base (sem barra final)
EVOLUTION_API_KEY=sua_global_api_key            # Manager > API Keys
WEBHOOK_BASE_URL=https://gestor.suaempresa.com  # URL pública do CenterFlow
```

> **Sem `WEBHOOK_BASE_URL`:** `/api/whatsapp/connect` retorna HTTP 503.

---

## 5. Convenção de Nomes de Instâncias

```javascript
// server/routes/whatsapp.js
function buildInstanceName(usuarioId) {
  return `cf-${usuarioId}`;
}
// Exemplo: cf-9206ff38-cfb7-4b32-9235-79c4ca41302a
```

---

## 6. Endpoints da API

### POST `/api/whatsapp/connect`
**Auth:** JWT + conta ativa

Cria uma instância na Evolution API e inicia o processo de QR.

**Fluxo interno:**
1. Verifica se já existe sessão `connected` → retorna 409 se sim
2. Verifica se `WEBHOOK_BASE_URL` está configurado → retorna 503 se não
3. Limpa instância anterior na Evolution (logout + delete)
4. Gera `webhookSecret` = `crypto.randomBytes(32).hex()`
5. Salva sessão no banco com `status = 'connecting'` **antes** de chamar a Evolution
6. Chama `POST /instance/create` na Evolution com webhook configurado
7. Chama `GET /instance/connect/{name}` para tentar obter QR imediatamente
8. Tenta `fetchInstances` com cooldown para buscar QR
9. Agenda um `scheduleDelayedQrFetch` em 6s se QR não veio imediatamente

**Resposta de sucesso:**
```json
{
  "ok": true,
  "status": "connecting",
  "qr_available": false,
  "message": "Instancia criada. Aguarde o QR code."
}
```

---

### GET `/api/whatsapp/status`
**Auth:** JWT + conta ativa

Retorna o status atual da sessão.

**Resposta:**
```json
{
  "status": "connecting",
  "phone_number": null,
  "waiting_qr": true,
  "waiting_seconds": 45
}
```

**Timeout de QR:** Se `status = connecting` e sem `qrcode_base64` por mais de **2 minutos** (`QR_WAIT_TIMEOUT_MS = 120_000`), a sessão é marcada como `disconnected` automaticamente.

---

### GET `/api/whatsapp/qrcode`
**Auth:** JWT + conta ativa

Retorna o QR code como base64 PNG.

**Respostas possíveis:**
- `200` + `{ qrcode: "data:image/png;base64,..." }` — QR disponível
- `202` + `{ message: "QR code ainda não disponível..." }` — aguardando webhook
- `409` — já conectado
- `410` — sessão expirada na Evolution (precisa reconectar)

---

### POST `/api/whatsapp/disconnect`
**Auth:** JWT + conta ativa

Desconecta e exclui a instância na Evolution. Apaga `whatsapp_sessions` e `whatsapp_pending` do tenant.

---

### POST `/api/whatsapp/webhook/:instanceName`
**Auth:** Público (validado por secret)

Recebe eventos da Evolution API. Responde `{ ok: true }` imediatamente (sem bloqueio).

**Autenticação do webhook:**
Três métodos aceitos (ordem de verificação):
1. Query param: `?secret={webhookSecret}`
2. Header: `X-CenterFlow-Webhook-Secret: {webhookSecret}`
3. Header: `apikey: {EVOLUTION_API_KEY}` (fallback global)

---

## 7. Webhook — Eventos Tratados

### QRCODE_UPDATED
Disparado pela Evolution quando um novo QR code está disponível.

```javascript
// Normalização do evento
function normalizeWebhookEvent(body) {
  const raw = (body?.event || body?.type || body?.action || "").toString();
  let event = raw.toUpperCase().replace(/\./g, "_");
  // ex: "qrcode.updated" → "QRCODE_UPDATED"
}
```

**Ação:** Extrai QR do payload e persiste em `whatsapp_sessions.qrcode_base64`.

**Formatos de QR aceitos (Evolution pode enviar de várias formas):**
- `data:image/png;base64,...` → usado diretamente
- String base64 pura → prefixado com `data:image/png;base64,`
- String raw Baileys (`2@xxx,yyy,zzz`) → convertida para PNG via biblioteca `qrcode`

### CONNECTION_UPDATE
Estado da conexão muda.

| State | Ação no banco |
|---|---|
| `open` | `status = 'connected'`, salva `phone_number`, zera `qrcode_base64` |
| `close` | `status = 'disconnected'`, zera `qrcode_base64` (se havia QR, ignora) |
| `connecting` | `status = 'connecting'` |

**Tratamento especial para `close` transitório:**
- Se `waitingQr = true` (sem QR ainda) E `ageMs < 120s` → ignora o `close` (não atualiza `updated_at`)
- Se `waitingQr = true` E `ageMs >= 120s` → timeout, marca `disconnected`
- Deduplicação: mesmo estado dentro de 2s é ignorado

---

## 8. Estados e Transições

```
null (carregando)
     │
     ▼
disconnected ──── POST /connect ──▶ connecting
                                        │
                              QRCODE_UPDATED (webhook)
                                        │
                              QR exibido na UI
                                        │
                              Usuário escaneia
                                        │
                         CONNECTION_UPDATE state=open
                                        │
                                    connected
                                        │
                        POST /disconnect ou state=close
                                        │
                                 disconnected
```

---

## 9. Poll do Frontend

**Hook:** `src/gestor/hooks/useWhatsApp.js`

| Variável | Valor | Descrição |
|---|---|---|
| `POLL_STATUS_MS` | 4000ms | Intervalo de polling de status |
| `POLL_QR_MS` | 8000ms | Intervalo de polling de QR |

**Regras:**
- Polling ativo apenas quando `status === "connecting"`
- Para automaticamente ao entrar em `connected` ou `disconnected`
- Nunca chama `/instance/connect` no poll (evita derrubar sessão)
- Timeout de `connecting → disconnected` gerenciado no backend

---

## 10. Cooldowns no Backend

```javascript
const FETCH_INSTANCES_COOLDOWN_MS = 8_000;   // entre chamadas fetchInstances
const QR_WAIT_TIMEOUT_MS = 120_000;           // tempo máx sem QR
```

Cooldown previne chamar `/instance/fetchInstances` em loop (que na Evolution v2.1.1 derruba a sessão).

---

## 11. Provider Evolution API

**Arquivo:** `server/whatsapp/evolutionProvider.js`

Todas as chamadas HTTP para a Evolution passam por este arquivo.

| Função | Método | Endpoint |
|---|---|---|
| `createInstance` | POST | `/instance/create` |
| `connectInstance` | GET | `/instance/connect/{name}` |
| `fetchDirectConnectQr` | GET | `/instance/connect/{name}` |
| `fetchInstanceByName` | GET | `/instance/fetchInstances?instanceName=...` |
| `getConnectionState` | GET | `/instance/connectionState/{name}` |
| `logoutInstance` | DELETE | `/instance/logout/{name}` |
| `deleteInstance` | DELETE | `/instance/delete/{name}` |

**Headers de autenticação:**
```javascript
headers: {
  apikey: process.env.EVOLUTION_API_KEY,
  "Content-Type": "application/json",
}
```

**Payload de `createInstance`:**
```javascript
{
  instanceName: "cf-{uuid}",
  integration: "WHATSAPP-BAILEYS",
  qrcode: true,
  groupsIgnore: true,
  rejectCall: true,
  readMessages: false,
  alwaysOnline: false,
  webhook: {
    url: "{WEBHOOK_BASE_URL}/api/whatsapp/webhook/cf-{uuid}?secret={secret}",
    byEvents: true,
    base64: true,
    events: ["QRCODE_UPDATED", "CONNECTION_UPDATE"],
    headers: { "X-CenterFlow-Webhook-Secret": "{secret}" }
  }
}
```

---

## 12. Diferenças entre Preview/Mock e WhatsApp Real

| Situação | Preview/Mock | WhatsApp Real |
|---|---|---|
| QR code | Sempre disponível | Depende da Evolution API |
| `qrcode_base64` | Simulado | Vem via webhook `QRCODE_UPDATED` |
| `phone_number` | Fixo | Vem de `CONNECTION_UPDATE state=open` |
| Lançamento via mensagem | Não implementado | Não implementado (Fase 3+) |
| Hash da instância | ID UUID (não é QR) | Igual — nunca usar como QR |

> **IMPORTANTE:** O campo `hash` na resposta de `createInstance` é o UUID da instância na Evolution, **não** um pairing code do WhatsApp. Usar como QR geraria código falso.

---

## 13. Problema Atual: Evolution v2.1.1 — QR Não Enviado

**Descrição do bug:**
- `/instance/create` retorna `hash` = ID da instância (36 chars UUID)
- `/instance/connect` retorna `{ count: 0 }` — sem QR
- Webhook recebe apenas `CONNECTION_UPDATE`, **nunca** `QRCODE_UPDATED`
- Loop: `connecting (200) → close (405 ou 401)`

**StatusReason da Evolution:**
| Código | Significado |
|---|---|
| 200 | Conexão em andamento |
| 405 | Versão WhatsApp Web incompatível |
| 401 | Sessão rejeitada pelo WhatsApp |

**Solução:**
1. Atualizar Evolution para **v2.3.7+**
2. Configurar no docker-compose da Evolution:
   - `SERVER_URL` = URL pública da Evolution
   - `CONFIG_SESSION_PHONE_VERSION` = versão recente (ver wppconnect.io/whatsapp-versions)
   - `CONFIG_SESSION_PHONE_CLIENT=Chrome`

---

## 14. Reconnect e Reset de Sessão

**Reconexão manual:**
1. Usuário clica "Cancelar" (chama `POST /disconnect`)
2. Banco limpa `whatsapp_sessions` e `whatsapp_pending`
3. Usuário clica "Conectar WhatsApp" novamente

**Reset automático por 404 da Evolution:**
Se a Evolution retorna 404 para uma instância, o backend:
1. Marca `status = 'disconnected'` no banco
2. Zera `qrcode_base64`
3. Loga aviso uma única vez (sem spam)

**Reset por timeout de QR (2 min):**
```javascript
async function failQrWaitTimeout(instanceName, logLabel) {
  await query(
    `UPDATE whatsapp_sessions
     SET status = 'disconnected', qrcode_base64 = NULL, updated_at = NOW()
     WHERE instance_name = $1`,
    [instanceName]
  );
}
```

---

## 15. Envio de Mensagens (Fase 3+ — Não Implementado)

A tabela `whatsapp_pending` está pronta para armazenar lançamentos aguardando confirmação. O fluxo planejado (não implementado):

1. Usuário envia mensagem via WhatsApp para o número conectado
2. Evolution encaminha via webhook (evento `MESSAGES_UPSERT`)
3. Backend cria registro em `whatsapp_pending` com `payload` do lançamento
4. Bot responde pedindo confirmação
5. Usuário responde "sim" ou "confirmo"
6. Backend cria lançamento (avulso: no JSONB; recorrência: na tabela `recorrencias`)
7. Delete de `whatsapp_pending`

---

## 16. Troubleshooting

### QR fica em "Carregando QR…" indefinidamente
1. Verificar logs: `pm2 logs gestor-back`
2. Procurar por `[whatsapp/webhook] QRCODE_UPDATED` — se nunca aparecer, problema é na Evolution
3. Verificar `WEBHOOK_BASE_URL` no `.env` — deve ser URL pública acessível pela Evolution
4. Testar webhook: `curl -I "https://SEU_DOMINIO/api/whatsapp/webhook/cf-TESTE?secret=test"`
5. Atualizar Evolution para v2.3.7+

### "Sessão expirada na Evolution. Clique em Conectar WhatsApp novamente"
- A instância foi deletada na Evolution (404)
- Solução: clicar em "Conectar WhatsApp" novamente

### Loop connecting → close → connecting
- Causa: Evolution v2.1.1 com `statusReason 405` (versão WhatsApp Web incompatível)
- Solução: configurar `CONFIG_SESSION_PHONE_VERSION` na Evolution

### "Servidor WhatsApp não configurado (WEBHOOK_BASE_URL ausente)"
- Adicionar ao `.env`: `WEBHOOK_BASE_URL=https://gestor.suaempresa.com`
- Reiniciar o servidor

### QR aparece mas não conecta após escanear
- Verificar `CONFIG_SESSION_PHONE_VERSION` na Evolution
- Ver issues Evolution #2385, #2430

### "WhatsApp já está conectado"
- Sessão ativa no banco. Desconectar primeiro via UI.
- Se banco está dessincronizado: `DELETE FROM whatsapp_sessions WHERE usuario_id = '{uuid}';`

---

## 17. Commits Principais do Módulo

```
c140796  feat: add whatsapp finance tables
0540428  feat: add whatsapp connection qr flow
2d3096e  fix: save whatsapp session before qr webhook
0e9a943  fix: reject fake hash qr + webhook auth header
81642c8  fix: stop connect polling loop
de17a5f  fix: evolution 404 stale session
8d1f994  fix: qr wait timeout + webhook close loop  ← ÚLTIMO COMMIT RELEVANTE
```
