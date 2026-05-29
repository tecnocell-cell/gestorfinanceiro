-- ============================================================
-- Migration 009: Rastreamento de resposta automatica na inbox
-- Segura: apenas ALTER TABLE ADD COLUMN IF NOT EXISTS
--
-- response_sent   = true quando resposta automatica foi enviada com sucesso
-- response_error  = mensagem de erro do ultimo envio (null se ok)
-- ============================================================

ALTER TABLE whatsapp_inbox
  ADD COLUMN IF NOT EXISTS response_sent  BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS response_error TEXT;

-- Fim da migration 009
