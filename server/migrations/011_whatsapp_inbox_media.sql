-- ============================================================
-- Migration 011: Suporte a mídia na inbox WhatsApp
-- Segura: apenas ALTER TABLE ADD COLUMN IF NOT EXISTS
--
-- message_type : "text" | "audio" | "image" | "document" | "video"
-- media_mimetype: ex. "audio/ogg; codecs=opus", "image/jpeg"
-- media_filename: nome original do arquivo (documentos)
-- media_path    : caminho local relativo ao servidor (media/{instance}/...)
-- caption       : legenda da imagem/vídeo/documento
-- ============================================================

ALTER TABLE whatsapp_inbox
  ADD COLUMN IF NOT EXISTS message_type   TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_mimetype TEXT,
  ADD COLUMN IF NOT EXISTS media_filename TEXT,
  ADD COLUMN IF NOT EXISTS media_path     TEXT,
  ADD COLUMN IF NOT EXISTS caption        TEXT;

CREATE INDEX IF NOT EXISTS idx_wa_inbox_msg_type ON whatsapp_inbox(message_type);

-- Fim da migration 011
