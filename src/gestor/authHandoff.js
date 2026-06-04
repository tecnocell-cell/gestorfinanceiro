/**
 * Handoff cross-domain: landing (fluxiva.app) → app (financeiro.fluxiva.app).
 * Lê auth_token da query, persiste em localStorage e limpa a URL imediatamente.
 * Nunca loga o token.
 */
import { tokenStorage } from "./api.js";

export function consumeAuthHandoffFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const authToken = params.get("auth_token");
  if (!authToken) return false;

  const authUserRaw = params.get("auth_user");

  const openPage = params.get("open_page");
  params.delete("auth_token");
  params.delete("auth_user");
  if (openPage) {
    try {
      sessionStorage.setItem("cf_open_page", openPage);
    } catch {
      /* ignore */
    }
    params.delete("open_page");
  }
  const qs = params.toString();
  const clean =
    window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
  window.history.replaceState(null, "", clean);

  tokenStorage.set(authToken);
  if (authUserRaw) {
    try {
      const user = JSON.parse(authUserRaw);
      if (user && typeof user === "object") tokenStorage.setUser(user);
    } catch {
      // AuthContext busca /auth/me quando necessário
    }
  }

  return true;
}
