/**
 * centerflowApi.ts
 *
 * Cliente HTTP da landing para o backend CenterFlow real.
 * Configurado via variáveis VITE_ (nunca expõe segredos).
 *
 * Endpoints usados:
 *   POST /api/auth/login    → { token, user }
 *   POST /api/auth/register → { ok, message, email, canal, ttl_minutos }
 *   POST /api/auth/verify   → { ok, token, user }
 *
 * Handoff cross-domain (centerflow.app → financeiro.centertech.cloud):
 *   redirectToApp() envia ?auth_token=… (&auth_user=… opcional)
 *   O app principal consome e salva em gestor_token / gestor_user.
 */

// ── Config ────────────────────────────────────────────────────────────────────

const API_URL =
  (import.meta.env.VITE_CENTERFLOW_API_URL as string | undefined) ||
  "http://localhost:3001/api";

export const APP_URL =
  (import.meta.env.VITE_CENTERFLOW_APP_URL as string | undefined) ||
  "http://localhost:5173";

/** Chaves idênticas às usadas em src/gestor/api.js do app autenticado. */
const TOKEN_KEY = "gestor_token";
const USER_KEY  = "gestor_user";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CfUser {
  id:          string;
  email:       string;
  nome:        string;
  role:        string;
  tipo_perfil: string;
  nome_perfil: string;
}

export interface LoginResponse {
  token: string;
  user:  CfUser;
}

export interface RegisterResponse {
  ok:           boolean;
  message:      string;
  email:        string;
  canal:        string;
  ttl_minutos?: number;
  /** Presente apenas em ambientes dev para facilitar testes */
  dev_code?:    string;
}

export interface VerifyResponse {
  ok:    boolean;
  token: string;
  user:  CfUser;
}

export interface ApiError extends Error {
  status: number;
  data:   unknown;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
    // credentials: "include" só necessário para cookies; o app usa Bearer token
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = { error: `HTTP ${res.status}` };
  }

  if (!res.ok) {
    const err = new Error(
      (data as { error?: string }).error || `Erro ${res.status}`
    ) as ApiError;
    err.status = res.status;
    err.data   = data;
    throw err;
  }

  return data as T;
}

// ── Sessão ────────────────────────────────────────────────────────────────────

/**
 * Salva token e user no localStorage (útil apenas em dev same-origin).
 * Em produção o handoff usa redirectToApp() — domínios diferentes não compartilham storage.
 */
export function saveSession(token: string, user: CfUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Redireciona para o app autenticado após login/verify bem-sucedido.
 * Passa token via query string; user opcional para evitar round-trip extra.
 * O app remove auth_token da URL com replaceState imediatamente.
 */
export function redirectToApp(token: string, user?: CfUser): void {
  const base = APP_URL.replace(/\/$/, "");
  const params = new URLSearchParams();
  params.set("auth_token", token);
  if (user) params.set("auth_user", JSON.stringify(user));
  window.location.href = `${base}?${params.toString()}`;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Retorna token + user. Salvar com saveSession() e redirecionar com redirectToApp().
 */
export async function login(email: string, senha: string): Promise<LoginResponse> {
  return post<LoginResponse>("/auth/login", { email, senha });
}

/**
 * POST /api/auth/register
 * Cria conta. NÃO retorna token — exige verificação por e-mail.
 * Backend não aceita plan_type ainda: salvar como pendingPlan no localStorage.
 */
export async function register(data: {
  nome:        string;
  email:       string;
  senha:       string;
  tipo_perfil: "fisica" | "juridica";
  nome_perfil: string;
  telefone?:   string;
}): Promise<RegisterResponse> {
  return post<RegisterResponse>("/auth/register", data);
}

/**
 * POST /api/auth/verify
 * Valida código enviado por e-mail. Retorna token + user.
 */
export async function verify(
  email:  string,
  codigo: string
): Promise<VerifyResponse> {
  return post<VerifyResponse>("/auth/verify", { email, codigo });
}

// ── Plano pendente ────────────────────────────────────────────────────────────

const PENDING_PLAN_KEY = "cf_pending_plan";

/**
 * Salva o plano escolhido no cadastro.
 * O backend ainda não persiste plan_type — isso é uma limitação conhecida.
 * O app autenticado poderá ler esse valor para pré-configurar o plano do usuário.
 */
export function savePendingPlan(planKey: string): void {
  localStorage.setItem(PENDING_PLAN_KEY, planKey);
}

export function getPendingPlan(): string | null {
  return localStorage.getItem(PENDING_PLAN_KEY);
}
