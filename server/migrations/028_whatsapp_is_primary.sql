-- Etapa 7.0: número principal entre autorizados
ALTER TABLE whatsapp_authorized_numbers
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_wa_auth_primary
  ON whatsapp_authorized_numbers(usuario_id)
  WHERE is_primary = true;
