/** Detalhes técnicos só em dev ou super admin (role admin). */
export function canShowTechnicalDetails(user) {
  return Boolean(import.meta.env.DEV || user?.role === "admin");
}

export function publicOrTechnical(text, technicalFallback, user) {
  if (canShowTechnicalDetails(user)) return text;
  return technicalFallback;
}
