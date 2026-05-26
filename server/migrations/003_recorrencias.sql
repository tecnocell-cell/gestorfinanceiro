-- ============================================================
-- Migration 003: Recorrências (despesas e receitas fixas)
-- ✅ Segura: só cria, nunca apaga ou renomeia nada existente
-- ============================================================

CREATE TABLE IF NOT EXISTS recorrencias (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo            VARCHAR(10)   NOT NULL CHECK (tipo IN ('Receita','Despesa')),
  descricao       TEXT          NOT NULL,
  valor           NUMERIC(15,2) NOT NULL,
  periodicidade   VARCHAR(10)   NOT NULL CHECK (periodicidade IN ('mensal','semanal','anual')),
  proxima_data    DATE          NOT NULL,
  status          VARCHAR(10)   NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','pausada','encerrada')),
  plano_id        TEXT,           -- referência ao planoContas[].id do JSONB
  conta_id        TEXT,           -- referência ao contas[].id do JSONB
  empresa_id      TEXT,           -- referência ao empresa.id do JSONB
  observacao      TEXT,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recorrencias_usuario  ON recorrencias(usuario_id);
CREATE INDEX IF NOT EXISTS idx_recorrencias_proxima  ON recorrencias(proxima_data);
CREATE INDEX IF NOT EXISTS idx_recorrencias_status   ON recorrencias(status);

DROP TRIGGER IF EXISTS trg_recorrencias_upd ON recorrencias;
CREATE TRIGGER trg_recorrencias_upd
  BEFORE UPDATE ON recorrencias
  FOR EACH ROW EXECUTE FUNCTION fn_updated_at();
