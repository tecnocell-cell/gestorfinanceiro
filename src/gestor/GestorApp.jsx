import { useState, useEffect } from "react";
import { css } from "./styles.js";
import { NAV_ITEMS, NAV_ITEMS_FISICA, NAV_SECTIONS_FISICA, NAV_SECTIONS_PJ } from "./constants.js";
import ResumoAnualPage from "./pages/ResumoAnualPage.jsx";
import { useGestor } from "./GestorContext.jsx";
import { useAuth } from "./AuthContext.jsx";
import { isPessoaFisica } from "./profileLabels.js";
import {
  ModalLancamento, ModalConta, ModalPlano,
  ModalCliente, ModalFornecedor, ModalCategoriaPF, ModalMeta,
} from "./components/Modals.jsx";
import AdminPanel        from "./pages/AdminPage.jsx";
import RecorrenciasPage  from "./pages/RecorrenciasPage.jsx";
import WhatsAppPage      from "./pages/WhatsAppPage.jsx";
import ContasAPagarPage       from "./pages/ContasAPagarPage.jsx";
import ConexoesBancariasPage  from "./pages/ConexoesBancariasPage.jsx";
import IntegracaoPfPjPage     from "./pages/IntegracaoPfPjPage.jsx";
import ResultadoCentroCustoPage from "./pages/ResultadoCentroCustoPage.jsx";
import ProjetosFinanceirosPage from "./pages/ProjetosFinanceirosPage.jsx";
import ResultadoClientePage from "./pages/ResultadoClientePage.jsx";
import ResultadoProjetoPage from "./pages/ResultadoProjetoPage.jsx";
import OrcadoRealizadoPage from "./pages/OrcadoRealizadoPage.jsx";
import SuportePage           from "./pages/SuportePage.jsx";
import TutoriaisPage         from "./pages/TutoriaisPage.jsx";
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
import { BrandLogo } from "./components/BrandLogo.jsx";
import { NavIcon, Shield, Menu, LogOut, Eye } from "./components/icons.jsx";

const PAGE_MAP_PJ = {
  // dashboard → V2 premium. Rollback: trocar DashboardV2Page por DashboardPage
  dashboard: DashboardV2Page, lancamentos: LancamentosPage, recorrencias: RecorrenciasPage,
  "resumo-anual": () => <ResumoAnualPage variant="pj" />,
  "contas-pagar": ContasAPagarPage,
  dre: DREPage, contas: ContasPage, plano: PlanoContasPage, impostos: ImpostosPage,
  clientes: ClientesPage, fornecedores: FornecedoresPage,
  importacoes: ImportacoesPage, conciliacao: ConciliacaoPage,
  balancete: BalancetePage, fechamento: FechamentoPage,
  "resultado-centro-custo": ResultadoCentroCustoPage,
  projetos: ProjetosFinanceirosPage,
  "resultado-cliente": ResultadoClientePage,
  "resultado-projeto": ResultadoProjetoPage,
  "orcado-realizado": OrcadoRealizadoPage,
  relatorios: RelatoriosPage, whatsapp: WhatsAppPage,
  "integracao-pf-pj": IntegracaoPfPjPage,
  "open-finance": ConexoesBancariasPage,
  tutoriais: () => <TutoriaisPage />,
  suporte: () => <SuportePage />,
  empresa: EmpresaPage,
};

const PAGE_MAP_PF = {
  // dashboard → V2 premium. Rollback: trocar DashboardPFV2Page por DashboardPFPage
  dashboard: DashboardPFV2Page, lancamentos: LancamentosPFPage,
  recorrencias: RecorrenciasPage,
  "resumo-anual": () => <ResumoAnualPage variant="pf" />,
  "contas-pagar": ContasAPagarPage,
  categorias: CategoriasPFPage, orcamento: OrcamentoPage,
  metas: MetasPage, contas: ContasPFPage,
  "resultado-centro-custo": () => <ResultadoCentroCustoPage pfMode />,
  projetos: () => <ProjetosFinanceirosPage pfMode />,
  "resultado-cliente": () => <ResultadoClientePage pfMode />,
  "resultado-projeto": () => <ResultadoProjetoPage pfMode />,
  "orcado-realizado": () => <OrcadoRealizadoPage pfMode />,
  relatorios: RelatoriosPFPage, whatsapp: WhatsAppPage,
  "open-finance": ConexoesBancariasPage,
  tutoriais: () => <TutoriaisPage pfMode />,
  suporte: () => <SuportePage pfMode />,
  perfil: PerfilPFPage,
};

// ─── SyncPill: indicador discreto de auto-sincronização ─────────────────────
function SyncPill({ syncing, lastSyncAt, onClick, apiOnline }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  let label = "Sincronizar";
  if (syncing) label = "Sincronizando…";
  else if (lastSyncAt) {
    const s = Math.max(0, Math.round((now - lastSyncAt) / 1000));
    if (s < 10) label = "Atualizado agora";
    else if (s < 60) label = `Atualizado há ${s}s`;
    else label = `Atualizado há ${Math.round(s / 60)}min`;
  }
  return (
    <button
      type="button"
      className={`sync-pill${syncing ? " sync-pill--busy" : ""}`}
      onClick={onClick}
      disabled={syncing || !apiOnline}
      title="Atualizar dados agora"
    >
      <span className="sync-pill-dot" aria-hidden />
      <span className="sync-pill-text">{label}</span>
    </button>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
export default function GestorApp() {
  const { user, logout, isSuperAdmin } = useAuth();
  const [page, setPage] = useState(() => (user?.role === "admin" ? "super-admin" : "dashboard"));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    empresa, tipo, pessoa, company, modalOpen, apiOnline, appLoadError,
    viewOnly, impersonatingUser, enterAsTenant, exitAsTenant,
    lastSyncAt, syncing, reloadAppState,
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

  const isPF = isPessoaFisica(tipo);
  const navItems = isPF ? NAV_ITEMS_FISICA : NAV_ITEMS;
  const navSections = isPF ? NAV_SECTIONS_FISICA : NAV_SECTIONS_PJ;
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
            <div className="sidebar-brand-logo-wrap">
              <BrandLogo variant="fluxiva" theme="dark" markSize={38} />
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
          <nav className="nav-sections-wrap" aria-label="Menu principal">
            {navSections.map((block) => (
              <div key={block.section} className="nav-section-block">
                <div className="nav-label">{block.section}</div>
                <div className="nav-list">
                  {block.items.map((n) => (
                    <div
                      key={n.id}
                      className={`nav-item${currentPage === n.id ? " active" : ""}`}
                      onClick={() => goTo(n.id)}
                      onKeyDown={(e) => e.key === "Enter" && goTo(n.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="nav-icon"><NavIcon name={n.id} /></span>
                      <span className="nav-text">{n.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
              <SyncPill
                syncing={syncing}
                lastSyncAt={lastSyncAt}
                onClick={reloadAppState}
                apiOnline={apiOnline}
              />
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
              background: "var(--warning-soft)", borderBottom: "1px solid var(--warning)",
              color: "var(--warning-fg)", padding: "10px 20px",
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
                  marginLeft: "auto", background: "var(--warning)", color: "#fff",
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
              : <PageComponent onNavigate={goTo} />
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
