-- ============================================================
-- Migration 013: Campos de processamento de mídia na inbox WhatsApp
-- Segura: apenas ALTER TABLE ADD COLUMN IF NOT EXISTS
--
-- transcription_text : resultado da transcrição de áudio (Whisper)
-- ocr_text           : resultado do OCR de imagem/documento (Vision)
-- processing_status  : estado do processamento da mídia
--   pending    = recebido, aguardando processamento
--   processing = em processamento
--   done       = processado (com ou sem resultado)
--   error      = erro irrecuperável
-- processing_error   : mensagem de erro se processing_status = 'error'
-- ============================================================

ALTER TABLE whatsapp_inbox
  ADD COLUMN IF NOT EXISTS transcription_text TEXT,
  ADD COLUMN IF NOT EXISTS ocr_text           TEXT,
  ADD COLUMN IF NOT EXISTS processing_status  TEXT NOT NULL DEFAULT 'pending'
                           CHECK (processing_status IN ('pending','processing','done','error')),
  ADD COLUMN IF NOT EXISTS processing_error   TEXT;

CREATE INDEX IF NOT EXISTS idx_wa_inbox_proc_status ON whatsapp_inbox(processing_status);

-- Fim da migration 013
