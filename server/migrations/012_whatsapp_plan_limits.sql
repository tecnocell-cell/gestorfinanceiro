-- ============================================================
-- Migration 012: Plano e limite de números autorizados WhatsApp
-- Segura: apenas ALTER TABLE ADD COLUMN IF NOT EXISTS
--
-- plan_type: identifica o plano do usuário para fins de limite
--   PF_BASIC   = 1 número
--   PF_PLUS    = 3 números
--   PF_PREMIUM = 5 números
--   PJ_BASIC   = 1 número
--   PJ_PLUS    = 3 números
--   PJ_PREMIUM = 5 números
--
-- Default PF_BASIC para modo admin (instância global).
-- Default PJ_BASIC para instâncias PJ.
-- A coluna fica em whatsapp_sessions (PJ) e em system_config (PF global).
-- Para simplicidade: adicionamos plan_type em whatsapp_authorized_numbers
-- no nível de usuário — um campo por usuário, mesmo que ele tenha vários números.
-- Usamos uma tabela auxiliar leve para não alterar usuarios.
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_user_plan (
  usuario_id  UUID  PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  plan_type   TEXT  NOT NULL DEFAULT 'PJ_BASIC'
                    CHECK (plan_type IN (
                      'PF_BASIC','PF_PLUS','PF_PREMIUM',
                      'PJ_BASIC','PJ_PLUS','PJ_PREMIUM'
                    )),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fim da migration 012
