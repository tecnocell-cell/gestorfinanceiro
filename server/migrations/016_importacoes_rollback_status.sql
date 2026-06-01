-- ============================================================
-- Migration 016: status 'rollback' em importacoes (Etapa 4.6D)
-- ✅ Idempotente
-- ============================================================

ALTER TABLE importacoes DROP CONSTRAINT IF EXISTS importacoes_status_check;

ALTER TABLE importacoes ADD CONSTRAINT importacoes_status_check
  CHECK (status IN ('sucesso', 'parcial', 'erro', 'rollback'));
