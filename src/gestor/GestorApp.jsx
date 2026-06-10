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
  ModalCentroCusto, ModalProjetoFinanceiro, ModalOrcamentoMensal,
} from "./components/Modals.jsx";
import AdminOperacoesPage from "./pages/AdminOperacoesPage.jsx";
import AdminHomologacaoPage from "./pages/AdminHomologacaoPage.jsx";
import AdminSaasPage from "./pages/AdminSaasPage.jsx";
import AdminTenantsPage from "./pages/AdminTenantsPage.jsx";
import AdminBetaPage from "./pages/AdminBetaPage.jsx";
import AdminPaymentConfigPage from "./pages/AdminPaymentConfigPage.jsx";
import AdminReleaseCandidatePage from "./pages/AdminReleaseCandidatePage.jsx";
import AdminProductionGuidePage from "./pages/AdminProductionGuidePage.jsx";
import AdminRealHomologacaoPage from "./pages/AdminRealHomologacaoPage.jsx";
import BetaBanner from "./components/beta/BetaBanner.jsx";
import BetaBadge from "./components/beta/BetaBadge.jsx";
import BetaFeedbackFab from "./components/beta/BetaFeedbackFab.jsx";
import { useBetaMode } from "./hooks/useBetaMode.js";
import { useInactivityLogout } from "./hooks/useInactivityLogout.js";
import {
  ADMIN_NAV,
  DEFAULT_ADMIN_PAGE,
  isAdminPageId,
  adminPageLabel,
} from "./admin/adminNav.js";
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
import SegurancaPage from "./pages/SegurancaPage.jsx";
import PlanoAssinaturaPage from "./pages/PlanoAssinaturaPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import NotificationBell from "./components/NotificationBell.jsx";
import OnboardingPage from "./pages/OnboardingPage.jsx";
import AjudaPage from "./pages/AjudaPage.jsx";
import GuidedTour from "./components/GuidedTour.jsx";
import EquipePage from "./pages/EquipePage.jsx";
import { useEmpresaPermissions } from "./hooks/useEmpresaPermissions.js";
import { usePlanMenu } from "./hooks/usePlanMenu.js";
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
import { NavIcon, AdminNavIcon, Menu, LogOut, Eye, ChevronLeft } from "./components/icons.jsx";

const ADMIN_PAGE_MAP = {
  "admin-operacoes": AdminOperacoesPage,
  "admin-homologacao": AdminHomologacaoPage,
  "admin-saas": AdminSaasPage,
  "admin-tenants": AdminTenantsPage,
  "admin-beta": AdminBetaPage,
  "admin-pagamentos": AdminPaymentConfigPage,
  "admin-release": AdminReleaseCandidatePage,
  "admin-guia": AdminProductionGuidePage,
  "admin-homologacao-real": AdminRealHomologacaoPage,
};

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
  ajuda: AjudaPage,
  suporte: () => <SuportePage />,
  empresa: EmpresaPage,
  equipe: EquipePage,
  seguranca: SegurancaPage,
  notificacoes: NotificationsPage,
  "plano-assinatura": PlanoAssinaturaPage,
  onboarding: OnboardingPage,
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
  ajuda: (props) => <AjudaPage pfMode {...props} />,
  suporte: () => <SuportePage pfMode />,
  perfil: PerfilPFPage,
  seguranca: SegurancaPage,
  notificacoes: NotificationsPage,
  "plano-assinatura": PlanoAssinaturaPage,
  onboarding: OnboardingPage,
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
  const { betaMode, message: betaMessage } = useBetaMode();
  useInactivityLogout();
  const [page, setPage] = useState(() => {
    if (user?.role !== "admin") return "dashboard";
    const saved = typeof sessionStorage !== "undefined" && sessionStorage.getItem("admin_page");
    return isAdminPageId(saved) ? saved : DEFAULT_ADMIN_PAGE;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    empresa, tipo, pessoa, company, modalOpen, apiOnline, appLoadError,
    viewOnly, impersonatingUser, enterAsTenant, exitAsTenant,
    lastSyncAt, syncing, reloadAppState, patchEmpresa,
  } = useGestor();

  const goTo = (p) => {
    setPage(p);
    setSidebarOpen(false);
    if (isAdminPageId(p)) {
      try {
        sessionStorage.setItem("admin_page", p);
      } catch {
        /* ignore */
      }
    }
  };
  const goToAdmin = (section = DEFAULT_ADMIN_PAGE) => {
    exitAsTenant();
    goTo(isAdminPageId(section) ? section : DEFAULT_ADMIN_PAGE);
  };

  const showTour =
    !viewOnly && empresa && !empresa.tourConcluido && !isAdminPageId(page);
  const finishTour = () => patchEmpresa({ tourConcluido: true });

  useEffect(() => {
    const onNavigate = (e) => {
      const target = e.detail?.page;
      if (target) goTo(target);
    };
    window.addEventListener("gestor-navigate", onNavigate);
    return () => window.removeEventListener("gestor-navigate", onNavigate);
  }, []);

  useEffect(() => {
    try {
      const open = sessionStorage.getItem("cf_open_page");
      if (open) {
        sessionStorage.removeItem("cf_open_page");
        goTo(open);
      }
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  const handleEnterTenant = async (tenantUser) => {
    try {
      await enterAsTenant(tenantUser);
      goTo("dashboard");
    } catch (err) {
      alert(err.message);
    }
  };

  const { canAccessMenu } = useEmpresaPermissions();
  const { filterNavSections } = usePlanMenu(tipo);
  const isPF = isPessoaFisica(tipo);
  const rawSections = isPF ? NAV_SECTIONS_FISICA : NAV_SECTIONS_PJ;
  const navSections = filterNavSections(
    rawSections
      .map((block) => ({
        ...block,
        items: block.items.filter((n) => canAccessMenu(n.id)),
      }))
      .filter((block) => block.items.length > 0)
  );
  const navItems = navSections.flatMap((s) => s.items);
  const pageMap  = isPF ? PAGE_MAP_PF : PAGE_MAP_PJ;

  const isAdminPage = isAdminPageId(page);
  const AdminPageComponent = ADMIN_PAGE_MAP[page] || ADMIN_PAGE_MAP[DEFAULT_ADMIN_PAGE];
  const currentPage = (!isAdminPage && pageMap[page]) ? page : "dashboard";
  const PageComponent = pageMap[currentPage] || pageMap.dashboard;

  useEffect(() => {
    if (page === "super-admin") setPage(DEFAULT_ADMIN_PAGE);
  }, [page]);

  useEffect(() => {
    if (isAdminPage) return;
    if (!pageMap[page]) setPage("dashboard");
  }, [isPF, isAdminPage, page, pageMap]);

  const pageLabel = isAdminPage
    ? adminPageLabel(page)
    : (navItems.find((n) => n.id === currentPage)?.label || "Dashboard");

  const displayName = isPF
    ? (pessoa?.nome || empresa?.nome || "")
    : (company?.nomeFantasia || empresa?.nome || "");
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

          {/* ── Super Admin: menu completo OU só voltar (modo visualização do cliente) ─ */}
          {isSuperAdmin && impersonatingUser && (
            <div className="admin-sidebar-block">
              <div
                role="button"
                tabIndex={0}
                className="admin-nav-btn admin-nav-btn--back"
                onClick={goToAdmin}
                onKeyDown={(e) => e.key === "Enter" && goToAdmin()}
                aria-label="Voltar ao Super Admin"
              >
                <span className="admin-nav-icon" aria-hidden>
                  <ChevronLeft size={18} strokeWidth={1.75} />
                </span>
                <div className="admin-nav-text">
                  <div className="admin-nav-title">Voltar ao Super Admin</div>
                  <div className="admin-nav-sub">
                    {impersonatingUser.nome_perfil || impersonatingUser.nome}
                  </div>
                </div>
              </div>
              <div className="admin-sidebar-divider" />
            </div>
          )}
          {isSuperAdmin && !impersonatingUser && (
            <div className="admin-sidebar-block admin-sidebar-block--fill">
              <div className="admin-sidebar-label">Super Admin</div>
              <nav className="admin-nav-list" aria-label="Menu administrativo">
                {ADMIN_NAV.map((item) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    className={`admin-nav-btn${page === item.id ? " active" : ""}`}
                    onClick={() => goToAdmin(item.id)}
                    onKeyDown={(e) => e.key === "Enter" && goToAdmin(item.id)}
                  >
                    <span className="admin-nav-icon" aria-hidden>
                      <AdminNavIcon name={item.icon} />
                    </span>
                    <div className="admin-nav-text">
                      <div className="admin-nav-title">{item.label}</div>
                      <div className="admin-nav-sub">{item.sub}</div>
                    </div>
                  </div>
                ))}
              </nav>
              <div className="admin-sidebar-divider" />
            </div>
          )}

          {/* ── Navegação financeira (oculta no painel admin) ───── */}
          {!isAdminPage && (
          <nav className="nav-sections-wrap" aria-label="Menu principal">
            {navSections.map((block) => (
              <div key={block.section} className="nav-section-block">
                <div className="nav-label">{block.section}</div>
                <div className="nav-list">
                  {block.items.map((n) => {
                    const blocked = n.planAccess === "blocked";
                    return (
                      <div
                        key={n.id}
                        className={`nav-item${currentPage === n.id ? " active" : ""}${blocked ? " nav-item--plan-blocked" : ""}`}
                        onClick={() => (blocked ? goTo("plano-assinatura") : goTo(n.id))}
                        onKeyDown={(e) => e.key === "Enter" && (blocked ? goTo("plano-assinatura") : goTo(n.id))}
                        role="button"
                        tabIndex={0}
                        title={blocked ? "Ver planos" : undefined}
                      >
                        <span className="nav-icon"><NavIcon name={n.id} /></span>
                        <span className="nav-text">{n.label}{blocked ? " · Plano" : ""}</span>
                      </div>
                    );
                  })}
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
              {betaMode && !isAdminPage && <BetaBadge className="topbar-beta-badge" />}
            </div>
            <div className="topbar-right">
              {!isAdminPage && !viewOnly && (
                <NotificationBell onOpenCenter={() => goTo("notificacoes")} />
              )}
              <SyncPill
                syncing={syncing}
                lastSyncAt={lastSyncAt}
                onClick={reloadAppState}
                apiOnline={apiOnline}
              />
              <span className={`status-dot ${apiOnline ? "online" : "offline"}`}
                title={apiOnline ? "Servidor PostgreSQL online" : "Servidor offline — execute npm run dev:all"} />
              <span className="topbar-user">{user?.nome || user?.email}</span>
              {isSuperAdmin && !impersonatingUser && (
                <span className="badge-super-admin">SUPER ADMIN</span>
              )}
              {impersonatingUser && (
                <span className="company-badge badge-view-only" title="Somente leitura">
                  <Eye size={12} strokeWidth={2} style={{ marginRight: 4, verticalAlign: -2 }} />
                  {impersonatingUser.nome_perfil || impersonatingUser.nome}
                </span>
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

          {betaMode && !isAdminPage && <BetaBanner message={betaMessage} />}

          <div className={`content${viewOnly ? " content-view-only" : ""}`}>
            {isAdminPage ? (
              page === "admin-tenants" ? (
                <AdminTenantsPage onEnterTenant={handleEnterTenant} />
              ) : (
                <AdminPageComponent />
              )
            ) : currentPage === "onboarding" ? (
              <OnboardingPage onDone={() => goTo("dashboard")} />
            ) : (
              <PageComponent onNavigate={goTo} />
            )}
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
        {!isAdminPage && modalOpen === "centro-custo" && <ModalCentroCusto />}
        {!isAdminPage && modalOpen === "projeto-financeiro" && <ModalProjetoFinanceiro />}
        {!isAdminPage && modalOpen === "orcamento-mensal" && <ModalOrcamentoMensal />}

        {!isAdminPage && !viewOnly && <PfDueAlert />}

        {showTour && (
          <GuidedTour isPF={isPF} onNavigate={goTo} onDone={finishTour} />
        )}

        {betaMode && !isAdminPage && !viewOnly && (
          <BetaFeedbackFab currentPage={currentPage} />
        )}
      </div>
    </>
  );
}
