/**
 * Auditoria de cobrança — Etapa 8.1
 */
import { query } from '../db.js';
import {
  gatewayProviderLabel,
  metodoPagamentoLabel,
} from '../billing/paymentConfigService.js';

export async function listRecentPayments({ limit = 40 } = {}) {
  const { rows } = await query(
    `SELECT p.id, p.valor_centavos, p.status, p.gateway, p.gateway_payment_id,
            p.created_at, p.payload, p.fatura_id,
            f.pago_em,
            u.id AS usuario_id, u.nome AS cliente_nome, u.email AS cliente_email,
            pl.slug AS plano_slug, pl.nome AS plano_nome
     FROM pagamentos p
     JOIN usuarios u ON u.id = p.usuario_id
     LEFT JOIN faturas f ON f.id = p.fatura_id
     LEFT JOIN assinaturas a ON a.id = p.assinatura_id
     LEFT JOIN planos pl ON pl.id = a.plano_id
     ORDER BY p.created_at DESC
     LIMIT $1`,
    [limit]
  );

  return rows.map((r) => {
    const payload =
      typeof r.payload === 'string'
        ? (() => {
            try {
              return JSON.parse(r.payload);
            } catch {
              return {};
            }
          })()
        : r.payload || {};
    return {
      id: r.id,
      cliente: { id: r.usuario_id, nome: r.cliente_nome, email: r.cliente_email },
      plano: r.plano_slug ? { slug: r.plano_slug, nome: r.plano_nome } : null,
      gateway: r.gateway,
      gateway_label: gatewayProviderLabel(r.gateway),
      metodo: metodoPagamentoLabel(payload),
      status: r.status,
      valor_centavos: Number(r.valor_centavos),
      criado_em: r.created_at,
      pago_em: r.pago_em || (r.status === 'confirmado' ? r.created_at : null),
      fatura_id: r.fatura_id,
      gateway_payment_id: r.gateway_payment_id,
    };
  });
}
