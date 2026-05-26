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
