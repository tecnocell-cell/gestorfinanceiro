-- Etapa 7.3 — Auditoria de ações admin SaaS (alteração de plano, etc.)

CREATE TABLE IF NOT EXISTS admin_saas_auditoria (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_usuario_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  alvo_usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  acao              VARCHAR(64) NOT NULL,
  detalhes          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_saas_audit_alvo ON admin_saas_auditoria(alvo_usuario_id);
CREATE INDEX IF NOT EXISTS idx_admin_saas_audit_created ON admin_saas_auditoria(created_at DESC);
