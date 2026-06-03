-- Etapa 6.5 — Cobrança real, faturas e pagamentos (Asaas)

ALTER TABLE assinaturas DROP CONSTRAINT IF EXISTS assinaturas_status_check;
ALTER TABLE assinaturas ADD CONSTRAINT assinaturas_status_check
  CHECK (status IN ('trial', 'ativa', 'atrasada', 'cancelada', 'vencida'));

ALTER TABLE assinaturas
  ADD COLUMN IF NOT EXISTS proxima_cobranca TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gateway VARCHAR(32),
  ADD COLUMN IF NOT EXISTS gateway_customer_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS cancelada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acesso_ate TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS faturas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id          UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  assinatura_id       UUID NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
  gateway             VARCHAR(32) NOT NULL DEFAULT 'asaas',
  gateway_invoice_id  VARCHAR(64),
  valor_centavos      INT NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'paga', 'cancelada', 'vencida')),
  vencimento          DATE NOT NULL,
  pago_em             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faturas_usuario ON faturas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_faturas_assinatura ON faturas(assinatura_id);
CREATE INDEX IF NOT EXISTS idx_faturas_status ON faturas(status);
CREATE INDEX IF NOT EXISTS idx_faturas_gateway_invoice ON faturas(gateway_invoice_id);

CREATE TABLE IF NOT EXISTS pagamentos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id          UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  assinatura_id       UUID NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
  fatura_id           UUID NOT NULL REFERENCES faturas(id) ON DELETE CASCADE,
  gateway             VARCHAR(32) NOT NULL DEFAULT 'asaas',
  gateway_payment_id  VARCHAR(64),
  valor_centavos      INT NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'confirmado', 'cancelado', 'estornado')),
  payload             JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_usuario ON pagamentos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_fatura ON pagamentos(fatura_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_gateway ON pagamentos(gateway_payment_id);

CREATE TABLE IF NOT EXISTS eventos_pagamento (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway         VARCHAR(32) NOT NULL,
  evento          VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gateway, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_eventos_pagamento_created ON eventos_pagamento(created_at DESC);
