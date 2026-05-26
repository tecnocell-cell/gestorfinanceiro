-- ============================================================
-- Migration 004: Conexões Bancárias / Open Finance (estrutura preparatória)
-- ✅ Segura: só cria IF NOT EXISTS, nunca DROP/ALTER/RENAME
-- ⚠️  Nenhum dado sensível aqui — tokens e credenciais ficam no provedor externo
-- ============================================================

CREATE TABLE IF NOT EXISTS conexoes_bancarias (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Identificação do banco
  banco_slug   VARCHAR(50)   NOT NULL,        -- 'nubank' | 'itau' | 'bradesco' | ...
  apelido      TEXT,                           -- nome amigável escolhido pelo usuário

  -- Status da conexão
  status       VARCHAR(20)   NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','ativa','pausada','erro','revogada')),

  -- Provedor de Open Finance (a implementar futuramente)
  provedor     VARCHAR(50),                    -- 'pluggy' | 'belvo' | 'openbanking_br'
  provedor_id  TEXT,                           -- ID opaco no provedor (sem dados sensíveis)

  -- Sincronização
  ultimo_sync  TIMESTAMPTZ,
  erro_msg     TEXT,                           -- última mensagem de erro (sem credenciais)

  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_conexoes_usuario  ON conexoes_bancarias(usuario_id);
CREATE INDEX IF NOT EXISTS idx_conexoes_status   ON conexoes_bancarias(status);
CREATE INDEX IF NOT EXISTS idx_conexoes_slug     ON conexoes_bancarias(banco_slug);

-- Tabela de notificações de interesse ("Avise-me")
CREATE TABLE IF NOT EXISTS conexoes_interesse (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  banco_slug   VARCHAR(50)   NOT NULL,
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (usuario_id, banco_slug)               -- um registro por banco por usuário
);

CREATE INDEX IF NOT EXISTS idx_interesse_usuario ON conexoes_interesse(usuario_id);

-- Trigger de updated_at para conexoes_bancarias
CREATE OR REPLACE FUNCTION trg_fn_conexoes_upd()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_conexoes_bancarias_upd ON conexoes_bancarias;
CREATE TRIGGER trg_conexoes_bancarias_upd
  BEFORE UPDATE ON conexoes_bancarias
  FOR EACH ROW EXECUTE FUNCTION trg_fn_conexoes_upd();
