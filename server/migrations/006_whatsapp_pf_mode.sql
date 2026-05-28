-- ============================================================
-- Migration 006: Modo PF para WhatsApp
-- Segura: apenas ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS
-- ============================================================

-- Indice em usuarios(telefone) para lookup PF (fromNumber -> usuario_id)
-- A coluna telefone foi adicionada na migration 002.
CREATE INDEX IF NOT EXISTS idx_usuarios_telefone ON usuarios(telefone);

-- Tabela de configuracoes globais do sistema (chave/valor)
CREATE TABLE IF NOT EXISTS system_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_system_config_upd ON system_config;
CREATE TRIGGER trg_system_config_upd
  BEFORE UPDATE ON system_config
  FOR EACH ROW EXECUTE FUNCTION fn_updated_at();

-- Semear chaves iniciais (ON CONFLICT nao altera valor existente)
INSERT INTO system_config (key, value) VALUES
  ('whatsapp_admin_instance', ''),
  ('whatsapp_admin_phone',    '')
ON CONFLICT (key) DO NOTHING;

-- Fim da migration 006
