-- Etapa 7.2 — Chamados de suporte (simples)

CREATE TABLE IF NOT EXISTS support_tickets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria    VARCHAR(32) NOT NULL DEFAULT 'outro'
    CHECK (categoria IN ('financeiro', 'whatsapp', 'assinatura', 'equipe', 'outro')),
  assunto      VARCHAR(200) NOT NULL,
  descricao    TEXT NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto', 'em_andamento', 'resolvido')),
  anexo_nome   VARCHAR(255),
  anexo_data   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_usuario ON support_tickets(usuario_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets(created_at DESC);
