-- Migration 037: Insere os 4 planos oficiais Fluxiva unificados
-- Não remove planos legados (pf_*/pj_*) — assinaturas existentes permanecem intactas.

INSERT INTO planos (slug, nome, descricao, preco_centavos, intervalo, ativo)
VALUES
  ('fluxiva_light',    'Fluxiva Light',    'Controle pessoal essencial',                  1990,  'mensal', true),
  ('fluxiva_start',    'Fluxiva Start',    'Pessoal e empresa na mesma conta',            2990,  'mensal', true),
  ('fluxiva_pro',      'Fluxiva Pro',      'Agilidade para equipes',                      7990,  'mensal', true),
  ('fluxiva_business', 'Fluxiva Business', 'Para empresas maiores e múltiplos negócios',  29990, 'mensal', true)
ON CONFLICT (slug) DO UPDATE SET
  nome           = EXCLUDED.nome,
  descricao      = EXCLUDED.descricao,
  preco_centavos = EXCLUDED.preco_centavos,
  intervalo      = EXCLUDED.intervalo,
  ativo          = true;
