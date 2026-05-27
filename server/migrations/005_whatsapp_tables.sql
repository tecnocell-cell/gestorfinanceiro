-- ============================================================
-- Migration 005: Tabelas do Módulo WhatsApp Financeiro
-- ✅ Segura: só cria, nunca apaga ou renomeia nada existente
-- ✅ Idempotente: CREATE TABLE IF NOT EXISTS
-- ✅ FKs: UUID REFERENCES usuarios(id) — padrão das migrations 002/003/004
--
-- Fase 1/7 — somente infraestrutura de banco.
-- Sem endpoints, sem frontend, sem integração Evolution API.
-- Commit: feat: add whatsapp finance tables
-- ============================================================

-- ── 1. Sessões WhatsApp por tenant ────────────────────────────────────────────
--
-- Armazena a conexão entre um tenant (usuario_id) e sua instância
-- na Evolution API self-hosted.
--
-- Regras:
--   • Um tenant tem no máximo UMA instância (UNIQUE usuario_id)
--   • instanceName segue a convenção: cf-{usuario_id}
--   • webhook_secret é gerado no servidor (crypto.randomBytes), nunca
--     exposto ao frontend. Validado via header X-CenterFlow-Webhook-Secret
--     OU query param ?secret=
--   • qrcode_base64 é descartado (NULL) após status = 'connected'
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID          NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  instance_name   TEXT          NOT NULL UNIQUE,          -- ex: cf-550e8400-e29b-41d4-a716-446655440000
  phone_number    TEXT,                                   -- 5511999999999 — NULL até conectar
  status          TEXT          NOT NULL DEFAULT 'disconnected'
                                CHECK (status IN ('disconnected', 'connecting', 'connected')),
  qrcode_base64   TEXT,                                   -- NULL após conexão
  webhook_secret  TEXT          NOT NULL,                 -- segredo HMAC por instância
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_sessions_usuario   ON whatsapp_sessions(usuario_id);
CREATE INDEX IF NOT EXISTS idx_wa_sessions_instance  ON whatsapp_sessions(instance_name);

DROP TRIGGER IF EXISTS trg_wa_sessions_upd ON whatsapp_sessions;
CREATE TRIGGER trg_wa_sessions_upd
  BEFORE UPDATE ON whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION fn_updated_at();


-- ── 2. Lançamentos pendentes de confirmação ───────────────────────────────────
--
-- Armazena um lançamento (avulso ou recorrência) aguardando o usuário
-- responder "sim" / "confirmo" via WhatsApp.
--
-- Regras:
--   • Máximo 1 pendente ativo por tenant em qualquer momento.
--     Novo pendente substitui o anterior (DELETE + INSERT no código).
--   • Expira em 24 horas. Expirado é descartado silenciosamente.
--   • Após confirmação: DELETE imediato para evitar dupla gravação.
--   • payload é o objeto do lançamento já estruturado, pronto para
--     inserção no JSONB da tabela estados (tipo avulso) ou para
--     INSERT na tabela recorrencias (tipo recorrencia).
--
-- Valores reais de payload.tipo confirmados no código:
--   lançamento avulso : "Entrada" | "Saida"   (nunca "Transferencia" via WA)
--   recorrência       : "Receita" | "Despesa" (padrão da tabela recorrencias)
--
-- payload.pago para lançamento avulso:
--   false (boolean) — mesmo campo que o modal usa. NÃO incluir l.status.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_pending (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  from_number     TEXT          NOT NULL,                 -- validação de origem
  payload         JSONB         NOT NULL,                 -- objeto pronto para gravação
  tipo_criacao    TEXT          NOT NULL
                                CHECK (tipo_criacao IN ('avulso', 'recorrencia')),
  expires_at      TIMESTAMPTZ   NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_pending_usuario     ON whatsapp_pending(usuario_id);
CREATE INDEX IF NOT EXISTS idx_wa_pending_expires     ON whatsapp_pending(expires_at);

-- ── Fim da migration 005 ──────────────────────────────────────────────────────
-- Próximo passo: revisar e aprovar Fase 2 (endpoints /connect, /status, etc.)
-- antes de qualquer nova implementação.
