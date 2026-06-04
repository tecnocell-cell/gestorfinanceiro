/**
 * Texto padrão de convite ao beta — copiar manualmente ou colar em e-mail/WhatsApp.
 */
export function buildBetaInviteText({ nome, appUrl } = {}) {
  const url = appUrl || (typeof window !== "undefined" ? window.location.origin : "https://app.fluxiva.com.br");
  const who = nome ? `${nome}, ` : "";
  return `${who}Você foi convidado para testar o Fluxiva Beta.

O Fluxiva é o gestor financeiro da sua operação (PF ou PJ). Nesta fase beta, sua opinião ajuda a melhorar o produto antes do lançamento oficial.

Como participar:
1. Acesse: ${url}
2. Faça login com o e-mail deste convite
3. Siga o checklist no dashboard (onboarding, cadastros e um teste de exportação)
4. Use o botão "Enviar feedback" no canto da tela para reportar bugs, dúvidas ou sugestões

Obrigado por testar conosco!
Equipe Fluxiva`;
}

export const BETA_INVITE_SUBJECT = "Convite — Fluxiva Beta";
