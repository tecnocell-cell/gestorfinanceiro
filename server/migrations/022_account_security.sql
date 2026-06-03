-- Etapa 6.2 — Segurança de conta (verificação, recuperação, auditoria, bloqueio)

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado_em TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tentativas_login INT NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_ate TIMESTAMPTZ;

UPDATE usuarios
SET email_verificado_em = COALESCE(email_verificado_em, updated_at, created_at)
WHERE email_verificado = true AND email_verificado_em IS NULL;

CREATE TABLE IF NOT EXISTS password_resets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_usuario ON password_resets(usuario_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets(expires_at);

CREATE TABLE IF NOT EXISTS login_audits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ip          VARCHAR(64),
  user_agent  TEXT,
  sucesso     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_audits_usuario ON login_audits(usuario_id);
CREATE INDEX IF NOT EXISTS idx_login_audits_created ON login_audits(created_at DESC);
