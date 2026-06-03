-- Etapa 6.8 — OTP por e-mail/WhatsApp para ações sensíveis

CREATE TABLE IF NOT EXISTS otps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  canal        VARCHAR(20) NOT NULL CHECK (canal IN ('email', 'whatsapp')),
  destino      TEXT NOT NULL,
  codigo_hash  TEXT NOT NULL,
  tipo         VARCHAR(40) NOT NULL CHECK (
    tipo IN ('login_suspeito', 'reset_senha', 'verificar_telefone', 'acao_sensivel')
  ),
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  tentativas   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otps_usuario_tipo ON otps(usuario_id, tipo);
CREATE INDEX IF NOT EXISTS idx_otps_expires ON otps(expires_at);
CREATE INDEX IF NOT EXISTS idx_otps_destino_created ON otps(destino, created_at DESC);
