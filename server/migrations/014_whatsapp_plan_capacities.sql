-- ============================================================
-- Migration 014: Capacidades por plano em whatsapp_user_plan
-- Segura: apenas ALTER TABLE ADD COLUMN IF NOT EXISTS + UPDATE
--
-- Evolui a tabela criada na migration 012 adicionando:
--   max_users               — número máximo de usuários no plano
--   max_authorized_numbers  — substituí o PLAN_LIMITS hardcoded no JS
--   ai_text_enabled         — parser de texto habilitado
--   ai_audio_enabled        — transcrição de áudio habilitada
--   ai_receipt_enabled      — OCR de comprovantes habilitado
--
-- Planos suportados (CHECK atualizado via DROP + ADD CONSTRAINT):
--
--   PF: PF_BASIC | PF_PLUS | PF_PREMIUM
--   PJ: PJ_START | PJ_PRO | PJ_BUSINESS        ← novos
--       PJ_BASIC | PJ_PLUS | PJ_PREMIUM         ← legado (mantidos)
--
-- Defaults por plano (UPDATE após ADD COLUMN):
--   PF_BASIC    : max_users=1  max_numbers=1  text=t audio=f receipt=f
--   PF_PLUS     : max_users=1  max_numbers=3  text=t audio=t receipt=f
--   PF_PREMIUM  : max_users=1  max_numbers=5  text=t audio=t receipt=t
--   PJ_START    : max_users=1  max_numbers=1  text=t audio=f receipt=f
--   PJ_PRO      : max_users=3  max_numbers=3  text=t audio=t receipt=f
--   PJ_BUSINESS : max_users=10 max_numbers=5  text=t audio=t receipt=t
--   PJ_BASIC    : max_users=1  max_numbers=1  text=t audio=f receipt=f  (legado)
--   PJ_PLUS     : max_users=3  max_numbers=3  text=t audio=t receipt=f  (legado)
--   PJ_PREMIUM  : max_users=10 max_numbers=5  text=t audio=t receipt=t  (legado)
-- ============================================================

-- ── 1. Adicionar colunas de capacidade ───────────────────────────────────────

ALTER TABLE whatsapp_user_plan
  ADD COLUMN IF NOT EXISTS max_users              INT  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_authorized_numbers INT  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ai_text_enabled        BOOL NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_audio_enabled       BOOL NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_receipt_enabled     BOOL NOT NULL DEFAULT false;

-- ── 2. Atualizar CHECK de plan_type para incluir novos planos PJ ─────────────
--
-- PostgreSQL não tem ALTER CONSTRAINT; remove e recria.
-- Seguro pois os novos valores são apenas adições (sem remover legados).

ALTER TABLE whatsapp_user_plan
  DROP CONSTRAINT IF EXISTS whatsapp_user_plan_plan_type_check;

ALTER TABLE whatsapp_user_plan
  ADD CONSTRAINT whatsapp_user_plan_plan_type_check
  CHECK (plan_type IN (
    'PF_BASIC', 'PF_PLUS', 'PF_PREMIUM',
    'PJ_START', 'PJ_PRO',  'PJ_BUSINESS',
    'PJ_BASIC', 'PJ_PLUS', 'PJ_PREMIUM'
  ));

-- ── 3. Popular capacidades em linhas existentes ───────────────────────────────

UPDATE whatsapp_user_plan SET
  max_users = 1, max_authorized_numbers = 1,
  ai_text_enabled = true,  ai_audio_enabled = false, ai_receipt_enabled = false
WHERE plan_type IN ('PF_BASIC', 'PJ_BASIC', 'PJ_START');

UPDATE whatsapp_user_plan SET
  max_users = 1, max_authorized_numbers = 3,
  ai_text_enabled = true,  ai_audio_enabled = true,  ai_receipt_enabled = false
WHERE plan_type = 'PF_PLUS';

UPDATE whatsapp_user_plan SET
  max_users = 1, max_authorized_numbers = 5,
  ai_text_enabled = true,  ai_audio_enabled = true,  ai_receipt_enabled = true
WHERE plan_type = 'PF_PREMIUM';

UPDATE whatsapp_user_plan SET
  max_users = 3, max_authorized_numbers = 3,
  ai_text_enabled = true,  ai_audio_enabled = true,  ai_receipt_enabled = false
WHERE plan_type IN ('PJ_PLUS', 'PJ_PRO');

UPDATE whatsapp_user_plan SET
  max_users = 10, max_authorized_numbers = 5,
  ai_text_enabled = true,  ai_audio_enabled = true,  ai_receipt_enabled = true
WHERE plan_type IN ('PJ_PREMIUM', 'PJ_BUSINESS');

-- ── 4. Índice auxiliar ────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_wa_user_plan_type ON whatsapp_user_plan(plan_type);

-- Fim da migration 014
