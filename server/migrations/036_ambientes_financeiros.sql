-- Fase 1: Fluxiva Multiambiente
-- Tabela de ambientes financeiros por usuário.
-- Fase 1: cada usuário tem 1 ambiente padrão (Pessoal ou Empresa).
-- Fases futuras permitirão múltiplos ambientes com dados isolados.

CREATE TABLE IF NOT EXISTS ambientes_financeiros (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome        TEXT        NOT NULL,
  tipo        TEXT        NOT NULL DEFAULT 'pessoal', -- pessoal | empresa | outro
  icone       TEXT,
  cor         TEXT,
  ordem       INTEGER     NOT NULL DEFAULT 0,
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ambientes_usuario ON ambientes_financeiros(usuario_id);

-- Unicidade: nome de ambiente ativo por usuário
CREATE UNIQUE INDEX IF NOT EXISTS idx_ambientes_usuario_nome_ativo
  ON ambientes_financeiros(usuario_id, nome)
  WHERE ativo = true;
