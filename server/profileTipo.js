/**
 * Normalização de tipo_perfil — mesma regra do cliente (profileLabels / auth/me).
 * Evita UI PJ com API 403 quando tipo_perfil está NULL no banco.
 */
export const DEFAULT_TIPO_PERFIL = 'juridica';

export function normalizeTipoPerfil(tipo) {
  const t = String(tipo ?? DEFAULT_TIPO_PERFIL).toLowerCase().trim();
  return t === 'fisica' ? 'fisica' : 'juridica';
}

export function isPessoaJuridica(tipo) {
  return normalizeTipoPerfil(tipo) === 'juridica';
}

export function isPessoaFisica(tipo) {
  return normalizeTipoPerfil(tipo) === 'fisica';
}
