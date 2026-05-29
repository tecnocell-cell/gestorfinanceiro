-- ============================================================
-- Migration 008: Inbox de mensagens WhatsApp brutas
-- Segura: apenas CREATE TABLE IF NOT EXISTS
--
-- Armazena mensagens recebidas via WhatsApp ANTES de qualquer
-- processamento por IA ou classificacao.
--
-- status:
--   pending   = recebida, aguardando processamento
--   processed = ja gerou lancamento (Fase futura)
--   ignored   = descartada manualmente ou por regra
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_inbox (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  from_number    TEXT         NOT NULL,
  instance_name  TEXT         NOT NULL,
  message_text   TEXT         NOT NULL DEFAULT '',
  status         TEXT         NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'processed', 'ignored')),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_inbox_usuario    ON whatsapp_inbox(usuario_id);
CREATE INDEX IF NOT EXISTS idx_wa_inbox_status     ON whatsapp_inbox(status);
CREATE INDEX IF NOT EXISTS idx_wa_inbox_created    ON whatsapp_inbox(created_at DESC);

-- Fim da migration 008
