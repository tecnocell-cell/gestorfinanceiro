-- Etapa 6.7 — Multiusuário PJ e convites de equipe

CREATE TABLE IF NOT EXISTS empresa_usuarios (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  membro_usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  perfil              VARCHAR(32) NOT NULL,
  status              VARCHAR(32) NOT NULL DEFAULT 'ativo',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT empresa_usuarios_perfil_chk CHECK (
    perfil IN ('owner', 'admin', 'financeiro', 'operador', 'leitura')
  ),
  CONSTRAINT empresa_usuarios_status_chk CHECK (
    status IN ('ativo', 'inativo', 'removido')
  ),
  CONSTRAINT empresa_usuarios_unique_membro UNIQUE (empresa_usuario_id, membro_usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_empresa_usuarios_membro
  ON empresa_usuarios (membro_usuario_id) WHERE status = 'ativo';

CREATE INDEX IF NOT EXISTS idx_empresa_usuarios_empresa
  ON empresa_usuarios (empresa_usuario_id) WHERE status = 'ativo';

CREATE TABLE IF NOT EXISTS convites_empresa (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  email               VARCHAR(255) NOT NULL,
  token               VARCHAR(128) NOT NULL UNIQUE,
  perfil              VARCHAR(32) NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  accepted_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT convites_empresa_perfil_chk CHECK (
    perfil IN ('admin', 'financeiro', 'operador', 'leitura')
  )
);

CREATE INDEX IF NOT EXISTS idx_convites_empresa_email
  ON convites_empresa (LOWER(email), empresa_usuario_id)
  WHERE accepted_at IS NULL;

-- Donos PJ existentes: vínculo owner consigo
INSERT INTO empresa_usuarios (empresa_usuario_id, membro_usuario_id, perfil, status)
SELECT u.id, u.id, 'owner', 'ativo'
FROM usuarios u
WHERE u.tipo_perfil = 'juridica'
  AND NOT EXISTS (
    SELECT 1 FROM empresa_usuarios eu
    WHERE eu.empresa_usuario_id = u.id AND eu.membro_usuario_id = u.id
  );
