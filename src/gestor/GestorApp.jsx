import { useState } from "react";
import { css } from "./styles.js";
import { NAV_ITEMS, NAV_ITEMS_FISICA } from "./constants.js";
import { useGestor } from "./GestorContext.jsx";
import { useAuth } from "./AuthContext.jsx";
import {
  ModalLancamento, ModalConta, ModalPlano,
  ModalCliente, ModalFornecedor, ModalCategoriaPF, ModalMeta,
} from "./components/Modals.jsx";
import AdminPanel from "./pages/AdminPage.jsx";

// ─── Páginas PJ ───────────────────────────────────────────────────────────────
import {
  DashboardPage, LancamentosPage, DREPage, ContasPage, PlanoContasPage,
  ImpostosPage, ClientesPage, FornecedoresPage, ImportacoesPage,
  ConciliacaoPage, BalancetePage, FechamentoPage, RelatoriosPage, EmpresaPage,
} from "./pages/Pages.jsx";

// ─── Páginas PF ───────────────────────────────────────────────────────────────
import {
  DashboardPFPage, LancamentosPFPage, CategoriasPFPage,
  OrcamentoPage, MetasPage, RelatoriosPFPage, PerfilPFPage,
} from "./pages/PagesPF.jsx";

const PAGE_MAP_PJ = {
  dashboard: DashboardPage, lancamentos: LancamentosPage, dre: DREPage,
  contas: ContasPage, plano: PlanoContasPage, impostos: ImpostosPage,
  clientes: ClientesPage, fornecedores: FornecedoresPage,
  importacoes: ImportacoesPage, conciliacao: ConciliacaoPage,
  balancete: BalancetePage, fechamento: FechamentoPage,
  relatorios: RelatoriosPage, empresa: EmpresaPage,
};

const PAGE_MAP_PF = {
  dashboard: DashboardPFPage, lancamentos: LancamentosPFPage,
  categorias: CategoriasPFPage, orcamento: OrcamentoPage,
  metas: MetasPage, contas: ContasPage,
  relatorios: RelatoriosPFPage, perfil: PerfilPFPage,
};

// ─── Profile Manager ──────────────────────────────────────────────────────────
function ProfileManagerModal({ onClose }) {
  const { state, empresa, switchEmpresa, addPerfil, removePerfil } = useGestor();
  const [creating, setCreating] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newTipo, setNewTipo] = useState("juridica");

  const handleCreate = () => {
    const nome = newNome.trim();
    if (!nome) return;
    addPerfil(nome, newTipo);
    setCreating(false); setNewNome(""); onClose();
  };
  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (state.empresas.length <= 1) return alert("Não é possível excluir o único perfil.");
    if (confirm("Excluir este perfil permanentemente?")) removePerfil(id);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <span className="modal-title">Gerenciar Perfis</span>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {state.empresas.map(emp => {
            const isPF = emp.tipo === "fisica";
            const isAtivo = emp.id === empresa.id;
            return (
              <div key={emp.id} className={`profile-item${isAtivo ? " active" : ""}`}
                onClick={() => { switchEmpresa(emp.id); onClose(); }}>
                <div>
                  <div className="profile-item-name">
                    {isPF ? (emp.pessoa?.nome || emp.nome) : (emp.company?.nomeFantasia || emp.nome)}
                  </div>
                  <div className="profile-item-sub">
                    {isPF ? (emp.pessoa?.cpf || "CPF não informado") : (emp.company?.cnpj || emp.nome)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={`badge ${isPF ? "badge-pf" : "badge-pj"}`}>
                    {isPF ? "Pessoa Física" : "Pessoa Jurídica"}
                  </span>
                  {isAtivo && <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700 }}>ATIVO</span>}
                  {!isAtivo && (
                    <button className="btn btn-danger btn-sm btn-icon"
                      onClick={e => handleDelete(e, emp.id)} style={{ fontSize: 11 }}>✕</button>
                  )}
                </div>
              </div>
            );
          })}
          {creating ? (
            <div style={{ marginTop: 14, padding: 14, background: "var(--surface2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">Nome do Perfil</label>
                <input className="form-input" value={newNome} onChange={e => setNewNome(e.target.value)}
                  placeholder="Ex: João Silva ou Empresa ABC" autoFocus
                  onKeyDown={e => e.key === "Enter" && handleCreate()} />
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Tipo de Perfil</label>
                <select className="form-select" value={newTipo} onChange={e => setNewTipo(e.target.value)}>
                  <option value="juridica">Pessoa Jurídica (Empresa)</option>
                  <option value="fisica">Pessoa Física (Pessoal)</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={handleCreate}>Criar Perfil</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setCreating(false); setNewNome(""); }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-secondary" style={{ width: "100%", marginTop: 12, justifyContent: "center" }}
              onClick={() => setCreating(true)}>+ Novo Perfil</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
const adminNavBtn = (active) => ({
  display: "flex", alignItems: "center", gap: 10,
  padding: "11px 12px", borderRadius: 10, cursor: "pointer",
  background: active
    ? "linear-gradient(135deg, rgba(16,185,129,0.35), rgba(13,148,136,0.25))"
    : "linear-gradient(135deg, rgba(245,158,11,0.22), rgba(217,119,6,0.15))",
  border: active ? "1.5px solid rgba(16,185,129,0.55)" : "1.5px solid rgba(245,158,11,0.35)",
  color: active ? "#6ee7b7" : "#fde68a",
  transition: "all 0.15s", marginBottom: 4,
});

export default function GestorApp() {
  const { user, logout, isAdmin, isSuperAdmin } = useAuth();
  const [page, setPage] = useState(() => (user?.role === "admin" ? "super-admin" : "dashboard"));
  const [showProfileManager, setShowProfileManager] = useState(false);
  const { empresa, tipo, pessoa, company, modalOpen, apiOnline } = useGestor();

  const isPF = tipo === "fisica";
  const navItems = isPF ? NAV_ITEMS_FISICA : NAV_ITEMS;
  const pageMap  = isPF ? PAGE_MAP_PF : PAGE_MAP_PJ;

  const isAdminPage = page === "super-admin";
  const currentPage = (!isAdminPage && pageMap[page]) ? page : "dashboard";
  const PageComponent = pageMap[currentPage] || pageMap.dashboard;
  const pageLabel = isAdminPage
    ? "Painel Administrativo"
    : (navItems.find(n => n.id === currentPage)?.label || "Dashboard");

  const displayName = isPF
    ? (pessoa?.nome || empresa.nome)
    : (company?.nomeFantasia || empresa.nome);
  const displaySub = isPF
    ? (pessoa?.cpf || "CPF não informado")
    : (company?.cnpj || "");

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* ── Sidebar ─────────────────────────────────────────── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="brand-row">
              <div className="brand-mark">{isPF ? "PF" : "GF"}</div>
              <div>
                <h1>Gestor<br />{isPF ? "Pessoal" : "Financeiro"}</h1>
                <p>{isPF ? "Finanças · v2.0" : "Painel · v2.0"}</p>
              </div>
            </div>
          </div>

          {/* ── SUPER ADMIN — abre por padrão para role=admin ───── */}
          {isSuperAdmin && (
            <div style={{ padding: "0 12px 4px" }}>
              <div style={{
                fontSize: 9, fontWeight: 800, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "rgba(253,230,138,0.85)",
                padding: "6px 4px 6px",
              }}>Super Admin</div>
              <div
                role="button" tabIndex={0}
                onClick={() => setPage("super-admin")}
                onKeyDown={e => e.key === "Enter" && setPage("super-admin")}
                style={adminNavBtn(isAdminPage)}
                onMouseEnter={e => { if (!isAdminPage) e.currentTarget.style.filter = "brightness(1.08)"; }}
                onMouseLeave={e => { if (!isAdminPage) e.currentTarget.style.filter = "none"; }}
              >
                <span style={{ fontSize: 18 }}>🛡</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>Painel Admin</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 1 }}>Clientes · Tenants · SaaS</div>
                </div>
              </div>

              {isAdminPage && (
                <div
                  role="button" tabIndex={0}
                  onClick={() => setPage("dashboard")}
                  onKeyDown={e => e.key === "Enter" && setPage("dashboard")}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.85)",
                    marginTop: 6,
                  }}
                >
                  <span style={{ fontSize: 16 }}>📊</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Gestor Financeiro</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 1 }}>Dashboard · Lançamentos · DRE</div>
                  </div>
                </div>
              )}

              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "10px 0 6px" }} />
            </div>
          )}

          {/* ── Navegação financeira (oculta no painel admin) ───── */}
          {!isAdminPage && (
          <nav className="nav-section">
            <div className="nav-label">Navegação</div>
            <div className={isPF ? "nav-list-pf" : "nav-list"}>
              {navItems.map(n => (
                <div key={n.id}
                  className={`nav-item${currentPage === n.id ? " active" : ""}`}
                  onClick={() => setPage(n.id)}
                  onKeyDown={e => e.key === "Enter" && setPage(n.id)}
                  role="button" tabIndex={0}>
                  <span className="nav-icon">{n.icon}</span>
                  <span>{n.label}</span>
                </div>
              ))}
            </div>
          </nav>
          )}

          {/* ── Footer ────────────────────────────────────────── */}
          <div className="sidebar-footer">
            {/* Usuário logado */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", background: "rgba(255,255,255,0.06)",
              borderRadius: 8, marginBottom: 8,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user?.nome || user?.email || "Usuário"}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 1 }}>
                  {isSuperAdmin ? "Super administrador do sistema" : "conta sincronizada"}
                </div>
              </div>
              <button onClick={logout} title="Sair da conta" style={{
                background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 6,
                color: "rgba(255,255,255,0.7)", fontSize: 14, cursor: "pointer",
                padding: "4px 7px", lineHeight: 1, flexShrink: 0, marginLeft: 6,
                transition: "background 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.3)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
              >⏏</button>
            </div>

            {/* Empresa ativa */}
            <div className="sidebar-footer-profile">
              <div className="sidebar-footer-info">
                <div className="sidebar-footer-name">{displayName}</div>
                <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                  <span className={`badge ${isPF ? "badge-pf" : "badge-pj"}`} style={{ fontSize: 9, padding: "1px 5px" }}>
                    {isPF ? "PF" : "PJ"}
                  </span>
                  <span className="sidebar-footer-cnpj" style={{ display: "inline" }}>{displaySub}</span>
                </div>
              </div>
              <button className="sidebar-footer-switch" onClick={() => setShowProfileManager(true)} title="Gerenciar Perfis">⇄</button>
            </div>
          </div>
        </aside>

        {/* ── Main ────────────────────────────────────────────── */}
        <main className="main">
          <div className="topbar">
            <span className="topbar-title">{pageLabel}</span>
            <div className="topbar-right">
              <span className={`status-dot ${apiOnline ? "online" : "offline"}`}
                title={apiOnline ? "API online" : "API offline"} />
              <span style={{ fontSize: 12, color: "#64748b", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.nome || user?.email}
              </span>
              {isSuperAdmin && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#fef3c7", color: "#d97706", border: "1px solid #fde68a" }}>
                  SUPER ADMIN
                </span>
              )}
              {!isAdminPage && (
                <>
                  <span className="company-badge">{displayName}</span>
                  <span className={`badge ${isPF ? "badge-pf" : "badge-pj"}`} style={{ fontSize: 10 }}>
                    {isPF ? "Pessoa Física" : "Pessoa Jurídica"}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="content">
            {isAdminPage
              ? <AdminPanel embedded />
              : <PageComponent />
            }
          </div>
        </main>

        {/* Modais PJ */}
        {!isAdminPage && modalOpen === "lancamento"   && <ModalLancamento />}
        {!isAdminPage && modalOpen === "conta"        && <ModalConta />}
        {!isAdminPage && modalOpen === "plano"        && <ModalPlano />}
        {!isAdminPage && modalOpen === "cliente"      && <ModalCliente />}
        {!isAdminPage && modalOpen === "fornecedor"   && <ModalFornecedor />}
        {!isAdminPage && modalOpen === "categoria-pf" && <ModalCategoriaPF />}
        {!isAdminPage && modalOpen === "meta"         && <ModalMeta />}

        {showProfileManager && <ProfileManagerModal onClose={() => setShowProfileManager(false)} />}
      </div>
    </>
  );
}
