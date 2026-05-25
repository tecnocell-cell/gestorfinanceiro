import { useState } from "react";
import { css } from "./styles.js";
import { NAV_ITEMS } from "./constants.js";
import { useGestor } from "./GestorContext.jsx";
import {
  ModalLancamento,
  ModalConta,
  ModalPlano,
  ModalCliente,
  ModalFornecedor,
} from "./components/Modals.jsx";
import {
  DashboardPage,
  LancamentosPage,
  DREPage,
  ContasPage,
  PlanoContasPage,
  ImpostosPage,
  ClientesPage,
  FornecedoresPage,
  ImportacoesPage,
  ConciliacaoPage,
  BalancetePage,
  FechamentoPage,
  RelatoriosPage,
  EmpresaPage,
} from "./pages/Pages.jsx";

const PAGE_MAP = {
  dashboard: DashboardPage,
  lancamentos: LancamentosPage,
  dre: DREPage,
  contas: ContasPage,
  plano: PlanoContasPage,
  impostos: ImpostosPage,
  clientes: ClientesPage,
  fornecedores: FornecedoresPage,
  importacoes: ImportacoesPage,
  conciliacao: ConciliacaoPage,
  balancete: BalancetePage,
  fechamento: FechamentoPage,
  relatorios: RelatoriosPage,
  empresa: EmpresaPage,
};

export default function GestorApp() {
  const [page, setPage] = useState("dashboard");
  const { company, modalOpen, apiOnline } = useGestor();
  const PageComponent = PAGE_MAP[page] || DashboardPage;
  const pageLabel = NAV_ITEMS.find((n) => n.id === page)?.label || "Dashboard";

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="brand-row">
              <div className="brand-mark">GF</div>
              <div>
                <h1>
                  Gestor
                  <br />
                  Financeiro
                </h1>
                <p>Painel · v2.0</p>
              </div>
            </div>
          </div>
          <nav className="nav-section">
            <div className="nav-label">Navegação</div>
            <div className="nav-list">
              {NAV_ITEMS.map((n) => (
                <div
                  key={n.id}
                  className={`nav-item${page === n.id ? " active" : ""}`}
                  onClick={() => setPage(n.id)}
                  onKeyDown={(e) => e.key === "Enter" && setPage(n.id)}
                  role="button"
                  tabIndex={0}
                >
                  <span className="nav-icon">{n.icon}</span>
                  <span>{n.label}</span>
                </div>
              ))}
            </div>
          </nav>
          <div className="sidebar-footer">
            <div className="sidebar-footer-name">{company.nomeFantasia}</div>
            <div className="sidebar-footer-cnpj">{company.cnpj}</div>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <span className="topbar-title">{pageLabel}</span>
            <div className="topbar-right">
              <span
                className={`status-dot ${apiOnline ? "online" : "offline"}`}
                title={apiOnline ? "API online" : "API offline"}
              />
              <span className="company-badge">{company.nomeFantasia}</span>
            </div>
          </div>
          <div className="content">
            <PageComponent />
          </div>
        </main>

        {modalOpen === "lancamento" && <ModalLancamento />}
        {modalOpen === "conta" && <ModalConta />}
        {modalOpen === "plano" && <ModalPlano />}
        {modalOpen === "cliente" && <ModalCliente />}
        {modalOpen === "fornecedor" && <ModalFornecedor />}
      </div>
    </>
  );
}
