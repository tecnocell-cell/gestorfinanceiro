-- Etapa 7.5 — Logs operacionais de cobrança
CREATE TABLE IF NOT EXISTS billing_ops_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        VARCHAR(64) NOT NULL,
  usuario_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fatura_id   UUID,
  detalhes    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_ops_log_created ON billing_ops_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_ops_log_tipo ON billing_ops_log(tipo);
