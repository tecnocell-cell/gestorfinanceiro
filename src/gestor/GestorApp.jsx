import { useState, useEffect } from "react";
import { css } from "./styles.js";
import { NAV_ITEMS, NAV_ITEMS_FISICA } from "./constants.js";
import { useGestor } from "./GestorContext.jsx";
import { useAuth } from "./AuthContext.jsx";
import {
  ModalLancamento, ModalConta, ModalPlano,
  ModalCliente, ModalFornecedor, ModalCategoriaPF, ModalMeta,
} from "./components/Modals.jsx";
import AdminPanel        from "./pages/AdminPage.jsx";
import RecorrenciasPage  from "./pages/RecorrenciasPage.jsx";
import ContasAPagarPage       from "./pages/ContasAPagarPage.jsx";
import ConexoesBancariasPage  from "./pages/ConexoesBancariasPage.jsx";
// Dashboard V2 — premium. Rollback: remover estas 2 linhas e restaurar DashboardPage/DashboardPFPage nas page maps.
import DashboardV2Page   from "./pages/DashboardV2Page.jsx";
import DashboardPFV2Page from "./pages/DashboardPFV2Page.jsx";

// ─── Páginas PJ ───────────────────────────────────────────────────────────────
import {
  DashboardPage, LancamentosPage, DREPage, ContasPage, PlanoContasPage,
  ImpostosPage, ClientesPage, FornecedoresPage, ImportacoesPage,
  ConciliacaoPage, BalancetePage, FechamentoPage, RelatoriosPage, EmpresaPage,
} from "./pages/Pages.jsx";

// ─── Páginas PF ───────────────────────────────────────────────────────────────
import {
  DashboardPFPage, LancamentosPFPage, CategoriasPFPage,
  OrcamentoPage, MetasPage, RelatoriosPFPage, PerfilPFPage, ContasPFPage,
} from "./pages/PagesPF.jsx";
import PfDueAlert from "./components/pf/PfDueAlert.jsx";
import { NavIcon, Shield, Menu, LogOut, Eye } from "./components/icons.jsx";

const PAGE_MAP_PJ = {
  // dashboard → V2 premium. Rollback: trocar DashboardV2Page por DashboardPage
  dashboard: DashboardV2Page, lancamentos: LancamentosPage, recorrencias: RecorrenciasPage,
  "contas-pagar": ContasAPagarPage,
  dre: DREPage, contas: ContasPage, plano: PlanoContasPage, impostos: ImpostosPage,
  clientes: ClientesPage, fornecedores: FornecedoresPage,
  importacoes: ImportacoesPage, conciliacao: ConciliacaoPage,
  balancete: BalancetePage, fechamento: FechamentoPage,
  relatorios: RelatoriosPage, "open-finance": ConexoesBancariasPage,
  empresa: EmpresaPage,
};

const PAGE_MAP_PF = {
  // dashboard → V2 premium. Rollback: trocar DashboardPFV2Page por DashboardPFPage
  dashboard: DashboardPFV2Page, lancamentos: LancamentosPFPage,
  recorrencias: RecorrenciasPage,
  "contas-pagar": ContasAPagarPage,
  categorias: CategoriasPFPage, orcamento: OrcamentoPage,
  metas: MetasPage, contas: ContasPFPage,
  relatorios: RelatoriosPFPage, "open-finance": ConexoesBancariasPage,
  perfil: PerfilPFPage,
};

// ─── App Shell ────────────────────────────────────────────────────────────────
export default function GestorApp() {
  const { user, logout, isSuperAdmin } = useAuth();
  const [page, setPage] = useState(() => (user?.role === "admin" ? "super-admin" : "dashboard"));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    empresa, tipo, pessoa, company, modalOpen, apiOnline, appLoadError,
    viewOnly, impersonatingUser, enterAsTenant, exitAsTenant,
  } = useGestor();

  const goTo = (p) => { setPage(p); setSidebarOpen(false); };
  const goToAdmin = () => { exitAsTenant(); goTo("super-admin"); };

  const handleEnterTenant = async (tenantUser) => {
    try {
      await enterAsTenant(tenantUser);
      goTo("dashboard");
    } catch (err) {
      alert(err.message);
    }
  };

  const isPF = tipo === "fisica";
  const navItems = isPF ? NAV_ITEMS_FISICA : NAV_ITEMS;
  const pageMap  = isPF ? PAGE_MAP_PF : PAGE_MAP_PJ;

  const isAdminPage = page === "super-admin";
  const currentPage = (!isAdminPage && pageMap[page]) ? page : "dashboard";
  const PageComponent = pageMap[currentPage] || pageMap.dashboard;

  useEffect(() => {
    if (isAdminPage) return;
    if (!pageMap[page]) setPage("dashboard");
  }, [isPF, isAdminPage, page, pageMap]);
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
        <div
          className={`sidebar-overlay${sidebarOpen ? " visible" : ""}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
          <div className="sidebar-logo">
            <img
              src="/centerflow-logo-white.svg"
              alt="CenterFlow"
              className="sidebar-brand-logo"
              width={188}
              height={44}
            />
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
                className={`admin-nav-btn${isAdminPage ? " active" : ""}`}
                onClick={goToAdmin}
                onKeyDown={e => e.key === "Enter" && goToAdmin()}
              >
                <span className="admin-nav-icon" aria-hidden><Shield size={18} strokeWidth={1.75} /></span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>Painel Admin</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 1 }}>Clientes · Tenants · SaaS</div>
                </div>
              </div>

              {false && isAdminPage && (
                <div
                  role="button" tabIndex={0}
                  onClick={() => goTo("dashboard")}
                  onKeyDown={e => e.key === "Enter" && goTo("dashboard")}
                  className="gestor-link-btn"
                >
                  <span style={{ fontSize: 16 }}>📊</span>
                  <div>
                    <div className="gestor-link-btn-title">Gestor Financeiro</div>
                    <div className="gestor-link-btn-sub">Dashboard · Lançamentos · DRE</div>
                  </div>
                </div>
              )}

              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "10px 0 6px" }} />
            </div>
          )}

          {/* ── Navegação financeira (oculta no painel admin) ───── */}
          {!isAdminPage && (
          <nav className="nav-section">
            <div className="nav-label">{isPF ? "Finanças pessoais" : "Gestão empresarial"}</div>
            <div className="nav-list">
              {navItems.map(n => (
                <div key={n.id}
                  className={`nav-item${currentPage === n.id ? " active" : ""}`}
                  onClick={() => goTo(n.id)}
                  onKeyDown={e => e.key === "Enter" && goTo(n.id)}
                  role="button" tabIndex={0}>
                  <span className="nav-icon"><NavIcon name={n.id} /></span>
                  <span className="nav-label">{n.label}</span>
                </div>
              ))}
            </div>
          </nav>
          )}

          {/* Rodapé: só nome do usuário + sair */}
          <div className="sidebar-footer">
            <div className="sidebar-user-card">
              <div style={{ minWidth: 0 }}>
                <div className="sidebar-user-name">{user?.nome || user?.email || "Usuário"}</div>
                <div className="sidebar-user-role">
                  {impersonatingUser
                    ? `${impersonatingUser.email} · ${isPF ? "PF" : "PJ"}`
                    : isSuperAdmin
                      ? `${user?.email} · Super admin`
                      : `${user?.email || ""} · ${isPF ? "Pessoa Física" : "Pessoa Jurídica"}`}
                </div>
              </div>
              <button type="button" className="btn-logout" onClick={logout} title="Sair da conta" aria-label="Sair">
                <LogOut size={16} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main ────────────────────────────────────────────── */}
        <main className="main">
          <div className="topbar">
            <div className="topbar-left">
              <button
                className="menu-toggle"
                onClick={() => setSidebarOpen(v => !v)}
                aria-label="Abrir menu"
              ><Menu size={20} strokeWidth={1.75} /></button>
              <span className="topbar-title">{pageLabel}</span>
            </div>
            <div className="topbar-right">
              <span className={`status-dot ${apiOnline ? "online" : "offline"}`}
                title={apiOnline ? "Servidor PostgreSQL online" : "Servidor offline — execute npm run dev:all"} />
              <span className="topbar-user">{user?.nome || user?.email}</span>
              {isSuperAdmin && <span className="badge-super-admin">SUPER ADMIN</span>}
              {impersonatingUser && (
                <>
                  <span className="company-badge badge-view-only" title="Somente leitura">
                    <Eye size={12} strokeWidth={2} style={{ marginRight: 4, verticalAlign: -2 }} />
                    {impersonatingUser.nome_perfil || impersonatingUser.nome}
                  </span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={goToAdmin}>
                    Voltar ao admin
                  </button>
                </>
              )}
              {!isAdminPage && !impersonatingUser && (
                <>
                  <span className="company-badge">{displayName}</span>
                  <span className={`badge ${isPF ? "badge-pf" : "badge-pj"}`} style={{ fontSize: 10 }}>
                    {isPF ? "Pessoa Física" : "Pessoa Jurídica"}
                  </span>
                </>
              )}
            </div>
          </div>

          {appLoadError && (
            <div style={{
              background: "#fef3c7", borderBottom: "1px solid #f59e0b",
              color: "#92400e", padding: "10px 20px",
              fontSize: 13, display: "flex", alignItems: "center", gap: 8,
            }}>
              <span>⚠</span>
              <span>
                Não foi possível carregar seus dados do servidor. Seus dados estão seguros —
                <strong> recarregue a página</strong> para tentar novamente.
              </span>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  marginLeft: "auto", background: "#f59e0b", color: "#fff",
                  border: "none", borderRadius: 6, padding: "4px 12px",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                Recarregar
              </button>
            </div>
          )}

          {viewOnly && (
            <div className="view-only-banner">
              Modo visualização — você está vendo a conta do cliente. Alterações não são permitidas.
            </div>
          )}

          <div className={`content${viewOnly ? " content-view-only" : ""}`}>
            {isAdminPage
              ? <AdminPanel embedded onEnterTenant={handleEnterTenant} />
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

        {!isAdminPage && !viewOnly && <PfDueAlert />}
      </div>
    </>
  );
}
