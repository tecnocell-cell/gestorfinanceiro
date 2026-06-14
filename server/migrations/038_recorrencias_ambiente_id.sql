-- Adiciona ambiente_id à tabela recorrencias para isolamento multiambiente.
-- Recorrências existentes (NULL) são atribuídas ao ambiente pessoal do usuário
-- (primeiro ambiente por ordem, tipo='pessoal') como fallback seguro.
-- Recorrências sem ambiente pessoal cadastrado ficam com NULL (visíveis em todos).

ALTER TABLE recorrencias
  ADD COLUMN IF NOT EXISTS ambiente_id UUID REFERENCES ambientes_financeiros(id) ON DELETE SET NULL;

-- Backfill: associa recorrências sem ambiente ao ambiente pessoal do usuário
UPDATE recorrencias r
SET ambiente_id = (
  SELECT af.id
  FROM ambientes_financeiros af
  WHERE af.usuario_id = r.usuario_id
    AND af.ativo = true
    AND af.tipo = 'pessoal'
  ORDER BY af.ordem ASC, af.created_at ASC
  LIMIT 1
)
WHERE r.ambiente_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_recorrencias_ambiente_id ON recorrencias(ambiente_id);
CREATE INDEX IF NOT EXISTS idx_recorrencias_usuario_ambiente ON recorrencias(usuario_id, ambiente_id);
