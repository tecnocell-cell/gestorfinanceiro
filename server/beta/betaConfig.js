/**
 * Modo beta fechado — Etapa 7.7
 * Ative com BETA_MODE=true no .env
 */

export function isBetaMode() {
  return String(process.env.BETA_MODE || '').toLowerCase() === 'true';
}

export function getBetaPublicConfig() {
  const active = isBetaMode();
  return {
    betaMode: active,
    message: active
      ? 'Você está usando uma versão beta. Ajude-nos reportando dificuldades.'
      : null,
    feedbackChannel: active ? 'in_app' : null,
  };
}
