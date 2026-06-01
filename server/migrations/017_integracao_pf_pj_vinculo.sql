-- ============================================================
-- Migration 017: Vínculo único PJ ↔ PF (Etapa 5.0B)
-- ✅ Idempotente
-- ============================================================

CREATE TABLE IF NOT EXISTS integracao_pf_pj_vinculo (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_pj_id   UUID         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  usuario_pf_id   UUID         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  email_pf        VARCHAR(255) NOT NULL,
  nome_pf         VARCHAR(255) NOT NULL DEFAULT '',
  status          VARCHAR(20)  NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'ativo', 'revogado')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  aceito_em       TIMESTAMPTZ,
  revogado_em     TIMESTAMPTZ,
  CHECK (usuario_pj_id <> usuario_pf_id)
);

CREATE INDEX IF NOT EXISTS idx_vinculo_pj ON integracao_pf_pj_vinculo(usuario_pj_id);
CREATE INDEX IF NOT EXISTS idx_vinculo_pf ON integracao_pf_pj_vinculo(usuario_pf_id);
CREATE INDEX IF NOT EXISTS idx_vinculo_status ON integracao_pf_pj_vinculo(status);

-- Apenas 1 vínculo não revogado por PJ
CREATE UNIQUE INDEX IF NOT EXISTS idx_vinculo_pj_unico
  ON integracao_pf_pj_vinculo (usuario_pj_id)
  WHERE status != 'revogado';
