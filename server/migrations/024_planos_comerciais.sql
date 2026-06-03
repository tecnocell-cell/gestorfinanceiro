-- Etapa 6.3B — Planos comerciais PF/PJ (substitui Free/Pro/Empresarial)

UPDATE planos SET ativo = false WHERE slug IN ('free', 'pro', 'empresarial');

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

-- Migra assinaturas dos planos legados
UPDATE assinaturas a SET plano_id = p.id, updated_at = NOW()
FROM planos p
WHERE p.slug = 'pf_basico'
  AND a.plano_id IN (SELECT id FROM planos WHERE slug = 'free');

UPDATE assinaturas a SET plano_id = p.id, updated_at = NOW()
FROM planos p
WHERE p.slug = 'pf_plus'
  AND a.plano_id IN (SELECT id FROM planos WHERE slug = 'pro');

UPDATE assinaturas a SET plano_id = p.id, updated_at = NOW()
FROM planos p
WHERE p.slug = 'pj_business'
  AND a.plano_id IN (SELECT id FROM planos WHERE slug = 'empresarial');
