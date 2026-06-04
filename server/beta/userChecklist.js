import { query } from '../db.js';

export const CHECKLIST_PF = [
  { key: 'onboarding', label: 'Concluir onboarding' },
  { key: 'whatsapp', label: 'Cadastrar WhatsApp' },
  { key: 'lancamento', label: 'Criar lançamento' },
  { key: 'pdf_export', label: 'Exportar PDF' },
  { key: 'plano_assinatura', label: 'Testar plano / assinatura' },
];

export const CHECKLIST_PJ = [
  { key: 'onboarding', label: 'Concluir onboarding' },
  { key: 'cliente', label: 'Cadastrar cliente' },
  { key: 'centro_custo', label: 'Criar centro de custo' },
  { key: 'equipe', label: 'Convidar equipe' },
  { key: 'dre_pdf', label: 'Exportar DRE em PDF' },
  { key: 'plano_assinatura', label: 'Testar plano / assinatura' },
];

async function readProgressKeys(usuarioId) {
  const { rows } = await query(
    `SELECT item_key FROM beta_checklist_progress WHERE usuario_id = $1`,
    [usuarioId]
  );
  return new Set(rows.map((r) => r.item_key));
}

function activeEmpresa(dados) {
  if (!dados?.empresas?.length) return null;
  const id = dados.empresaAtivaId;
  return dados.empresas.find((e) => e.id === id) || dados.empresas[0];
}

function detectAuto(usuarioId, tipoPerfil, dados, progress, waCount, equipeCount) {
  const emp = activeEmpresa(dados);
  const isPf = tipoPerfil === 'fisica';
  const out = {};

  out.onboarding = Boolean(emp?.tourConcluido);
  out.whatsapp = waCount > 0;
  out.lancamento = (emp?.lancamentos?.length || 0) > 0;
  out.cliente = (emp?.clientes?.length || 0) > 0;
  out.centro_custo = (emp?.centroCustos?.length || 0) > 0;
  out.equipe = equipeCount > 0;

  if (progress.has('pdf_export')) out.pdf_export = true;
  if (progress.has('dre_pdf')) out.dre_pdf = true;
  if (progress.has('plano_assinatura')) out.plano_assinatura = true;

  return out;
}

export async function getUserBetaChecklist(usuarioId, tipoPerfil) {
  const itemsDef = tipoPerfil === 'fisica' ? CHECKLIST_PF : CHECKLIST_PJ;

  const [{ rows: st }, { rows: wa }, { rows: eq }, progress] = await Promise.all([
    query('SELECT dados FROM estados WHERE usuario_id = $1', [usuarioId]),
    query(
      `SELECT COUNT(*)::int AS c FROM whatsapp_authorized_numbers
       WHERE usuario_id = $1 AND active = true`,
      [usuarioId]
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM empresa_usuarios
       WHERE empresa_usuario_id = $1 AND status != 'removido'`,
      [usuarioId]
    ).catch(() => ({ rows: [{ c: 0 }] })),
    readProgressKeys(usuarioId),
  ]);

  const rawDados = st[0]?.dados;
  const dados =
    rawDados == null
      ? null
      : typeof rawDados === 'string'
        ? JSON.parse(rawDados)
        : rawDados;
  const auto = detectAuto(
    usuarioId,
    tipoPerfil,
    dados,
    progress,
    wa[0]?.c || 0,
    eq[0]?.c || 0
  );

  const items = itemsDef.map((item) => ({
    ...item,
    done: Boolean(auto[item.key]),
  }));
  const done = items.filter((i) => i.done).length;
  return {
    segmento: tipoPerfil === 'fisica' ? 'pf' : 'pj',
    items,
    done,
    total: items.length,
    percent: items.length ? Math.round((done / items.length) * 100) : 0,
  };
}

export async function markChecklistItem(usuarioId, itemKey) {
  const allowed = new Set([
    ...CHECKLIST_PF.map((i) => i.key),
    ...CHECKLIST_PJ.map((i) => i.key),
  ]);
  if (!allowed.has(itemKey)) throw new Error('Item de checklist inválido.');
  await query(
    `INSERT INTO beta_checklist_progress (usuario_id, item_key)
     VALUES ($1, $2)
     ON CONFLICT (usuario_id, item_key) DO UPDATE SET completed_at = NOW()`,
    [usuarioId, itemKey]
  );
  return { ok: true, item_key: itemKey };
}

export async function getBetaChecklistAggregate() {
  const { rows: users } = await query(
    `SELECT id, tipo_perfil FROM usuarios WHERE role = 'user' AND ativo = true LIMIT 500`
  );
  if (!users.length) {
    return { media_percent: 0, usuarios: 0, amostra: 0 };
  }
  let sum = 0;
  for (const u of users) {
    const cl = await getUserBetaChecklist(u.id, u.tipo_perfil);
    sum += cl.percent;
  }
  return {
    media_percent: Math.round(sum / users.length),
    usuarios: users.length,
    amostra: users.length,
  };
}
