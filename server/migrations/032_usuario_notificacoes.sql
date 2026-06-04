-- Etapa 7.6 — Centro de notificações in-app (cobrança, assinatura, etc.)

CREATE TABLE IF NOT EXISTS usuario_notificacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo        VARCHAR(32) NOT NULL
    CHECK (tipo IN ('cobranca', 'assinatura', 'seguranca', 'convite', 'suporte', 'sistema')),
  titulo      VARCHAR(200) NOT NULL,
  mensagem    TEXT NOT NULL,
  codigo      VARCHAR(96),
  lida        BOOLEAN NOT NULL DEFAULT false,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lida_em     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notif_usuario_created
  ON usuario_notificacoes(usuario_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notif_usuario_lida
  ON usuario_notificacoes(usuario_id, lida) WHERE lida = false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_usuario_codigo
  ON usuario_notificacoes(usuario_id, codigo);
