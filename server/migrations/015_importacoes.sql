-- ============================================================
-- Migration 015: Importações com histórico e deduplicação
-- ✅ Idempotente: CREATE TABLE IF NOT EXISTS
-- ✅ Não altera tabelas existentes
-- ✅ Não requer rollback de dados
-- ============================================================

-- ── Histórico de importações ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS importacoes (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Origem
  formato       VARCHAR(10)   NOT NULL CHECK (formato IN ('OFX','CSV','XLSX','JSON')),
  banco_slug    VARCHAR(50),                -- detectado via header OFX (FI/ORG)
  nome_arquivo  TEXT,

  -- Referências fracas ao JSONB (IDs do plano e conta internos ao estado)
  conta_id      TEXT,
  plano_id      TEXT,

  -- Contadores
  total_linhas  INT           NOT NULL DEFAULT 0,
  importados    INT           NOT NULL DEFAULT 0,
  duplicatas    INT           NOT NULL DEFAULT 0,
  erros         INT           NOT NULL DEFAULT 0,

  -- Lote gerado (ex: "IMP-a1b2c3d4") — chave de vínculo com lancamentos no JSONB
  lote_id       TEXT,

  status        VARCHAR(20)   NOT NULL DEFAULT 'sucesso'
    CHECK (status IN ('sucesso','parcial','erro')),

  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_importacoes_usuario  ON importacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_importacoes_created  ON importacoes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_importacoes_lote     ON importacoes(lote_id);

-- ── Fingerprints para deduplicação ───────────────────────────────────────────
--
-- Cada transação importada deixa um fingerprint aqui.
-- Ao importar novamente o mesmo extrato, duplicatas são ignoradas.
--
-- Fingerprint = SHA-256(fitid:usuario:fitid)       quando OFX tem FITID
--             = SHA-256(usuario|data|cents|tipo|hist) quando não tem FITID
--
CREATE TABLE IF NOT EXISTS importacoes_fingerprints (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fingerprint   VARCHAR(64)   NOT NULL,
  importacao_id UUID          REFERENCES importacoes(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE (usuario_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_fingerprints_usuario ON importacoes_fingerprints(usuario_id);
CREATE INDEX IF NOT EXISTS idx_fingerprints_fp      ON importacoes_fingerprints(fingerprint);
