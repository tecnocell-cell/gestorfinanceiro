-- Etapa 7.8 — Configuração global de gateways (Super Admin)
CREATE TABLE IF NOT EXISTS system_payment_config (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(32) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_payment_config (provider, active, config)
VALUES ('mercado_pago', false, '{}'::jsonb)
ON CONFLICT (provider) DO NOTHING;

INSERT INTO system_payment_config (provider, active, config)
VALUES ('asaas', false, '{}'::jsonb)
ON CONFLICT (provider) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_system_payment_config_active
  ON system_payment_config (active) WHERE active = true;
