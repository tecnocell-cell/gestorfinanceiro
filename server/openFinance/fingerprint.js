import { createHash } from 'crypto';

/**
 * Fingerprint estável por usuário + conexão + id da transação no provider.
 */
export function gerarFingerprintOpenFinance(usuarioId, connectionId, transactionIdProvider) {
  const payload = `openfinance:${usuarioId}:${connectionId}:${String(transactionIdProvider).trim()}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
