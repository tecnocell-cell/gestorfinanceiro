-- Etapa 7.7 — Feedback beta e progresso do checklist por usuário

CREATE TABLE IF NOT EXISTS feedback_beta (
  id SERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tela VARCHAR(120) NOT NULL DEFAULT '',
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('bug', 'duvida', 'sugestao', 'elogio')),
  mensagem TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto', 'em_analise', 'resolvido', 'arquivado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_beta_usuario ON feedback_beta(usuario_id);
CREATE INDEX IF NOT EXISTS idx_feedback_beta_status ON feedback_beta(status);
CREATE INDEX IF NOT EXISTS idx_feedback_beta_tipo ON feedback_beta(tipo);
CREATE INDEX IF NOT EXISTS idx_feedback_beta_created ON feedback_beta(created_at DESC);

CREATE TABLE IF NOT EXISTS beta_checklist_progress (
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  item_key VARCHAR(64) NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, item_key)
);
