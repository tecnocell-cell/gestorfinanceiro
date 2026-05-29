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

  const apiError = (() => {
    const raw = data.error ?? data.message ?? "";
    if (raw === "invalid_credentials") {
      return "E-mail ou senha incorretos. Outro serviço pode estar usando a porta 3001 — use apenas npm run dev:all no Gestor.";
    }
    return typeof raw === "string" && raw ? raw : "";
  })();

  if (res.status === 401 || (res.status === 403 && path === "/auth/login")) {
    // Login inválido: não limpa sessão nem recarrega a página
    if (path === "/auth/login") {
      throw new Error(apiError || "E-mail ou senha incorretos.");
    }
    const hadSession = !!localStorage.getItem("gestor_token");
    localStorage.removeItem("gestor_token");
    localStorage.removeItem("gestor_user");
    if (hadSession) window.location.reload();
    throw new Error(apiError || "Sessão expirada.");
  }

  if (!res.ok) {
    if (res.status === 502 || res.status === 503) {
      throw new Error("Servidor indisponível. Inicie o backend com: npm run server");
    }
    throw new Error(apiError || `HTTP ${res.status}`);
  }

  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email, senha) =>
    request("/auth/login", { method: "POST", body: { email, senha } }),

  me: () => request("/auth/me"),

  register: (data) =>
    request("/auth/register", { method: "POST", body: data }),

  verify: (data) =>
    request("/auth/verify", { method: "POST", body: data }),

  resendCode: (data) =>
    request("/auth/resend-code", { method: "POST", body: data }),

  changePassword: (senha_atual, nova_senha) =>
    request("/auth/change-password", { method: "PATCH", body: { senha_atual, nova_senha } }),
};

// ─── Estado do App ────────────────────────────────────────────────────────────
export const stateApi = {
  fetch: () => request("/state"),
  save:  (state) => request("/state", { method: "PUT", body: { dados: state } }),
};

/** Saúde do backend PostgreSQL (Express) */
export const healthApi = {
  status: () => request("/status"),
};

// ─── Admin — gestão de tenants ────────────────────────────────────────────────
export const adminApi = {
  listUsers:     ()           => request("/admin/users"),
  createUser:    (data)       => request("/admin/users", { method: "POST", body: data }),
  toggleUser:    (id)         => request(`/admin/users/${id}/toggle`, { method: "PATCH" }),
  resetPassword: (id, senha)  => request(`/admin/users/${id}/reset-password`, { method: "PATCH", body: { nova_senha: senha } }),
  deleteUser:    (id)         => request(`/admin/users/${id}`, { method: "DELETE" }),
  getUserState:          (id)        => request(`/admin/users/${id}/state`),
  saveUserState:         (id, dados) => request(`/admin/users/${id}/state`, { method: "PUT", body: { dados } }),
  getUserRecorrencias:   (id)        => request(`/admin/users/${id}/recorrencias`),
  // WhatsApp Admin (apenas config global da instancia)
  waConfig:         ()     => request("/whatsapp-admin/config"),
  waSetConfig:      (data) => request("/whatsapp-admin/config", { method: "POST", body: data }),
  waInstanceStatus: ()     => request("/whatsapp-admin/instance-status"),
  waConnect:        ()     => request("/whatsapp-admin/connect",    { method: "POST" }),
  waDisconnect:     ()     => request("/whatsapp-admin/disconnect", { method: "POST" }),
};

// ─── Recorrências ─────────────────────────────────────────────────────────────
export const recorrenciasApi = {
  list:   ()         => request("/recorrencias"),
  create: (data)     => request("/recorrencias", { method: "POST", body: data }),
  update: (id, data) => request(`/recorrencias/${id}`, { method: "PATCH", body: data }),
  remove: (id)       => request(`/recorrencias/${id}`, { method: "DELETE" }),
  gerar:  (id)       => request(`/recorrencias/${id}/gerar`, { method: "POST" }),
};

// ─── WhatsApp Financeiro ──────────────────────────────────────────────────────
export const whatsappApi = {
  connect:          ()       => request("/whatsapp/connect",            { method: "POST" }),
  status:           ()       => request("/whatsapp/status"),
  disconnect:       ()       => request("/whatsapp/disconnect",         { method: "POST" }),
  gatewayHealth:    ()       => request("/whatsapp/gateway-health"),
  pfConfig:         ()       => request("/whatsapp/pf-config"),
  myAuthorized:     ()       => request("/whatsapp/my-authorized"),
  // CRUD de numeros autorizados (usuario autenticado, sem UUID manual)
  listAuthorized:   ()       => request("/whatsapp/authorized"),
  addAuthorized:    (data)   => request("/whatsapp/authorized",         { method: "POST",  body: data }),
  updateAuthorized: (id, d)  => request(`/whatsapp/authorized/${id}`,   { method: "PATCH", body: d }),
  deleteAuthorized: (id)     => request(`/whatsapp/authorized/${id}`,   { method: "DELETE" }),
  planLimit:        ()       => request("/whatsapp/plan-limit"),
  inbox:            (p)      => request(`/whatsapp/inbox?limit=${p?.limit||50}&offset=${p?.offset||0}${p?.status ? "&status="+p.status : ""}`),
  pending:          (p)      => request(`/whatsapp/pending?limit=${p?.limit||20}&offset=${p?.offset||0}${p?.status ? "&status="+p.status : ""}`),
};

// ─── Helpers de token ─────────────────────────────────────────────────────────
export const tokenStorage = {
  get:     () => localStorage.getItem("gestor_token"),
  set:     (t) => localStorage.setItem("gestor_token", t),
  clear:   () => { localStorage.removeItem("gestor_token"); localStorage.removeItem("gestor_user"); },
  getUser: () => { try { return JSON.parse(localStorage.getItem("gestor_user")); } catch { return null; } },
  setUser: (u) => localStorage.setItem("gestor_user", JSON.stringify(u)),
};