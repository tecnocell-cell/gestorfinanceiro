-- Etapa 6.1 — Open Finance MVP (conexões, contas, transações, sync logs)

CREATE TABLE IF NOT EXISTS openfinance_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  provider          VARCHAR(32) NOT NULL,
  institution_name  VARCHAR(255) NOT NULL,
  status            VARCHAR(32) NOT NULL DEFAULT 'active',
  consent_id        VARCHAR(255),
  provider_item_id  VARCHAR(255),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_of_conn_usuario ON openfinance_connections(usuario_id);

CREATE TABLE IF NOT EXISTS openfinance_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id       UUID NOT NULL REFERENCES openfinance_connections(id) ON DELETE CASCADE,
  account_id_provider VARCHAR(255) NOT NULL,
  name                VARCHAR(255) NOT NULL,
  type                VARCHAR(64),
  balance             NUMERIC(18, 2) DEFAULT 0,
  currency            VARCHAR(8) NOT NULL DEFAULT 'BRL',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (connection_id, account_id_provider)
);

CREATE INDEX IF NOT EXISTS idx_of_acc_connection ON openfinance_accounts(connection_id);

CREATE TABLE IF NOT EXISTS openfinance_transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id              UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  connection_id           UUID NOT NULL REFERENCES openfinance_connections(id) ON DELETE CASCADE,
  account_id              UUID NOT NULL REFERENCES openfinance_accounts(id) ON DELETE CASCADE,
  transaction_id_provider VARCHAR(255) NOT NULL,
  transaction_date        DATE NOT NULL,
  description             TEXT,
  amount_centavos         BIGINT NOT NULL,
  type                    VARCHAR(16) NOT NULL,
  raw                     JSONB,
  fingerprint             VARCHAR(64) NOT NULL,
  lancamento_id           UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_of_tx_usuario ON openfinance_transactions(usuario_id);
CREATE INDEX IF NOT EXISTS idx_of_tx_connection ON openfinance_transactions(connection_id);

CREATE TABLE IF NOT EXISTS openfinance_sync_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  connection_id   UUID NOT NULL REFERENCES openfinance_connections(id) ON DELETE CASCADE,
  status          VARCHAR(32) NOT NULL,
  message         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_of_sync_usuario ON openfinance_sync_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_of_sync_connection ON openfinance_sync_logs(connection_id);
