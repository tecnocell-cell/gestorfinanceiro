/**
 * Regras comerciais de troca de plano — Etapa 7.4
 *
 * UPGRADE: cobrança PIX do valor integral do novo plano; o plano só muda após
 * PAYMENT_RECEIVED / PAYMENT_CONFIRMED (via webhook ou atualizar-status).
 *
 * DOWNGRADE: aplicação imediata do plano menor, sem reembolso e sem cobrança
 * proporcional; o novo valor passa a valer na próxima renovação automática.
 */

export const BILLING_RULES_DOC = {
  upgrade:
    'Cobrança cheia do novo plano via PIX; ativação após confirmação do pagamento.',
  downgrade:
    'Mudança imediata para o plano inferior; sem reembolso; próxima fatura no novo valor.',
};

export function isUpgrade({ statusAtual, precoAtualCentavos, precoNovoCentavos }) {
  if (statusAtual === 'trial') return true;
  return precoNovoCentavos > precoAtualCentavos;
}

export function isDowngrade({ precoAtualCentavos, precoNovoCentavos, slugAtual, slugNovo }) {
  if (slugAtual === slugNovo) return false;
  return precoNovoCentavos < precoAtualCentavos;
}
