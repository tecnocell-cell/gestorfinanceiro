-- Verificação de cadastro (e-mail / SMS) e telefone

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone VARCHAR(20) DEFAULT '';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone_verificado BOOLEAN NOT NULL DEFAULT false;

-- Contas já existentes e admins: considerar e-mail verificado
UPDATE usuarios SET email_verificado = true WHERE email_verificado = false;

CREATE TABLE IF NOT EXISTS verificacoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  canal        VARCHAR(10) NOT NULL,
  codigo_hash  TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  usado        BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verificacoes_usuario ON verificacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_verificacoes_expires ON verificacoes(expires_at);
