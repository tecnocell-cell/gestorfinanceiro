-- Correção definitiva: assinaturas PJ não devem ficar em planos PF (Etapa pós-6.3B)
-- Idempotente: só altera linhas com mismatch tipo_perfil x slug do plano.

-- Garante planos comerciais ativos (re-seed seguro se deploy pulou 024)
INSERT INTO planos (slug, nome, descricao, preco_centavos, intervalo, recursos, ativo)
VALUES
  (
    'pf_basico',
    'PF Básico',
    'Para começar a organizar.',
    1990,
    'mensal',
    '{"segmento":"pf","limiteUsuarios":1,"limiteWhatsappNumeros":1,"limiteLancamentos":null,"whatsappTexto":true,"whatsappAudio":false,"whatsappComprovante":false,"iaComprovante":false,"dreCompleto":false,"centroCusto":false,"projetos":false,"apiAccess":false,"suportePrioritario":false,"openFinance":false,"integracaoPfPj":false,"openFinanceAddon":{"ativo":false,"precoCentavos":0,"futuroPrecoSugeridoCentavos":2990,"descricao":"Conexão bancária automática via Open Finance","observacao":"Disponível após ativação do provedor Pluggy"}}'::jsonb,
    true
  ),
  (
    'pf_plus',
    'PF Plus',
    'Mais agilidade no dia a dia.',
    2990,
    'mensal',
    '{"segmento":"pf","limiteUsuarios":1,"limiteWhatsappNumeros":3,"limiteLancamentos":null,"whatsappTexto":true,"whatsappAudio":true,"whatsappComprovante":false,"iaComprovante":false,"dreCompleto":false,"centroCusto":false,"projetos":false,"apiAccess":false,"suportePrioritario":false,"openFinance":false,"integracaoPfPj":false,"openFinanceAddon":{"ativo":false,"precoCentavos":0,"futuroPrecoSugeridoCentavos":2990,"descricao":"Conexão bancária automática via Open Finance","observacao":"Disponível após ativação do provedor Pluggy"}}'::jsonb,
    true
  ),
  (
    'pf_premium',
    'PF Premium',
    'O financeiro completo.',
    4990,
    'mensal',
    '{"segmento":"pf","limiteUsuarios":1,"limiteWhatsappNumeros":5,"limiteLancamentos":null,"whatsappTexto":true,"whatsappAudio":true,"whatsappComprovante":true,"iaComprovante":true,"dreCompleto":false,"centroCusto":false,"projetos":false,"apiAccess":false,"suportePrioritario":true,"openFinance":false,"integracaoPfPj":false,"openFinanceAddon":{"ativo":false,"precoCentavos":0,"futuroPrecoSugeridoCentavos":4990,"descricao":"Conexão bancária automática via Open Finance","observacao":"Disponível após ativação do provedor Pluggy"}}'::jsonb,
    true
  ),
  (
    'pj_start',
    'PJ Start',
    'Para equipes pequenas.',
    5990,
    'mensal',
    '{"segmento":"pj","limiteUsuarios":3,"limiteWhatsappNumeros":2,"limiteLancamentos":null,"whatsappTexto":true,"whatsappAudio":true,"whatsappComprovante":false,"iaComprovante":false,"dreCompleto":false,"centroCusto":true,"projetos":false,"apiAccess":false,"suportePrioritario":false,"openFinance":false,"integracaoPfPj":true,"openFinanceAddon":{"ativo":false,"precoCentavos":0,"futuroPrecoSugeridoCentavos":2990,"descricao":"Conexão bancária automática via Open Finance","observacao":"Disponível após ativação do provedor Pluggy"}}'::jsonb,
    true
  ),
  (
    'pj_pro',
    'PJ Pro',
    'Para empresas em crescimento.',
    9990,
    'mensal',
    '{"segmento":"pj","limiteUsuarios":8,"limiteWhatsappNumeros":5,"limiteLancamentos":null,"whatsappTexto":true,"whatsappAudio":true,"whatsappComprovante":true,"iaComprovante":true,"dreCompleto":true,"centroCusto":true,"projetos":true,"apiAccess":false,"suportePrioritario":false,"openFinance":false,"integracaoPfPj":true,"openFinanceAddon":{"ativo":false,"precoCentavos":0,"futuroPrecoSugeridoCentavos":2990,"descricao":"Conexão bancária automática via Open Finance","observacao":"Disponível após ativação do provedor Pluggy"}}'::jsonb,
    true
  ),
  (
    'pj_business',
    'PJ Business',
    'Para empresas exigentes.',
    19990,
    'mensal',
    '{"segmento":"pj","limiteUsuarios":20,"limiteWhatsappNumeros":15,"limiteLancamentos":null,"whatsappTexto":true,"whatsappAudio":true,"whatsappComprovante":true,"iaComprovante":true,"dreCompleto":true,"centroCusto":true,"projetos":true,"apiAccess":true,"suportePrioritario":true,"openFinance":false,"integracaoPfPj":true,"openFinanceAddon":{"ativo":false,"precoCentavos":0,"futuroPrecoSugeridoCentavos":4990,"descricao":"Conexão bancária automática via Open Finance","observacao":"Disponível após ativação do provedor Pluggy"}}'::jsonb,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  preco_centavos = EXCLUDED.preco_centavos,
  intervalo = EXCLUDED.intervalo,
  recursos = EXCLUDED.recursos,
  ativo = EXCLUDED.ativo;

UPDATE planos SET ativo = false WHERE slug IN ('free', 'pro', 'empresarial');

-- PJ em planos PF ou legados equivalentes → plano PJ correto
UPDATE assinaturas a
SET plano_id = dest.id, updated_at = NOW()
FROM usuarios u, planos orig, planos dest
WHERE a.usuario_id = u.id
  AND orig.id = a.plano_id
  AND u.tipo_perfil = 'juridica'
  AND orig.slug IN ('free', 'pf_basico', 'pro', 'pf_plus', 'pf_premium', 'empresarial')
  AND dest.slug = CASE orig.slug
    WHEN 'free' THEN 'pj_start'
    WHEN 'pf_basico' THEN 'pj_start'
    WHEN 'pro' THEN 'pj_pro'
    WHEN 'pf_plus' THEN 'pj_pro'
    WHEN 'pf_premium' THEN 'pj_business'
    WHEN 'empresarial' THEN 'pj_business'
  END
  AND a.plano_id IS DISTINCT FROM dest.id;

-- PF em planos PJ → plano PF equivalente (idempotente, evita mismatch inverso)
UPDATE assinaturas a
SET plano_id = dest.id, updated_at = NOW()
FROM usuarios u, planos orig, planos dest
WHERE a.usuario_id = u.id
  AND orig.id = a.plano_id
  AND u.tipo_perfil = 'fisica'
  AND orig.slug IN ('pj_start', 'pj_pro', 'pj_business')
  AND dest.slug = CASE orig.slug
    WHEN 'pj_start' THEN 'pf_basico'
    WHEN 'pj_pro' THEN 'pf_plus'
    WHEN 'pj_business' THEN 'pf_premium'
  END
  AND a.plano_id IS DISTINCT FROM dest.id;
