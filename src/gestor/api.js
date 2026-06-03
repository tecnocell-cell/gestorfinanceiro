import { parseMoneyInputToCentavos } from "./finance.js";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

function integracaoValorBody(valor, data, observacao) {
  const valorCentavos = parseMoneyInputToCentavos(valor);
  if (!valorCentavos) {
    throw new Error("Valor inválido. Informe um valor maior que zero.");
  }
  return {
    valorCentavos: Math.trunc(valorCentavos),
    data,
    observacao: observacao || "",
  };
}

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
    // /auth/me: AuthContext trata sessão inválida — reload aqui quebrava handoff da landing
    if (hadSession && path !== "/auth/me") window.location.reload();
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

  security: () => request("/auth/security"),

  sendVerification: () =>
    request("/auth/send-verification", { method: "POST", body: {} }),

  verifyEmail: (token) =>
    request("/auth/verify-email", { method: "POST", body: { token } }),

  forgotPassword: (email) =>
    request("/auth/forgot-password", { method: "POST", body: { email } }),

  resetPassword: (token, nova_senha) =>
    request("/auth/reset-password", { method: "POST", body: { token, nova_senha } }),
};

// ─── Billing (planos e assinatura) ───────────────────────────────────────────
export const empresaApi = {
  context: () => request("/empresa/context"),
  membros: () => request("/empresa/membros"),
  convidar: (body) => request("/empresa/convidar", { method: "POST", body }),
  aceitarConvite: (token) =>
    request("/empresa/aceitar-convite", { method: "POST", body: { token } }),
  atualizarMembro: (id, body) =>
    request(`/empresa/membros/${id}`, { method: "PATCH", body }),
  removerMembro: (id) => request(`/empresa/membros/${id}`, { method: "DELETE" }),
};

export const billingApi = {
  planos: () => request("/billing/planos"),
  assinatura: () => request("/billing/assinatura"),
  usage: () => request("/billing/usage"),
  faturas: () => request("/billing/faturas"),
  pagamentos: () => request("/billing/pagamentos"),
  checkout: (plano_slug) =>
    request("/billing/checkout", { method: "POST", body: { plano_slug } }),
  cancelar: () => request("/billing/cancelar", { method: "POST", body: {} }),
  simularUpgrade: (plano_slug) =>
    request("/billing/assinatura/simular", { method: "POST", body: { plano_slug } }),
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
  gerar:  (id, body = {}) => request(`/recorrencias/${id}/gerar`, { method: "POST", body }),
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

// ─── Conexões Bancárias (interesse / roadmap) ─────────────────────────────────
export const conexoesApi = {
  listInteresse: () => request("/conexoes/interesse"),
  registerInteresse: (banco_slug) =>
    request("/conexoes/interesse", { method: "POST", body: { banco_slug } }),
};

// ─── Open Finance MVP (Etapa 6.1) ─────────────────────────────────────────────
export const openFinanceApi = {
  status: () => request("/open-finance/status"),
  listConnections: () => request("/open-finance/connections"),
  initConnect: () =>
    request("/open-finance/connect/init", { method: "POST", body: {} }),
  completePluggyConnection: (itemId) =>
    request("/open-finance/connections/pluggy", { method: "POST", body: { itemId } }),
  createMockConnection: (body = {}) =>
    request("/open-finance/connections/mock", { method: "POST", body }),
  syncConnection: (connectionId, contaId, planoId) =>
    request(`/open-finance/connections/${connectionId}/sync`, {
      method: "POST",
      body: { contaId, planoId: planoId || null },
    }),
  deleteConnection: (connectionId) =>
    request(`/open-finance/connections/${connectionId}`, { method: "DELETE" }),
  listTransactions: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.connectionId) qs.set("connectionId", params.connectionId);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const q = qs.toString();
    return request(q ? `/open-finance/transactions?${q}` : "/open-finance/transactions");
  },
  listSyncLogs: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.connectionId) qs.set("connectionId", params.connectionId);
    if (params.limit != null) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return request(q ? `/open-finance/sync-logs?${q}` : "/open-finance/sync-logs");
  },
};
// ─── Importações (OFX com histórico e deduplicação) ──────────────────────────
export const importacoesApi = {
  /**
   * Preview OFX/QIF — parse + deduplicação, sem gravar lançamentos (Etapa 4.6A).
   * fileContent: string (conteúdo do arquivo, não base64)
   */
  previewOFX: (contaId, planoId, fileName, fileContent) =>
    request("/importacoes/ofx-preview", {
      method: "POST",
      body: { contaId, planoId, fileName, fileContent },
    }),

  /** Confirma importação OFX — grava novas transações no JSONB (Etapa 4.6B) */
  confirmarOFX: (contaId, planoId, fileName, fileContent) =>
    request("/importacoes/ofx-confirmar", {
      method: "POST",
      body: { contaId, planoId, fileName, fileContent },
    }),

  /** Lista histórico de importações (paginado) */
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const q = qs.toString();
    return request(q ? `/importacoes?${q}` : "/importacoes");
  },

  /** Detalhe de uma importação + lançamentos do lote (somente leitura) */
  get: (id) => request(`/importacoes/${id}`),

  /** Desfaz importação (OFX/CSV/XLSX) pelo lote */
  rollback: (id) =>
    request(`/importacoes/${id}/rollback`, { method: "POST" }),

  /** Preview CSV — sem columnMap retorna headers/suggestedMapping; com columnMap retorna dedup */
  previewCSV: (contaId, planoId, fileName, fileContent, columnMap) =>
    request("/importacoes/csv-preview", {
      method: "POST",
      body: { contaId, planoId, fileName, fileContent, columnMap: columnMap || undefined },
    }),

  confirmarCSV: (contaId, planoId, fileName, fileContent, columnMap) =>
    request("/importacoes/csv-confirmar", {
      method: "POST",
      body: { contaId, planoId, fileName, fileContent, columnMap },
    }),

  previewXLSX: (contaId, planoId, fileName, fileContent, columnMap) =>
    request("/importacoes/xlsx-preview", {
      method: "POST",
      body: { contaId, planoId, fileName, fileContent, columnMap: columnMap || undefined },
    }),

  confirmarXLSX: (contaId, planoId, fileName, fileContent, columnMap) =>
    request("/importacoes/xlsx-confirmar", {
      method: "POST",
      body: { contaId, planoId, fileName, fileContent, columnMap },
    }),
};


// ─── Integração PF/PJ (vínculo único — Etapa 5.0B) ───────────────────────────
export const integracaoPfPjApi = {
  getVinculo: () => request("/integracao-pf-pj/vinculo"),
  buscarPf: (email) =>
    request(`/integracao-pf-pj/buscar-pf?email=${encodeURIComponent(email)}`),
  criarVinculo: (email) =>
    request("/integracao-pf-pj/vinculo", { method: "POST", body: { email } }),
  revogarVinculo: () =>
    request("/integracao-pf-pj/vinculo", { method: "DELETE" }),
  aceitar: (vinculoId) =>
    request("/integracao-pf-pj/aceitar", {
      method: "POST",
      body: vinculoId ? { vinculoId } : {},
    }),
  recusar: (vinculoId) =>
    request("/integracao-pf-pj/recusar", {
      method: "POST",
      body: vinculoId ? { vinculoId } : {},
    }),

  previewProLabore: (valor, data, observacao) =>
    request("/integracao-pf-pj/pro-labore/preview", {
      method: "POST",
      body: integracaoValorBody(valor, data, observacao),
    }),

  confirmarProLabore: (valor, data, observacao) =>
    request("/integracao-pf-pj/pro-labore", {
      method: "POST",
      body: integracaoValorBody(valor, data, observacao),
    }),

  previewLucros: (valor, data, observacao) =>
    request("/integracao-pf-pj/lucros/preview", {
      method: "POST",
      body: integracaoValorBody(valor, data, observacao),
    }),

  confirmarLucros: (valor, data, observacao) =>
    request("/integracao-pf-pj/lucros", {
      method: "POST",
      body: integracaoValorBody(valor, data, observacao),
    }),

  previewSalario: (valor, data, observacao) =>
    request("/integracao-pf-pj/salario/preview", {
      method: "POST",
      body: integracaoValorBody(valor, data, observacao),
    }),

  confirmarSalario: (valor, data, observacao) =>
    request("/integracao-pf-pj/salario", {
      method: "POST",
      body: integracaoValorBody(valor, data, observacao),
    }),

  previewTransferencia: (valor, data, observacao) =>
    request("/integracao-pf-pj/transferencia/preview", {
      method: "POST",
      body: integracaoValorBody(valor, data, observacao),
    }),

  confirmarTransferencia: (valor, data, observacao) =>
    request("/integracao-pf-pj/transferencia", {
      method: "POST",
      body: integracaoValorBody(valor, data, observacao),
    }),

  listOperacoes: () => request("/integracao-pf-pj/operacoes"),

  rollbackOperacao: (id) =>
    request(`/integracao-pf-pj/operacoes/${id}/rollback`, { method: "POST" }),

  listAgendamentos: () => request("/integracao-pf-pj/agendamentos"),

  createAgendamento: ({ tipoOperacao, valor, valorCentavos, diaMes, observacao }) => {
    const cents = valorCentavos ?? parseMoneyInputToCentavos(valor);
    if (!cents) throw new Error("Valor inválido. Informe um valor maior que zero.");
    return request("/integracao-pf-pj/agendamentos", {
      method: "POST",
      body: {
        tipoOperacao,
        valorCentavos: Math.trunc(cents),
        diaMes,
        observacao: observacao || "",
      },
    });
  },

  updateAgendamento: (id, patch) => {
    const body = { ...patch };
    if (patch.valor != null && patch.valorCentavos == null) {
      const cents = parseMoneyInputToCentavos(patch.valor);
      if (!cents) throw new Error("Valor inválido.");
      body.valorCentavos = Math.trunc(cents);
      delete body.valor;
    }
    return request(`/integracao-pf-pj/agendamentos/${id}`, { method: "PATCH", body });
  },

  deleteAgendamento: (id) =>
    request(`/integracao-pf-pj/agendamentos/${id}`, { method: "DELETE" }),

  gerarRepassesMes: (mes, { forcar = false } = {}) =>
    request("/integracao-pf-pj/agendamentos/gerar-mes", {
      method: "POST",
      body: { ...(mes ? { mes } : {}), ...(forcar ? { forcar: true } : {}) },
    }),
};


// ─── Helpers de token ─────────────────────────────────────────────────────────
export const tokenStorage = {
  get:     () => localStorage.getItem("gestor_token"),
  set:     (t) => localStorage.setItem("gestor_token", t),
  clear:   () => { localStorage.removeItem("gestor_token"); localStorage.removeItem("gestor_user"); },
  getUser: () => { try { return JSON.parse(localStorage.getItem("gestor_user")); } catch { return null; } },
  setUser: (u) => localStorage.setItem("gestor_user", JSON.stringify(u)),
};