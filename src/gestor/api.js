// Cliente HTTP — chama a API REST do Gestor Financeiro

const BASE = "/api";

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
      "Servidor indisponível. Para uso local clique em 'Usar sem conta', " +
      "ou inicie o backend com: npm run dev:all"
    );
  }

  if (res.status === 401) {
    localStorage.removeItem("gestor_token");
    localStorage.removeItem("gestor_user");
    window.location.reload();
    return;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 502 || res.status === 503) {
      throw new Error(
        "Servidor indisponível (502). Para uso local clique em 'Usar sem conta', " +
        "ou inicie o backend com: npm run dev:all"
      );
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
  listUsers: () =>
    request("/admin/users"),

  createUser: (data) =>
    request("/admin/users", { method: "POST", body: data }),

  toggleUser: (id) =>
    request(`/admin/users/${id}/toggle`, { method: "PATCH" }),

  resetPassword: (id, nova_senha) =>
    request(`/admin/users/${id}/reset-password`, { method: "PATCH", body: { nova_senha } }),

  deleteUser: (id) =>
    request(`/admin/users/${id}`, { method: "DELETE" }),
};

// ─── Helpers de token ─────────────────────────────────────────────────────────
export const tokenStorage = {
  get:     () => localStorage.getItem("gestor_token"),
  set:     (t) => localStorage.setItem("gestor_token", t),
  clear:   () => { localStorage.removeItem("gestor_token"); localStorage.removeItem("gestor_user"); },
  getUser: () => { try { return JSON.parse(localStorage.getItem("gestor_user")); } catch { return null; } },
  setUser: (u) => localStorage.setItem("gestor_user", JSON.stringify(u)),
};
