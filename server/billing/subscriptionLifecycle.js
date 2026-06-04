import { query } from '../db.js';

const GRACE_DAYS_ATRASADA = 30;

export async function refreshSubscriptionLifecycle(usuarioId) {
  const { rows } = await query(
    `SELECT a.id, a.status, a.fim_em, a.trial_ate, a.cancelada_em, a.acesso_ate, a.proxima_cobranca
     FROM assinaturas a WHERE a.usuario_id = $1`,
    [usuarioId]
  );
  const sub = rows[0];
  if (!sub) return;

  const now = new Date();
  const status = sub.status;

  if (status === 'cancelada' && sub.acesso_ate && now > new Date(sub.acesso_ate)) {
    await query(
      `UPDATE assinaturas SET status = 'vencida', updated_at = NOW() WHERE id = $1 AND status = 'cancelada'`,
      [sub.id]
    );
    return;
  }

  if (status === 'ativa' || status === 'atrasada') {
    const { rows: overdue } = await query(
      `SELECT id, vencimento FROM faturas
       WHERE assinatura_id = $1 AND status = 'pendente' AND vencimento < CURRENT_DATE
       ORDER BY vencimento ASC LIMIT 1`,
      [sub.id]
    );

    if (overdue.length) {
      const firstDue = new Date(overdue[0].vencimento);
      const daysLate = Math.floor((now - firstDue) / (86400 * 1000));

      if (daysLate >= GRACE_DAYS_ATRASADA) {
        await query(
          `UPDATE assinaturas SET status = 'vencida', updated_at = NOW() WHERE id = $1`,
          [sub.id]
        );
        await query(
          `UPDATE faturas SET status = 'vencida' WHERE id = $1 AND status = 'pendente'`,
          [overdue[0].id]
        );
      } else if (status === 'ativa') {
        await query(
          `UPDATE assinaturas SET status = 'atrasada', updated_at = NOW() WHERE id = $1`,
          [sub.id]
        );
      }
    }
    /* status 'atrasada' só volta a 'ativa' via pagamento confirmado (webhook), não por data de vencimento local */
  }
}

export function buildBillingAvisos(assinaturaRow) {
  const avisos = [];
  const now = new Date();

  if (assinaturaRow?.status === 'trial' && assinaturaRow.trial_ate) {
    if (now > new Date(assinaturaRow.trial_ate)) {
      avisos.push(
        'Seu período de teste expirou. Assine um plano para continuar com todos os recursos. Seus dados permanecem salvos.'
      );
    }
  }

  if (assinaturaRow?.status === 'atrasada') {
    avisos.push(
      'Pagamento em atraso. Regularize para evitar limitação de recursos premium. Seus dados não serão apagados.'
    );
  }

  if (assinaturaRow?.status === 'vencida') {
    avisos.push(
      'Assinatura vencida há mais de 30 dias: recursos premium foram limitados. Seus lançamentos e dados permanecem intactos.'
    );
  }

  if (assinaturaRow?.status === 'cancelada' && assinaturaRow.acesso_ate) {
    if (now <= new Date(assinaturaRow.acesso_ate)) {
      avisos.push(
        `Assinatura cancelada. Acesso mantido até ${new Date(assinaturaRow.acesso_ate).toLocaleDateString('pt-BR')}.`
      );
    }
  }

  return avisos;
}
