/**
 * Homologação Real Controlada — Etapa 8.2
 * Checklist manual ponta a ponta antes do beta aberto.
 */
import { query } from '../db.js';
import { listRecentPayments } from './billingAudit.js';
import { getSmtpAuditDetail } from '../emailProvider.js';
import { runReleaseCandidateChecks } from './releaseCandidate.js';

export const REAL_HOMOLOG_KEY = 'real_homologacao_v1';

export const REAL_SECTIONS = {
  pf: {
    label: 'PF completo',
    items: [
      { key: 'cadastro', label: 'Cadastro' },
      { key: 'verificacao', label: 'Verificação de e-mail' },
      { key: 'onboarding', label: 'Onboarding' },
      { key: 'whatsapp', label: 'WhatsApp' },
      { key: 'lancamento_manual', label: 'Lançamento manual' },
      { key: 'recorrencia', label: 'Recorrência' },
      { key: 'marcar_pago', label: 'Marcar pago' },
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'pdf', label: 'PDF' },
      { key: 'portal_cliente', label: 'Portal do cliente' },
      { key: 'pix_mp', label: 'Gerar PIX Mercado Pago' },
      { key: 'webhook', label: 'Webhook recebido' },
      { key: 'assinatura_ativa', label: 'Assinatura ativa' },
    ],
  },
  pj: {
    label: 'PJ completo',
    items: [
      { key: 'cadastro', label: 'Cadastro' },
      { key: 'empresa', label: 'Empresa' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'fornecedor', label: 'Fornecedor' },
      { key: 'centro_custo', label: 'Centro de custo' },
      { key: 'dre', label: 'DRE' },
      { key: 'equipe', label: 'Equipe' },
      { key: 'convite', label: 'Convite de membro' },
      { key: 'integracao_pj_pf', label: 'Integração PJ → PF' },
      { key: 'pdf', label: 'PDF' },
      { key: 'portal_cliente', label: 'Portal do cliente' },
      { key: 'pix_mp', label: 'Gerar PIX Mercado Pago' },
      { key: 'webhook', label: 'Webhook recebido' },
      { key: 'assinatura_ativa', label: 'Assinatura ativa' },
    ],
  },
  pagamento: {
    label: 'Pagamento completo',
    items: [
      { key: 'pix_gerado', label: 'PIX gerado com QR e copia e cola' },
      { key: 'pagamento_aprovado', label: 'Pagamento aprovado no gateway' },
      { key: 'webhook_processado', label: 'Webhook processado sem erro' },
      { key: 'fatura_paga', label: 'Fatura marcada como paga' },
      { key: 'assinatura_ativa', label: 'Assinatura ativa' },
      { key: 'trial_encerrado', label: 'Trial encerrado' },
      { key: 'proxima_cobranca', label: 'Próxima cobrança definida' },
      { key: 'webhook_idempotente', label: 'Webhook duplicado não duplica pagamento' },
    ],
  },
  email: {
    label: 'E-mail completo',
    items: [
      { key: 'smtp_ok', label: 'SMTP / Resend configurado' },
      { key: 'email_cobranca', label: 'E-mail de cobrança enviado' },
      { key: 'email_pagamento', label: 'E-mail de pagamento confirmado' },
      { key: 'email_verificacao', label: 'E-mail de verificação de cadastro' },
    ],
  },
  whatsapp: {
    label: 'WhatsApp completo',
    items: [
      { key: 'conexao', label: 'Conexão / gateway ativo' },
      { key: 'numero_autorizado', label: 'Número autorizado' },
      { key: 'lancamento_whatsapp', label: 'Lançamento via WhatsApp' },
      { key: 'notificacao_cobranca', label: 'Notificação de cobrança (se habilitado)' },
    ],
  },
  pdf: {
    label: 'PDF completo',
    items: [
      { key: 'pdf_pf', label: 'Relatório PDF PF exportado' },
      { key: 'pdf_pj', label: 'Relatório PDF PJ exportado' },
      { key: 'pdf_legivel', label: 'PDF legível e com dados corretos' },
    ],
  },
  suporte: {
    label: 'Suporte completo',
    items: [
      { key: 'pagina_ajuda', label: 'Página de ajuda acessível' },
      { key: 'contato_suporte', label: 'Contato / ticket de suporte' },
      { key: 'resposta_admin', label: 'Resposta do admin registrada' },
    ],
  },
  admin: {
    label: 'Super Admin',
    items: [
      { key: 'ver_cliente_pf', label: 'Ver cliente PF' },
      { key: 'ver_cliente_pj', label: 'Ver cliente PJ' },
      { key: 'ver_plano', label: 'Ver plano' },
      { key: 'ver_fatura', label: 'Ver fatura' },
      { key: 'ver_pagamento', label: 'Ver pagamento' },
      { key: 'alterar_plano', label: 'Alterar plano' },
      { key: 'reenviar_cobranca', label: 'Reenviar cobrança' },
      { key: 'marcar_pago_manual', label: 'Marcar pago manual' },
      { key: 'conferir_mrr_arr', label: 'Conferir MRR / ARR' },
    ],
  },
};

const SECTION_IDS = Object.keys(REAL_SECTIONS);
const MAX_ACTIVITY = 80;

function emptyMeta() {
  return {
    usuario_pf: '',
    usuario_pj: '',
    falhas: '',
    status: 'pendente',
    status_at: null,
    status_by: null,
  };
}

async function readState() {
  const { rows } = await query(`SELECT value FROM system_config WHERE key = $1`, [REAL_HOMOLOG_KEY]);
  if (!rows.length) {
    return { sections: {}, meta: emptyMeta(), activity: [] };
  }
  try {
    const v = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
    return {
      sections: v.sections || {},
      meta: { ...emptyMeta(), ...(v.meta || {}) },
      activity: Array.isArray(v.activity) ? v.activity : [],
    };
  } catch {
    return { sections: {}, meta: emptyMeta(), activity: [] };
  }
}

async function writeState(state) {
  await query(
    `INSERT INTO system_config (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [REAL_HOMOLOG_KEY, JSON.stringify(state)]
  );
}

function pushActivity(state, entry) {
  state.activity = [entry, ...(state.activity || [])].slice(0, MAX_ACTIVITY);
  console.info('[homologacao/real]', JSON.stringify(entry));
}

function mapSection(sectionId, def, raw) {
  const items = def.items.map((item) => ({
    ...item,
    checked: Boolean(raw?.[item.key]),
    checked_at: raw?.[`${item.key}_at`] || null,
    checked_by: raw?.[`${item.key}_by`] || null,
  }));
  const done = items.filter((i) => i.checked).length;
  return {
    id: sectionId,
    label: def.label,
    items,
    progress: {
      total: items.length,
      done,
      percent: items.length ? Math.round((done / items.length) * 100) : 0,
    },
  };
}

export async function getRealHomologacao() {
  const state = await readState();
  const sections = SECTION_IDS.map((id) => mapSection(id, REAL_SECTIONS[id], state.sections[id] || {}));
  const total = sections.reduce((n, s) => n + s.progress.total, 0);
  const done = sections.reduce((n, s) => n + s.progress.done, 0);

  return {
    meta: state.meta,
    sections,
    activity: state.activity || [],
    progress: {
      total,
      done,
      percent: total ? Math.round((done / total) * 100) : 0,
    },
  };
}

export async function setRealHomologacaoItem({ section, key, checked, adminEmail }) {
  const sectionId = SECTION_IDS.includes(section) ? section : null;
  if (!sectionId) return { ok: false, error: 'Seção inválida.' };
  const def = REAL_SECTIONS[sectionId];
  if (!def.items.some((i) => i.key === key)) {
    return { ok: false, error: 'Item de checklist inválido.' };
  }

  const state = await readState();
  if (!state.sections[sectionId]) state.sections[sectionId] = {};
  state.sections[sectionId][key] = checked;
  state.sections[sectionId][`${key}_at`] = checked ? new Date().toISOString() : null;
  state.sections[sectionId][`${key}_by`] = checked ? adminEmail || null : null;

  pushActivity(state, {
    at: new Date().toISOString(),
    by: adminEmail || null,
    action: checked ? 'check' : 'uncheck',
    section: sectionId,
    key,
    label: def.items.find((i) => i.key === key)?.label || key,
  });

  await writeState(state);
  return { ok: true, ...(await getRealHomologacao()) };
}

export async function setRealHomologacaoMeta({ usuario_pf, usuario_pj, falhas, status, adminEmail }) {
  const state = await readState();
  const meta = { ...state.meta };

  if (usuario_pf !== undefined) meta.usuario_pf = String(usuario_pf || '').trim();
  if (usuario_pj !== undefined) meta.usuario_pj = String(usuario_pj || '').trim();
  if (falhas !== undefined) meta.falhas = String(falhas || '').trim();

  if (status !== undefined) {
    const allowed = ['pendente', 'aprovado', 'reprovado'];
    if (!allowed.includes(status)) {
      return { ok: false, error: 'Status inválido. Use pendente, aprovado ou reprovado.' };
    }
    meta.status = status;
    meta.status_at = new Date().toISOString();
    meta.status_by = adminEmail || null;
    pushActivity(state, {
      at: meta.status_at,
      by: adminEmail || null,
      action: 'status',
      section: null,
      key: status,
      label: `Status → ${status}`,
    });
  }

  state.meta = meta;
  await writeState(state);
  return { ok: true, ...(await getRealHomologacao()) };
}

function collectPassosConcluidos(sections) {
  const out = [];
  for (const sec of sections) {
    for (const item of sec.items) {
      if (item.checked) {
        out.push({
          section: sec.id,
          section_label: sec.label,
          key: item.key,
          label: item.label,
          checked_at: item.checked_at,
          checked_by: item.checked_by,
        });
      }
    }
  }
  return out;
}

function collectPendentes(sections) {
  const out = [];
  for (const sec of sections) {
    for (const item of sec.items) {
      if (!item.checked) {
        out.push({
          section: sec.id,
          section_label: sec.label,
          key: item.key,
          label: item.label,
        });
      }
    }
  }
  return out;
}

export async function generateRealHomologacaoReport() {
  const checklist = await getRealHomologacao();
  const [pagamentos, smtp, rc] = await Promise.all([
    listRecentPayments({ limit: 10 }),
    getSmtpAuditDetail(),
    runReleaseCandidateChecks({}),
  ]);

  const passos_concluidos = collectPassosConcluidos(checklist.sections);
  const pendentes = collectPendentes(checklist.sections);
  const falhasInformadas = (checklist.meta.falhas || '').trim();
  const falhas = [
    ...pendentes.map((p) => `${p.section_label}: ${p.label}`),
    ...(falhasInformadas ? [falhasInformadas] : []),
  ];

  let status = checklist.meta.status || 'pendente';
  if (status === 'pendente') {
    if (checklist.progress.percent === 100 && !falhasInformadas) {
      status = 'pendente';
    } else if (checklist.progress.percent < 100 || falhasInformadas) {
      status = 'reprovado';
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    data: new Date().toLocaleDateString('pt-BR'),
    usuario_testado: {
      pf: checklist.meta.usuario_pf || null,
      pj: checklist.meta.usuario_pj || null,
    },
    passos_concluidos,
    pendentes,
    falhas_encontradas: falhasInformadas
      ? { texto: falhasInformadas, itens: falhas }
      : { texto: '', itens: pendentes.map((p) => `${p.section_label}: ${p.label}`) },
    status,
    status_manual: checklist.meta.status,
    progress: checklist.progress,
    sections: checklist.sections,
    signals: {
      pagamentos_recentes: pagamentos.length,
      smtp: smtp?.detected || null,
      rc_criticos_pendentes: (rc.criticalMissing || []).length,
    },
    activity: checklist.activity.slice(0, 20),
  };

  console.info('[homologacao/real/report]', JSON.stringify({
    status: report.status,
    progress: report.progress.percent,
    passos: report.passos_concluidos.length,
    pendentes: report.pendentes.length,
  }));

  return report;
}
