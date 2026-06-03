-- Etapa 6.3 — Planos e assinaturas

CREATE TABLE IF NOT EXISTS planos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            VARCHAR(32) NOT NULL UNIQUE,
  nome            VARCHAR(120) NOT NULL,
  descricao       TEXT,
  preco_centavos  INT NOT NULL DEFAULT 0,
  intervalo       VARCHAR(10) NOT NULL CHECK (intervalo IN ('mensal', 'anual')),
  recursos        JSONB NOT NULL DEFAULT '{}',
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assinaturas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  plano_id    UUID NOT NULL REFERENCES planos(id),
  status      VARCHAR(20) NOT NULL CHECK (status IN ('trial', 'ativa', 'vencida', 'cancelada')),
  inicio_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fim_em      TIMESTAMPTZ,
  trial_ate   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assinaturas_plano ON assinaturas(plano_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_status ON assinaturas(status);

INSERT INTO planos (slug, nome, descricao, preco_centavos, intervalo, recursos, ativo)
VALUES
  (
    'free',
    'Free',
    'Para começar a organizar suas finanças.',
    0,
    'mensal',
    '{"limiteLancamentos":100,"openFinance":false,"integracaoPfPj":false}'::jsonb,
    true
  ),
  (
    'pro',
    'Pro',
    'Recursos avançados para uso profissional.',
    2990,
    'mensal',
    '{"limiteLancamentos":2000,"openFinance":true,"integracaoPfPj":true}'::jsonb,
    true
  ),
  (
    'empresarial',
    'Empresarial',
    'Sem limites de lançamentos e suporte prioritário.',
    9990,
    'mensal',
    '{"limiteLancamentos":null,"openFinance":true,"integracaoPfPj":true,"suportePrioritario":true}'::jsonb,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  preco_centavos = EXCLUDED.preco_centavos,
  intervalo = EXCLUDED.intervalo,
  recursos = EXCLUDED.recursos,
  ativo = EXCLUDED.ativo;
