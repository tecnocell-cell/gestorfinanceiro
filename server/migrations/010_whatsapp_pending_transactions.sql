-- ============================================================
-- Migration 010: Pré-lançamentos WhatsApp aguardando confirmação
-- Segura: apenas CREATE TABLE IF NOT EXISTS
--
-- Armazena lançamentos identificados via WhatsApp ANTES da
-- confirmação do usuário. Não cria lançamento financeiro real
-- até o usuário responder SIM.
--
-- status:
--   pending_confirmation = aguardando SIM ou NAO do usuário
--   confirmed            = usuário confirmou, lançamento criado
--   rejected             = usuário cancelou com NAO
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_pending_transactions (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID           NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  inbox_id       UUID           REFERENCES whatsapp_inbox(id) ON DELETE SET NULL,
  from_number    TEXT           NOT NULL,
  instance_name  TEXT           NOT NULL,
  tipo           TEXT           NOT NULL CHECK (tipo IN ('Receita', 'Despesa')),
  valor          NUMERIC(12,2)  NOT NULL CHECK (valor > 0),
  descricao      TEXT           NOT NULL DEFAULT '',
  status         TEXT           NOT NULL DEFAULT 'pending_confirmation'
                                CHECK (status IN ('pending_confirmation', 'confirmed', 'rejected')),
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_pending_usuario  ON whatsapp_pending_transactions(usuario_id);
CREATE INDEX IF NOT EXISTS idx_wa_pending_status   ON whatsapp_pending_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wa_pending_from     ON whatsapp_pending_transactions(from_number);
CREATE INDEX IF NOT EXISTS idx_wa_pending_created  ON whatsapp_pending_transactions(created_at DESC);

-- Fim da migration 010
