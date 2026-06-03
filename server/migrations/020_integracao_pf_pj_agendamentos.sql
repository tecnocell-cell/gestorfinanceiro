-- ============================================================
-- Migration 020: Agendamentos integração PF/PJ (Etapa 5.7)
-- Cadastro de repasses recorrentes — geração manual por mês
-- ============================================================

CREATE TABLE IF NOT EXISTS integracao_pf_pj_agendamentos (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  vinculo_id        UUID         NOT NULL REFERENCES integracao_pf_pj_vinculo(id) ON DELETE CASCADE,
  usuario_pj_id     UUID         NOT NULL,
  tipo_operacao     VARCHAR(32)  NOT NULL
    CHECK (tipo_operacao IN (
      'pro_labore', 'distribuicao_lucros', 'salario', 'transferencia_pj_pf'
    )),
  valor_centavos    BIGINT       NOT NULL CHECK (valor_centavos > 0),
  dia_mes           SMALLINT     NOT NULL CHECK (dia_mes >= 1 AND dia_mes <= 31),
  observacao        TEXT         NOT NULL DEFAULT '',
  status            VARCHAR(12)  NOT NULL DEFAULT 'ativa'
    CHECK (status IN ('ativa', 'pausada', 'encerrada')),
  ultimo_gerado_mes CHAR(7)      NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_vinculo
  ON integracao_pf_pj_agendamentos(vinculo_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_pj
  ON integracao_pf_pj_agendamentos(usuario_pj_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status
  ON integracao_pf_pj_agendamentos(status);

DROP TRIGGER IF EXISTS trg_integracao_agendamentos_upd ON integracao_pf_pj_agendamentos;
CREATE TRIGGER trg_integracao_agendamentos_upd
  BEFORE UPDATE ON integracao_pf_pj_agendamentos
  FOR EACH ROW EXECUTE FUNCTION fn_updated_at();
