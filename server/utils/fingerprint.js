/**
 * fingerprint — geração de fingerprints para deduplicação de transações
 *
 * Estratégia:
 *   1. Se a transação tem FITID (campo do padrão OFX): usa FITID como base.
 *      FITID é único por banco+conta+transação — o identificador ideal.
 *
 *   2. Sem FITID: calcula SHA-256 determinístico com:
 *      usuario_id | data | valor_em_centavos | tipo | historico_normalizado
 *
 * O campo usuario_id garante isolamento entre tenants.
 */

import { createHash } from 'crypto';
import { reaisToCentavos } from './money.js';

/**
 * Normaliza texto para uso no fingerprint.
 * Remove acentos, lowercase, trim, colapsa espaços, limita a 40 chars.
 */
function normText(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // remove combining diacritics
    .replace(/\s+/g, ' ')
    .slice(0, 40);
}

/**
 * Gera fingerprint para uma transação.
 *
 * @param {string} usuarioId  — UUID do usuário (tenant isolation)
 * @param {object} tx         — { data, valor, tipo, historico, fitid? }
 * @returns {string}          — hex string de 64 chars (SHA-256)
 */
export function gerarFingerprint(usuarioId, tx) {
  if (tx.fitid) {
    // FITID: identificador nativo do banco — mais confiável
    const payload = `fitid:${usuarioId}:${String(tx.fitid).trim()}`;
    return createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  // Fingerprint calculado: todos os campos relevantes
  const valorCents = reaisToCentavos(tx.valor);
  const payload = [
    usuarioId,
    String(tx.data || ''),
    String(valorCents),
    String(tx.tipo || ''),
    normText(tx.historico),
  ].join('|');

  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Gera fingerprints para um batch de transações.
 * Retorna mapa { fingerprint → tx } para consulta eficiente.
 *
 * @param {string}   usuarioId
 * @param {Array}    txs
 * @returns {Map<string, object>}
 */
export function gerarFingerprintsBatch(usuarioId, txs) {
  const map = new Map();
  for (const tx of txs) {
    const fp = gerarFingerprint(usuarioId, tx);
    // Em caso de colisão local (dois itens idênticos no mesmo arquivo): mantém o primeiro
    if (!map.has(fp)) {
      map.set(fp, tx);
    }
  }
  return map;
}
