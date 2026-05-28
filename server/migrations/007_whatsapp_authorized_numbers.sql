-- ============================================================
-- Migration 007: Allowlist de telefones autorizados (PF e PJ)
-- Segura: apenas CREATE TABLE IF NOT EXISTS
-- ============================================================

-- Tabela principal: telefones autorizados a operar via WhatsApp
-- Serve tanto para PF (instancia global) quanto para PJ (instancia propria).
--
-- Regra PF:
--   fromNumber = instancia global -> buscar phone_number aqui -> usuario_id
--
-- Regra PJ:
--   Se nenhuma linha para o tenant: aceitar apenas whatsapp_sessions.phone_number
--   Se houver linhas: aceitar apenas active = true
--
-- Constraint UNIQUE(phone_number):
--   Um numero so pode estar vinculado a um unico usuario.
--   Garante que fromNumber identifica univocamente um tenant.

CREATE TABLE IF NOT EXISTS whatsapp_authorized_numbers (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  phone_number TEXT         NOT NULL,
  label        TEXT         NOT NULL DEFAULT '',
  active       BOOLEAN      NOT NULL DEFAULT true,
  verified_at  TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_wa_authorized_phone UNIQUE(phone_number)
);

CREATE INDEX IF NOT EXISTS idx_wa_auth_phone   ON whatsapp_authorized_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_auth_usuario ON whatsapp_authorized_numbers(usuario_id);
CREATE INDEX IF NOT EXISTS idx_wa_auth_active  ON whatsapp_authorized_numbers(active);

DROP TRIGGER IF EXISTS trg_wa_auth_upd ON whatsapp_authorized_numbers;
CREATE TRIGGER trg_wa_auth_upd
  BEFORE UPDATE ON whatsapp_authorized_numbers
  FOR EACH ROW EXECUTE FUNCTION fn_updated_at();

-- Fim da migration 007
