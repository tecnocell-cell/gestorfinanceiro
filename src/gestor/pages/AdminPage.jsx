import { useState, useEffect, useCallback } from "react";
import { adminApi } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { CHART } from "../constants.js";

const fmt = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "Nunca";
const fmtDt = (iso) => iso ? new Date(iso).toLocaleString("pt-BR") : "Nunca";

function Badge({ tipo }) {
  const isPF = tipo === "fisica";
  return (
    <span className={`badge ${isPF ? "badge-pf" : "badge-pj"}`}>
      {isPF ? "PF" : "PJ"}
    </span>
  );
}

function StatusBadge({ ativo }) {
  return (
    <span className={`badge ${ativo ? "badge-green" : "badge-red"}`}>
      {ativo ? "● Ativo" : "○ Inativo"}
    </span>
  );
}

function ModalNovoUsuario({ onClose, onCreated }) {
  const [form, setForm] = useState({
    nome: "", email: "", senha: "",
    tipo_perfil: "juridica", nome_perfil: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome_perfil.trim()) {
      setError(form.tipo_perfil === "juridica" ? "Informe o nome da empresa." : "Informe o nome do perfil.");
      return;
    }
    setLoading(true); setError(null);
    try {
      const { user } = await adminApi.createUser(form);
      onCreated(user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header modal-header-forest">
          <div>
            <h2 className="modal-title" style={{ color: "var(--primary-foreground)" }}>➕ Novo Cliente</h2>
            <p style={{ color: "color-mix(in oklab, var(--primary-foreground) 75%, transparent)", margin: "4px 0 0", fontSize: 12 }}>
              Cria uma conta de acesso ao sistema
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div style={{ marginBottom: 18 }}>
            <label className="form-label">Tipo de perfil</label>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {[["juridica", "🏢", "Pessoa Jurídica", "Empresa, MEI"], ["fisica", "👤", "Pessoa Física", "Finanças pessoais"]].map(([v, icon, title, sub]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set("tipo_perfil", v)}
                  className={`profile-item ${form.tipo_perfil === v ? "active" : ""}`}
                  style={{ flex: 1, flexDirection: "column", textAlign: "center", marginBottom: 0 }}
                >
                  <div style={{ fontSize: 20 }}>{icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{title}</div>
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div className="form-group">
              <label className="form-label">Nome completo do responsável</label>
              <input className="form-input" type="text" placeholder="João Silva" value={form.nome} onChange={e => set("nome", e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">{form.tipo_perfil === "juridica" ? "Nome da empresa / razão social" : "Nome do perfil"}</label>
              <input className="form-input" type="text" placeholder={form.tipo_perfil === "juridica" ? "Minha Empresa Ltda" : "Finanças Pessoais"} value={form.nome_perfil} onChange={e => set("nome_perfil", e.target.value)} required />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">E-mail de acesso</label>
                <input className="form-input" type="email" placeholder="cliente@email.com" value={form.email} onChange={e => set("email", e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Senha inicial</label>
                <input className="form-input" type="text" placeholder="Mínimo 6 caracteres" value={form.senha} onChange={e => set("senha", e.target.value)} required minLength={6} />
              </div>
            </div>
          </div>

          {error && <div className="alert alert-warn" style={{ marginTop: 14 }}>⚠ {error}</div>}

          <div className="modal-footer" style={{ margin: "20px -1.25rem -1.25rem", borderRadius: 0 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
              {loading ? "Criando…" : "✓ Criar conta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalResetSenha({ user, onClose }) {
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await adminApi.resetPassword(user.id, senha);
      setOk(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">🔑 Redefinir Senha</h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>{user.email}</p>
          </div>
        </div>
        <div className="modal-body">
          {ok ? (
            <>
              <div className="alert alert-success">✅ Senha redefinida com sucesso!</div>
              <button onClick={onClose} className="btn btn-secondary" style={{ width: "100%" }}>Fechar</button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nova senha</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Mínimo 6 caracteres"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                />
              </div>
              {error && <div className="alert alert-warn" style={{ marginBottom: 12 }}>⚠ {error}</div>}
              <div className="modal-footer" style={{ margin: "16px -1.25rem -1.25rem", borderRadius: 0 }}>
                <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2, background: "var(--gold)", color: "var(--forest-900)" }}>
                  {loading ? "Aguarde…" : "Redefinir"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function SuperAdminCard({ user }) {
  return (
    <div className="super-admin-card">
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        <div className="super-admin-icon">🛡</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gold)", marginBottom: 4 }}>
            Super Administrador
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.2 }}>{user?.nome}</div>
          <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>{user?.email}</div>
        </div>
      </div>
      <div className="super-admin-badge">
        ✓ Conta protegida — não pode ser excluída ou desativada
      </div>
    </div>
  );
}



// ─── WhatsApp Admin Panel ─────────────────────────────────────────────────────

function WhatsAppAdminPanel() {
  const [config, setConfig]         = useState({ admin_instance: "", admin_phone: "" });
  const [loadingCfg, setLoadingCfg] = useState(true);
  const [savingCfg, setSavingCfg]   = useState(false);
  const [cfgError, setCfgError]     = useState(null);
  const [cfgSaved, setCfgSaved]     = useState(false);

  // Instance connection state
  const [inst, setInst]             = useState({ status: "disconnected", qrcode: null, phoneNumber: null, instanceName: null });
  const [loadingInst, setLoadingInst] = useState(true);
  const [connecting, setConnecting]   = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [instError, setInstError]     = useState(null);

  const S = {
    card:   { background: "#fff", border: "1px solid oklch(0.88 0.005 0)", borderRadius: 12, padding: "24px 28px", marginBottom: 24 },
    title:  { margin: "0 0 18px", fontSize: 17, fontWeight: 700, color: "oklch(0.20 0.015 155)", letterSpacing: "-0.2px" },
    label:  { display: "block", fontSize: 13, fontWeight: 600, color: "oklch(0.35 0.01 0)", marginBottom: 4 },
    input:  { width: "100%", padding: "8px 10px", border: "1px solid oklch(0.82 0.005 0)", borderRadius: 6, fontSize: 14, boxSizing: "border-box" },
    btn:    (color, bg, border) => ({ padding: "7px 16px", borderRadius: 6, border: `1px solid ${border}`, background: bg, color, fontSize: 13, fontWeight: 600, cursor: "pointer" }),
    errBox: { background: "oklch(0.96 0.04 27)", border: "1px solid oklch(0.80 0.12 27)", color: "oklch(0.58 0.22 27)", borderRadius: 6, padding: "8px 12px", fontSize: 13, marginBottom: 12 },
    okBox:  { background: "oklch(0.95 0.04 155)", border: "1px solid oklch(0.80 0.08 155)", color: "oklch(0.38 0.12 155)", borderRadius: 6, padding: "8px 12px", fontSize: 13, marginBottom: 12 },
  };

  // ── Config ──────────────────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    try {
      const d = await adminApi.waConfig();
      setConfig({ admin_instance: d.admin_instance || "", admin_phone: d.admin_phone || "" });
    } catch { /* ignore */ } finally { setLoadingCfg(false); }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const saveConfig = async () => {
    setSavingCfg(true); setCfgError(null); setCfgSaved(false);
    try {
      await adminApi.waSetConfig({ admin_instance: config.admin_instance, admin_phone: config.admin_phone });
      setCfgSaved(true);
      setTimeout(() => setCfgSaved(false), 3000);
    } catch (e) { setCfgError(e.message); } finally { setSavingCfg(false); }
  };

  // ── Instance Status ─────────────────────────────────────────────────────────
  const refreshInst = useCallback(async () => {
    try {
      const d = await adminApi.waInstanceStatus();
      setInst({
        status:       d.status       || "disconnected",
        qrcode:       d.qrcode       || null,
        phoneNumber:  d.phoneNumber  || null,
        instanceName: d.instanceName || null,
      });
    } catch { /* ignore */ } finally { setLoadingInst(false); }
  }, []);

  useEffect(() => { refreshInst(); }, [refreshInst]);

  // Poll while connecting
  useEffect(() => {
    if (inst.status !== "connecting") return;
    const t = setInterval(refreshInst, 4000);
    return () => clearInterval(t);
  }, [inst.status, refreshInst]);

  const handleConnect = async () => {
    setConnecting(true); setInstError(null);
    try {
      await adminApi.waConnect();
      setInst(i => ({ ...i, status: "connecting", qrcode: null }));
      setTimeout(refreshInst, 1500);
      setTimeout(refreshInst, 4000);
    } catch (e) { setInstError(e.message); } finally { setConnecting(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar a instancia global? Usuarios PF nao receberao mensagens.")) return;
    setDisconnecting(true); setInstError(null);
    try {
      await adminApi.waDisconnect();
      setInst({ status: "disconnected", qrcode: null, phoneNumber: null, instanceName: inst.instanceName });
    } catch (e) { setInstError(e.message); } finally { setDisconnecting(false); }
  };

  // Status badge
  const statusLabel = { connected: "● Conectado", connecting: "◌ Aguardando QR...", disconnected: "○ Desconectado" };
  const statusColor = { connected: "oklch(0.42 0.08 155)", connecting: "oklch(0.55 0.12 270)", disconnected: "oklch(0.55 0.01 0)" };
  const statusBg    = { connected: "oklch(0.94 0.04 155)", connecting: "oklch(0.94 0.04 270)", disconnected: "oklch(0.96 0.005 0)" };

  return (
    <div style={{ marginTop: 32 }}>
      <h2 className="admin-section-title">WhatsApp do Sistema</h2>

      {/* Config */}
      <div style={S.card}>
        <p style={S.title}>Configuracao da instancia global</p>
        {cfgError && <div style={S.errBox}>{cfgError}</div>}
        {cfgSaved && <div style={S.okBox}>Configuracao salva com sucesso.</div>}
        {loadingCfg ? <p style={{ color: "oklch(0.55 0.01 0)", fontSize: 14 }}>Carregando...</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={S.label}>Nome da instancia (ex: cf-admin)</label>
              <input style={S.input} value={config.admin_instance}
                onChange={e => setConfig(c => ({ ...c, admin_instance: e.target.value }))}
                placeholder="cf-admin" />
            </div>
            <div>
              <label style={S.label}>Telefone oficial (ex: 5511400050000)</label>
              <input style={S.input} value={config.admin_phone}
                onChange={e => setConfig(c => ({ ...c, admin_phone: e.target.value }))}
                placeholder="5511400050000" />
            </div>
          </div>
        )}
        <div style={{ marginTop: 14, textAlign: "right" }}>
          <button style={S.btn("#fff", "oklch(0.42 0.08 155)", "oklch(0.42 0.08 155)")}
            onClick={saveConfig} disabled={savingCfg || loadingCfg}>
            {savingCfg ? "Salvando..." : "Salvar configuracao"}
          </button>
        </div>
      </div>

      {/* Connection */}
      <div style={S.card}>
        <p style={S.title}>Conexao WhatsApp do Sistema</p>
        {instError && <div style={S.errBox}>{instError}</div>}

        {loadingInst ? (
          <p style={{ color: "oklch(0.55 0.01 0)", fontSize: 14 }}>Carregando...</p>
        ) : (
          <>
            {/* Status row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <span style={{
                display: "inline-block", padding: "3px 10px", borderRadius: 99, fontSize: 13,
                fontWeight: 600,
                background: statusBg[inst.status]  || statusBg.disconnected,
                color:      statusColor[inst.status] || statusColor.disconnected,
              }}>
                {statusLabel[inst.status] || "○ Desconectado"}
              </span>
              {inst.phoneNumber && inst.status === "connected" && (
                <span style={{ fontSize: 13, color: "oklch(0.45 0.01 0)" }}>
                  📱 +{inst.phoneNumber}
                </span>
              )}
              {inst.instanceName && (
                <span style={{ fontSize: 12, color: "oklch(0.60 0.01 0)", marginLeft: "auto" }}>
                  instancia: {inst.instanceName}
                </span>
              )}
            </div>

            {/* QR Code */}
            {inst.status === "connecting" && inst.qrcode && (
              <div style={{ textAlign: "center", margin: "0 0 16px" }}>
                <p style={{ fontSize: 13, color: "oklch(0.45 0.01 0)", marginBottom: 8 }}>
                  Escaneie o QR code com o WhatsApp do numero oficial:
                </p>
                <img
                  src={inst.qrcode}
                  alt="QR Code WhatsApp"
                  style={{ width: 220, height: 220, border: "2px solid oklch(0.88 0.005 0)", borderRadius: 8 }}
                />
              </div>
            )}

            {inst.status === "connecting" && !inst.qrcode && (
              <p style={{ fontSize: 13, color: "oklch(0.55 0.12 270)", marginBottom: 16 }}>
                Aguardando QR code... (pode levar alguns segundos)
              </p>
            )}

            {/* Buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              {inst.status !== "connected" && (
                <button
                  style={S.btn("#fff", "oklch(0.42 0.08 155)", "oklch(0.42 0.08 155)")}
                  onClick={handleConnect}
                  disabled={connecting || !config.admin_instance}>
                  {connecting ? "Conectando..." : inst.status === "connecting" ? "Reconectar" : "Conectar WhatsApp"}
                </button>
              )}
              {(inst.status === "connected" || inst.status === "connecting") && (
                <button
                  style={S.btn("oklch(0.58 0.22 27)", "#fff", "oklch(0.75 0.15 27)")}
                  onClick={handleDisconnect}
                  disabled={disconnecting}>
                  {disconnecting ? "Desconectando..." : "Desconectar"}
                </button>
              )}
              <button
                style={{ ...S.btn("oklch(0.45 0.01 0)", "#fff", "oklch(0.82 0.005 0)"), marginLeft: "auto" }}
                onClick={refreshInst}>
                ↺ Atualizar
              </button>
            </div>

            {!config.admin_instance && (
              <p style={{ fontSize: 12, color: "oklch(0.55 0.12 27)", marginTop: 10 }}>
                ⚠ Configure o nome da instancia acima antes de conectar.
              </p>
            )}
          </>
        )}
      </div>

    </div>
  );
}

function OperacoesOverview() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    adminApi
      .overview()
      .then(setOverview)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Carregando operações…</p>;
  if (err) return <div className="login-error" style={{ marginBottom: 12 }}>{err}</div>;
  if (!overview) return null;

  const cards = [
    { label: "Novos 7 dias", value: overview.usuarios?.novos_7d },
    { label: "Novos 30 dias", value: overview.usuarios?.novos_30d },
    { label: "Usuários ativos (30d)", value: overview.usuarios?.ativos_30d },
    { label: "Planos PF", value: overview.planos?.pf_ativos },
    { label: "Planos PJ", value: overview.planos?.pj_ativos },
    { label: "Receita estimada", value: overview.receita_estimada_formatado },
    { label: "Tickets abertos", value: overview.suporte?.tickets_abertos },
    { label: "Assin. ativas", value: overview.assinaturas?.ativas },
    { label: "Trials", value: overview.assinaturas?.trials },
    { label: "Atrasadas", value: overview.assinaturas?.atrasadas },
  ];

  return (
    <div className="admin-kpi-grid" style={{ marginBottom: 24 }}>
      {cards.map(({ label, value }) => (
        <div key={label} className="admin-kpi" style={{ "--admin-kpi-color": CHART.receita }}>
          <div className="admin-kpi-value">{value ?? "—"}</div>
          <div className="admin-kpi-label">{label}</div>
        </div>
      ))}
    </div>
  );
}

function BillingHealthPanel() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .billingHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Diagnóstico cobrança…</p>;
  if (!health) return null;

  const rows = [
    ["Cobrança configurada", health.configured ? "Sim" : "Não"],
    ["Ambiente", health.environment],
    ["Webhook", health.webhookConfigured ? "Configurado" : "Pendente"],
    ["Assinaturas ativas", health.activeSubscriptions],
    ["Faturas pendentes", health.pendingInvoices],
  ];

  return (
    <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
      <div className="card-title">Diagnóstico de cobrança (interno)</div>
      <table style={{ width: "100%", fontSize: 13 }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td style={{ padding: "6px 0", color: "var(--muted-foreground)" }}>{k}</td>
              <td style={{ padding: "6px 0", fontWeight: 600, textAlign: "right" }}>{String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage({ embedded = false, onEnterTenant }) {
  const { user: adminUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNovo, setShowNovo] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  const loadUsers = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { users } = await adminApi.listUsers();
      setUsers(users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleToggle = async (id) => {
    try {
      const { ativo } = await adminApi.toggleUser(id);
      setUsers(us => us.map(u => u.id === id ? { ...u, ativo } : u));
    } catch (err) {
      alert("Erro: " + err.message);
    }
  };

  const handleDelete = async (u) => {
    if (u.role === "admin") {
      alert("Conta de super administrador não pode ser excluída.");
      return;
    }
    if (!confirm(`Excluir permanentemente a conta de ${u.nome} (${u.email})?\nTodos os dados financeiros serão apagados!`)) return;
    try {
      await adminApi.deleteUser(u.id);
      setUsers(us => us.filter(x => x.id !== u.id));
    } catch (err) {
      alert("Erro: " + err.message);
    }
  };

  const tenants = users.filter(u => u.role !== "admin");
  const tenantsFiltrados = tenants.filter(u => {
    const ok_busca = !busca || u.nome.toLowerCase().includes(busca.toLowerCase()) || u.email.toLowerCase().includes(busca.toLowerCase()) || u.nome_perfil?.toLowerCase().includes(busca.toLowerCase());
    const ok_tipo = filtroTipo === "todos" || u.tipo_perfil === filtroTipo;
    return ok_busca && ok_tipo;
  });

  const totalAtivos = tenants.filter(u => u.ativo).length;
  const totalPJ = tenants.filter(u => u.tipo_perfil === "juridica").length;
  const totalPF = tenants.filter(u => u.tipo_perfil === "fisica").length;

  const kpis = [
    { label: "Total de clientes", value: tenants.length, icon: "👥", color: CHART.lucroBruto },
    { label: "Contas ativas", value: totalAtivos, icon: "✅", color: CHART.receita },
    { label: "Pessoa Jurídica", value: totalPJ, icon: "🏢", color: CHART.pie[2] },
    { label: "Pessoa Física", value: totalPF, icon: "👤", color: CHART.pie[3] },
  ];

  return (
    <div className="admin-page">
      <div style={{ padding: embedded ? 0 : undefined }}>
        <SuperAdminCard user={adminUser} />

        <div className="admin-kpi-grid">
          {kpis.map(({ label, value, icon, color }) => (
            <div key={label} className="admin-kpi" style={{ "--admin-kpi-color": color }}>
              <div style={{ fontSize: 24 }}>{icon}</div>
              <div className="admin-kpi-value">{value}</div>
              <div className="admin-kpi-label">{label}</div>
            </div>
          ))}
        </div>

        <h2 className="admin-section-title">Operações</h2>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 12px" }}>
          Visão agregada do SaaS — sem acesso a lançamentos ou dados financeiros dos clientes.
        </p>
        <OperacoesOverview />
        <BillingHealthPanel />

        <div className="toolbar">
          <h2 className="admin-section-title">Clientes / Tenants</h2>
          <div className="toolbar-right">
            <div className="search-wrap">
              <span className="search-icon">⌕</span>
              <input
                className="form-input search-input"
                placeholder="Buscar por nome, e-mail..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
            <select className="form-select" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ width: "auto" }}>
              <option value="todos">Todos os tipos</option>
              <option value="juridica">Pessoa Jurídica</option>
              <option value="fisica">Pessoa Física</option>
            </select>
            <button onClick={() => setShowNovo(true)} className="btn btn-primary">
              ➕ Novo Cliente
            </button>
          </div>
        </div>

        <div className="admin-table-wrap">
          {loading ? (
            <div className="empty-state">Carregando…</div>
          ) : error ? (
            <div className="empty-state" style={{ color: "var(--danger-fg)" }}>⚠ {error}</div>
          ) : tenantsFiltrados.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>Nenhum cliente cadastrado</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Clique em &quot;Novo Cliente&quot; para adicionar o primeiro</div>
            </div>
          ) : (
            <div className="table-wrap admin-tenant-table" style={{ border: "none", boxShadow: "none", borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    {["Cliente", "E-mail", "Perfil / Empresa", "Tipo", "Status", "Último acesso", "Criado em", "Ações"].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tenantsFiltrados.map(u => (
                    <tr key={u.id}>
                      <td className="td-ellipsis"><strong>{u.nome}</strong></td>
                      <td className="td-ellipsis">{u.email}</td>
                      <td>
                        <div className="tenant-name-cell">
                          <button
                            type="button"
                            className="tenant-enter-btn"
                            title={`Visualizar conta de ${u.nome_perfil || u.nome} (somente leitura)`}
                            disabled={!u.ativo}
                            onClick={() => onEnterTenant?.(u)}
                          >
                            ⇄
                          </button>
                          <span className="td-ellipsis">{u.nome_perfil || "—"}</span>
                        </div>
                      </td>
                      <td><Badge tipo={u.tipo_perfil} /></td>
                      <td><StatusBadge ativo={u.ativo} /></td>
                      <td className="td-mono td-compact">{fmtDt(u.ultimo_acesso)}</td>
                      <td className="td-mono td-compact">{fmt(u.created_at)}</td>
                      <td>
                        <div className="admin-actions">
                          <button
                            onClick={() => handleToggle(u.id)}
                            title={u.ativo ? "Desativar acesso" : "Ativar acesso"}
                            className={`btn btn-xs ${u.ativo ? "btn-danger" : "btn-secondary"}`}
                          >
                            {u.ativo ? "⊘" : "✓"}
                          </button>
                          <button
                            onClick={() => setResetTarget(u)}
                            title="Redefinir senha"
                            className="btn btn-xs btn-secondary"
                          >
                            🔑
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            title="Excluir conta"
                            className="btn btn-xs btn-danger"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <WhatsAppAdminPanel />

      {showNovo && (
        <ModalNovoUsuario
          onClose={() => setShowNovo(false)}
          onCreated={(u) => setUsers(prev => [...prev, u])}
        />
      )}
      {resetTarget && (
        <ModalResetSenha user={resetTarget} onClose={() => setResetTarget(null)} />
      )}
    </div>
  );
}
