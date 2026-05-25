-- ============================================================
-- Gestor Financeiro — Schema PostgreSQL
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Usuários / Tenants
CREATE TABLE IF NOT EXISTS usuarios (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email          VARCHAR(255) UNIQUE NOT NULL,
  senha_hash     TEXT         NOT NULL,
  nome           VARCHAR(255) NOT NULL DEFAULT '',
  role           VARCHAR(20)  NOT NULL DEFAULT 'user',   -- 'admin' | 'user'
  ativo          BOOLEAN      NOT NULL DEFAULT true,      -- admin pode bloquear acesso
  tipo_perfil    VARCHAR(20)  NOT NULL DEFAULT 'juridica', -- 'juridica' | 'fisica'
  nome_perfil    VARCHAR(255) NOT NULL DEFAULT '',        -- nome da empresa ou perfil PF
  ultimo_acesso  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- Estado completo do app por usuário (espelha o localStorage)
CREATE TABLE IF NOT EXISTS estados (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID        UNIQUE NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  dados       JSONB       NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION fn_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_upd ON usuarios;
CREATE TRIGGER trg_usuarios_upd
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_updated_at();

DROP TRIGGER IF EXISTS trg_estados_upd ON estados;
CREATE TRIGGER trg_estados_upd
  BEFORE UPDATE ON estados
  FOR EACH ROW EXECUTE FUNCTION fn_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_estados_usuario   ON estados(usuario_id);
CREATE INDEX IF NOT EXISTS idx_estados_updated   ON estados(updated_at);
CREATE INDEX IF NOT EXISTS idx_usuarios_email    ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_role     ON usuarios(role);
