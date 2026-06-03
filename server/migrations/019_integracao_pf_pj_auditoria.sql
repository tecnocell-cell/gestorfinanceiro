-- ============================================================
-- Migration 019: Auditoria operacional integração PF/PJ (Etapa 5.6)
-- ============================================================

CREATE TABLE IF NOT EXISTS integracao_pf_pj_auditoria (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id     UUID         NULL,
  vinculo_id      UUID         NOT NULL REFERENCES integracao_pf_pj_vinculo(id) ON DELETE CASCADE,
  usuario_pj_id   UUID         NOT NULL,
  usuario_pf_id   UUID         NOT NULL,
  acao            VARCHAR(20)  NOT NULL
    CHECK (acao IN ('preview', 'confirmar', 'rollback', 'repair')),
  tipo_operacao   VARCHAR(32)  NOT NULL,
  valor_centavos  BIGINT       NOT NULL CHECK (valor_centavos > 0),
  payload         JSONB        NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integracao_auditoria_operacao
  ON integracao_pf_pj_auditoria(operacao_id);
CREATE INDEX IF NOT EXISTS idx_integracao_auditoria_vinculo
  ON integracao_pf_pj_auditoria(vinculo_id);
CREATE INDEX IF NOT EXISTS idx_integracao_auditoria_created
  ON integracao_pf_pj_auditoria(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integracao_auditoria_acao
  ON integracao_pf_pj_auditoria(acao);
