// Em dev: VITE_API_URL = http://localhost:3001/api  (definido em .env.development)
// Em prod: VITE_API_URL não existe → usa "/api" relativo (Express serve tudo)
const BASE = import.meta.env.VITE_API_URL ?? "/api";

async function request(path, options = {}) {
  const token = localStorage.getItem("gestor_token");

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error(
      "Servidor indisponível. Inicie o backend com: npm run server"
    );
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    // Login inválido: não limpa sessão nem recarrega a página
    if (path === "/auth/login") {
      throw new Error(data.error || "E-mail ou senha incorretos.");
    }
    const hadSession = !!localStorage.getItem("gestor_token");
    localStorage.removeItem("gestor_token");
    localStorage.removeItem("gestor_user");
    if (hadSession) window.location.reload();
    throw new Error(data.error || "Sessão expirada.");
  }

  if (!res.ok) {
    if (res.status === 502 || res.status === 503) {
      throw new Error("Servidor indisponível. Inicie o backend com: npm run server");
    }
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, senha) =>
    request("/auth/login", { method: "POST", body: { email, senha } }),

  changePassword: (senha_atual, nova_senha) =>
    request("/auth/change-password", { method: "PATCH", body: { senha_atual, nova_senha } }),
};

// ─── Estado do App ────────────────────────────────────────────────────────────
export const stateApi = {
  fetch: () => request("/state"),
  save:  (state) => request("/state", { method: "PUT", body: { dados: state } }),
};

// ─── Admin — gestão de tenants ────────────────────────────────────────────────
export const adminApi = {
  listUsers:     ()           => request("/admin/users"),
  createUser:    (data)       => request("/admin/users", { method: "POST", body: data }),
  toggleUser:    (id)         => request(`/admin/users/${id}/toggle`, { method: "PATCH" }),
  resetPassword: (id, senha)  => request(`/admin/users/${id}/reset-password`, { method: "PATCH", body: { nova_senha: senha } }),
  deleteUser:    (id)         => request(`/admin/users/${id}`, { method: "DELETE" }),
};

// ─── Helpers de token ─────────────────────────────────────────────────────────
export const tokenStorage = {
  get:     () => localStorage.getItem("gestor_token"),
  set:     (t) => localStorage.setItem("gestor_token", t),
  clear:   () => { localStorage.removeItem("gestor_token"); localStorage.removeItem("gestor_user"); },
  getUser: () => { try { return JSON.parse(localStorage.getItem("gestor_user")); } catch { return null; } },
  setUser: (u) => localStorage.setItem("gestor_user", JSON.stringify(u)),
};
