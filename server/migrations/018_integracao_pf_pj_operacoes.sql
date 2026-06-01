-- ============================================================
-- Migration 018: Operações PF/PJ (Etapa 5.0C — Pró-labore)
-- ============================================================

CREATE TABLE IF NOT EXISTS integracao_pf_pj_operacoes (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  vinculo_id        UUID         NOT NULL REFERENCES integracao_pf_pj_vinculo(id) ON DELETE CASCADE,
  tipo_operacao     VARCHAR(32)  NOT NULL,
  valor_centavos    BIGINT       NOT NULL CHECK (valor_centavos > 0),
  data              DATE         NOT NULL,
  historico         TEXT         NOT NULL DEFAULT '',
  lancamento_pj_id  VARCHAR(64)  NOT NULL,
  lancamento_pf_id  VARCHAR(64)  NOT NULL,
  status            VARCHAR(20)  NOT NULL DEFAULT 'ok'
    CHECK (status IN ('ok', 'rollback')),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operacoes_vinculo   ON integracao_pf_pj_operacoes(vinculo_id);
CREATE INDEX IF NOT EXISTS idx_operacoes_created   ON integracao_pf_pj_operacoes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operacoes_tipo      ON integracao_pf_pj_operacoes(tipo_operacao);
