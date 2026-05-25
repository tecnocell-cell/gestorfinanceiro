import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart
} from "recharts";

// ─── DATA STORE (simulates the Access DB + spreadsheet) ─────────────────────
const initialCompanyInfo = {
  nomeFantasia: "Empresa Demo",
  razaoSocial: "Empresa Demonstração Ltda",
  cnpj: "00.000.000/0001-91",
  inscricaoEstadual: "",
  codigoDominio: 0,
};

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const CHART = {
  grid: "#e8edf3",
  tick: "#94a3b8",
  receita: "#10b981",
  custo: "#f43f5e",
  despesas: "#f97316",
  lucro: "#0d9488",
  lucroBruto: "#3b82f6",
  pie: ["#10b981", "#f43f5e", "#f97316", "#3b82f6"],
};

const generateId = () => Math.random().toString(36).substr(2, 9);

// Simulate some initial data
const initialContas = [
  { id: "c1", codigo: 1, nome: "Caixa Geral", tipo: "Caixa", saldoInicial: 0 },
  { id: "c2", codigo: 2, nome: "Banco Principal", tipo: "Banco", saldoInicial: 0 },
];

const initialPlanoContas = [
  { id: "p1", codigo: "1.1.001", classificacao: "RECEITA", descricao: "Venda de Produtos", tipo: "Receita" },
  { id: "p2", codigo: "1.1.002", classificacao: "RECEITA", descricao: "Prestação de Serviços", tipo: "Receita" },
  { id: "p3", codigo: "2.1.001", classificacao: "CUSTO", descricao: "Custo Mercadorias Vendidas", tipo: "Custo" },
  { id: "p4", codigo: "2.1.002", classificacao: "CUSTO", descricao: "Fretes e Transportes", tipo: "Custo" },
  { id: "p5", codigo: "3.1.001", classificacao: "DESPESA", descricao: "Salários e Encargos", tipo: "Despesa" },
  { id: "p6", codigo: "3.1.002", classificacao: "DESPESA", descricao: "Aluguel", tipo: "Despesa" },
  { id: "p7", codigo: "3.1.003", classificacao: "DESPESA", descricao: "Energia Elétrica", tipo: "Despesa" },
  { id: "p8", codigo: "3.1.004", classificacao: "DESPESA", descricao: "Combustível", tipo: "Despesa" },
  { id: "p9", codigo: "3.2.001", classificacao: "DESPESA", descricao: "Marketing", tipo: "Despesa" },
  { id: "p10", codigo: "3.2.002", classificacao: "DESPESA", descricao: "Manutenção", tipo: "Despesa" },
];

const initialLancamentos = [];

// ─── HELPERS ────────────────────────────────────────────────────────────────
const fmtBRL = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const fmtPct = (v) => `${((v || 0) * 100).toFixed(1)}%`;

const MONTH_FROM_DATE = (d) => {
  if (!d) return null;
  const m = new Date(d + "T00:00:00").getMonth();
  return MESES[m];
};

// ─── STYLES ─────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #f4f7fb;
    --surface: #ffffff;
    --surface2: #f8fafc;
    --surface3: #f1f5f9;
    --border: #e2e8f0;
    --border-light: #eef2f6;
    --accent: #0d9488;
    --accent-hover: #0f766e;
    --accent-light: rgba(13, 148, 136, 0.1);
    --accent2: #ea580c;
    --accent3: #2563eb;
    --danger: #e11d48;
    --text: #0f172a;
    --text2: #475569;
    --text3: #94a3b8;
    --font-display: 'Plus Jakarta Sans', sans-serif;
    --font-body: 'Plus Jakarta Sans', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
    --radius: 14px;
    --radius-sm: 10px;
    --shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 20px rgba(15, 23, 42, 0.05);
    --shadow-lg: 0 12px 40px rgba(15, 23, 42, 0.1);
  }

  body {
    background: var(--bg);
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -20%, rgba(13, 148, 136, 0.06), transparent),
      radial-gradient(ellipse 60% 40% at 100% 0%, rgba(37, 99, 235, 0.04), transparent);
    color: var(--text);
    font-family: var(--font-body);
    font-size: 14px;
    -webkit-font-smoothing: antialiased;
  }

  .app { display: flex; min-height: 100vh; }

  /* SIDEBAR */
  .sidebar {
    width: 240px; min-height: 100vh; background: var(--surface);
    border-right: 1px solid var(--border-light);
    display: flex; flex-direction: column;
    position: fixed; left: 0; top: 0; bottom: 0; z-index: 100;
    box-shadow: 2px 0 24px rgba(15, 23, 42, 0.03);
  }
  .sidebar-logo {
    padding: 28px 22px 24px;
    border-bottom: 1px solid var(--border-light);
  }
  .brand-row { display: flex; align-items: center; gap: 12px; }
  .brand-mark {
    width: 40px; height: 40px; border-radius: 12px;
    background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
    color: white; font-family: var(--font-display); font-weight: 700;
    font-size: 14px; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);
    flex-shrink: 0;
  }
  .sidebar-logo h1 {
    font-family: var(--font-display); font-size: 16px; font-weight: 700;
    color: var(--text); line-height: 1.25; letter-spacing: -0.02em;
  }
  .sidebar-logo p { font-size: 11px; color: var(--text3); margin-top: 3px; font-weight: 500; }
  .nav-section { padding: 16px 0; flex: 1; }
  .nav-label {
    font-size: 10px; color: var(--text3); font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase;
    padding: 0 22px 10px;
  }
  .nav-item {
    display: flex; align-items: center; gap: 11px;
    margin: 2px 12px; padding: 10px 14px; border-radius: var(--radius-sm);
    cursor: pointer; transition: all 0.18s ease;
    font-size: 13.5px; font-weight: 500; color: var(--text2);
  }
  .nav-item:hover { background: var(--surface3); color: var(--text); }
  .nav-item.active {
    background: var(--accent-light); color: var(--accent);
    font-weight: 600; box-shadow: inset 0 0 0 1px rgba(13, 148, 136, 0.15);
  }
  .nav-icon {
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; background: var(--surface3); transition: background 0.18s;
  }
  .nav-item.active .nav-icon { background: rgba(13, 148, 136, 0.15); }
  .sidebar-footer {
    padding: 18px 22px; border-top: 1px solid var(--border-light);
    background: var(--surface2);
  }
  .sidebar-footer-name { font-size: 12px; font-weight: 600; color: var(--text); }
  .sidebar-footer-cnpj { font-size: 11px; color: var(--text3); margin-top: 2px; font-family: var(--font-mono); }

  /* MAIN */
  .main { margin-left: 240px; flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .topbar {
    height: 64px; background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(12px); border-bottom: 1px solid var(--border-light);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 32px; position: sticky; top: 0; z-index: 50;
  }
  .topbar-title {
    font-family: var(--font-display); font-size: 22px; font-weight: 700;
    color: var(--text); letter-spacing: -0.03em;
  }
  .topbar-right { display: flex; align-items: center; gap: 12px; }
  .company-badge {
    font-size: 12px; color: var(--text2); font-weight: 500;
    background: var(--surface2); padding: 6px 14px; border-radius: 20px;
    border: 1px solid var(--border);
  }

  /* CONTENT */
  .content { padding: 28px 32px 40px; flex: 1; }

  /* CARDS */
  .card {
    background: var(--surface); border: 1px solid var(--border-light);
    border-radius: var(--radius); padding: 22px; box-shadow: var(--shadow);
  }
  .card-title {
    font-family: var(--font-display); font-size: 14px; font-weight: 600;
    color: var(--text2); margin-bottom: 18px; letter-spacing: -0.01em;
  }

  /* KPI GRID */
  .kpi-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 16px; margin-bottom: 24px;
  }
  .kpi-card {
    background: var(--surface); border: 1px solid var(--border-light);
    border-radius: var(--radius); padding: 20px 22px;
    position: relative; overflow: hidden; box-shadow: var(--shadow);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(15, 23, 42, 0.08); }
  .kpi-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: var(--kpi-color, var(--accent)); opacity: 0.85;
  }
  .kpi-label {
    font-size: 11px; color: var(--text3); text-transform: uppercase;
    letter-spacing: 0.07em; font-weight: 600;
  }
  .kpi-value {
    font-family: var(--font-mono); font-size: 21px; font-weight: 500;
    margin-top: 10px; color: var(--kpi-color, var(--text)); letter-spacing: -0.02em;
  }
  .kpi-sub { font-size: 12px; color: var(--text3); margin-top: 6px; }

  /* CHARTS GRID */
  .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  .charts-grid.full { grid-template-columns: 1fr; }
  @media (max-width: 900px) { .charts-grid { grid-template-columns: 1fr; } }

  /* TABLE */
  .table-wrap { overflow-x: auto; border-radius: var(--radius); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th {
    background: var(--surface2); color: var(--text3); font-weight: 600;
    padding: 12px 16px; text-align: left; white-space: nowrap;
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
    border-bottom: 1px solid var(--border-light);
  }
  tbody tr { border-bottom: 1px solid var(--border-light); transition: background 0.12s; }
  tbody tr:hover { background: var(--surface2); }
  tbody td { padding: 10px 14px; color: var(--text); vertical-align: middle; }
  .td-mono { font-family: var(--font-mono); }
  .td-green { color: var(--accent); font-family: var(--font-mono); }
  .td-red { color: var(--danger); font-family: var(--font-mono); }
  .td-amber { color: var(--accent2); font-family: var(--font-mono); }

  /* BADGE */
  .badge {
    display: inline-block; padding: 2px 8px; border-radius: 4px;
    font-size: 11px; font-family: var(--font-mono); font-weight: 500;
  }
  .badge-green { background: rgba(16, 185, 129, 0.12); color: #059669; }
  .badge-red { background: rgba(225, 29, 72, 0.1); color: var(--danger); }
  .badge-blue { background: rgba(37, 99, 235, 0.1); color: var(--accent3); }
  .badge-amber { background: rgba(234, 88, 12, 0.1); color: var(--accent2); }

  /* FORMS */
  .form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
  .form-group { display: flex; flex-direction: column; gap: 5px; }
  .form-label { font-size: 11px; color: var(--text2); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .form-input, .form-select, .form-textarea {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
    color: var(--text); font-family: var(--font-body); font-size: 13px;
    padding: 10px 14px; transition: border-color 0.15s, box-shadow 0.15s; outline: none; width: 100%;
  }
  .form-input:focus, .form-select:focus, .form-textarea:focus {
    border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light);
  }
  .form-textarea { resize: vertical; min-height: 72px; }
  .form-select option { background: var(--surface2); }

  /* BUTTONS */
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 18px; border-radius: var(--radius-sm); border: none; cursor: pointer;
    font-family: var(--font-body); font-size: 13px; font-weight: 600;
    transition: all 0.18s ease; white-space: nowrap;
  }
  .btn-primary {
    background: linear-gradient(135deg, #14b8a6, #0d9488);
    color: white; box-shadow: 0 2px 8px rgba(13, 148, 136, 0.35);
  }
  .btn-primary:hover { background: linear-gradient(135deg, #0d9488, #0f766e); transform: translateY(-1px); }
  .btn-secondary { background: var(--surface); color: var(--text2); border: 1px solid var(--border); }
  .btn-secondary:hover { background: var(--surface2); color: var(--text); border-color: var(--text3); }
  .btn-danger { background: rgba(225, 29, 72, 0.08); color: var(--danger); border: 1px solid rgba(225, 29, 72, 0.2); }
  .btn-danger:hover { background: rgba(225, 29, 72, 0.14); }
  .btn-sm { padding: 6px 12px; font-size: 12px; }
  .btn-icon { padding: 7px; border-radius: 8px; }

  /* TOOLBAR */
  .toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }
  .toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

  /* FILTER */
  .filter-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .filter-chip {
    padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 500; cursor: pointer;
    border: 1px solid var(--border); color: var(--text2); background: var(--surface);
    transition: all 0.15s;
  }
  .filter-chip.active { background: var(--accent-light); color: var(--accent); border-color: rgba(13, 148, 136, 0.3); font-weight: 600; }
  .filter-chip:hover:not(.active) { border-color: var(--text3); color: var(--text); background: var(--surface2); }

  /* SEARCH */
  .search-wrap { position: relative; }
  .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text3); font-size: 14px; }
  .search-input {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
    color: var(--text); font-size: 13px; padding: 9px 14px 9px 36px;
    outline: none; transition: border-color 0.15s, box-shadow 0.15s; width: 240px;
  }
  .search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }

  /* MODAL */
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); z-index: 200;
    display: flex; align-items: center; justify-content: center; padding: 20px;
    backdrop-filter: blur(6px);
  }
  .modal {
    background: var(--surface); border: 1px solid var(--border-light); border-radius: 16px;
    width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto;
    box-shadow: var(--shadow-lg);
    animation: slideUp 0.25s ease;
  }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px 16px; border-bottom: 1px solid var(--border);
  }
  .modal-title { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--text); }
  .modal-body { padding: 20px 24px; }
  .modal-footer { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; }

  /* DIVIDER */
  .divider { height: 1px; background: var(--border); margin: 20px 0; }

  /* EMPTY STATE */
  .empty-state { text-align: center; padding: 48px; color: var(--text3); }
  .empty-icon { font-size: 42px; margin-bottom: 12px; }
  .empty-text { font-size: 15px; }

  /* DRE TABLE */
  .dre-receita td:first-child { padding-left: 24px; }
  .dre-total td { font-weight: 600; background: var(--surface3) !important; }
  .dre-result td { font-family: var(--font-mono); font-weight: 600; }

  /* PERIOD SELECTOR */
  .period-selector { display: flex; align-items: center; gap: 8px; }
  .period-selector select {
    background: var(--surface); border: 1px solid var(--border); color: var(--text);
    padding: 8px 12px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500;
    outline: none; cursor: pointer;
  }
  .period-selector select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }

  /* SALDO CARD */
  .saldo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px; margin-bottom: 24px; }
  .saldo-card {
    background: var(--surface2); border: 1px solid var(--border-light); border-radius: var(--radius-sm);
    padding: 16px 18px; display: flex; flex-direction: column; gap: 6px;
    transition: background 0.15s, border-color 0.15s;
  }
  .saldo-card:hover { background: var(--surface); border-color: var(--border); }
  .saldo-nome { font-size: 13px; font-weight: 600; color: var(--text); }
  .saldo-tipo { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text3); }
  .saldo-valor { font-family: var(--font-mono); font-size: 18px; color: var(--accent); font-weight: 500; }

  /* SCROLL */
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

  /* TOOLTIP custom */
  .recharts-tooltip-wrapper .recharts-default-tooltip {
    background: var(--surface) !important; border: 1px solid var(--border) !important;
    border-radius: 8px !important; font-family: var(--font-mono) !important; font-size: 12px !important;
  }

  /* TABS */
  .tabs { display: flex; gap: 4px; margin-bottom: 20px; background: var(--surface2); border-radius: var(--radius-sm); padding: 4px; border: 1px solid var(--border-light); width: fit-content; }
  .tab { padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; color: var(--text2); transition: all 0.15s; }
  .tab.active { background: var(--surface); color: var(--text); box-shadow: var(--shadow); font-weight: 600; }
  .tab:hover:not(.active) { color: var(--text); }

  @media (max-width: 900px) {
    .sidebar { width: 72px; }
    .sidebar-logo h1, .sidebar-logo p, .nav-label, .nav-item span:not(.nav-icon), .sidebar-footer { display: none; }
    .brand-row { justify-content: center; }
    .nav-item { justify-content: center; margin: 4px 8px; padding: 10px; }
    .main { margin-left: 72px; }
    .content { padding: 20px 16px; }
  }
`;

// ─── TOOLTIP ────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10,
      padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12,
      boxShadow: "0 4px 16px rgba(15, 23, 42, 0.08)",
    }}>
      <div style={{ color: "var(--text2)", marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {typeof p.value === "number" ? fmtBRL(p.value) : p.value}
        </div>
      ))}
    </div>
  );
};

// ─── APP ────────────────────────────────────────────────────────────────────
export default function GestorFinanceiro() {
  const [page, setPage] = useState("dashboard");
  const [lancamentos, setLancamentos] = useState(initialLancamentos);
  const [contas, setContas] = useState(initialContas);
  const [planoContas, setPlanoContas] = useState(initialPlanoContas);
  const [company] = useState(initialCompanyInfo);
  const [modalOpen, setModalOpen] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [filterPeriodo, setFilterPeriodo] = useState({ ano: "2024", mes: "" });
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("Todos");

  // ── COMPUTED ────────────────────────────────────────────────────────────
  const getLancamentosFiltrados = () => {
    return lancamentos.filter((l) => {
      const date = new Date(l.data + "T00:00:00");
      const ano = date.getFullYear().toString();
      const mes = (date.getMonth() + 1).toString().padStart(2, "0");
      if (filterPeriodo.ano && ano !== filterPeriodo.ano) return false;
      if (filterPeriodo.mes && mes !== filterPeriodo.mes) return false;
      if (tipoFilter !== "Todos" && l.tipo !== tipoFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const conta = contas.find((c) => c.id === l.contaEntradaId || c.id === l.contaSaidaId);
        const plano = planoContas.find((p) => p.id === l.planoId);
        if (
          !l.historico?.toLowerCase().includes(q) &&
          !conta?.nome?.toLowerCase().includes(q) &&
          !plano?.descricao?.toLowerCase().includes(q) &&
          !l.lote?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    }).sort((a, b) => new Date(b.data) - new Date(a.data));
  };

  const getSaldoConta = (contaId) => {
    const conta = contas.find((c) => c.id === contaId);
    if (!conta) return 0;
    const entradas = lancamentos.filter((l) => l.contaEntradaId === contaId).reduce((s, l) => s + l.valor, 0);
    const saidas = lancamentos.filter((l) => l.contaSaidaId === contaId).reduce((s, l) => s + l.valor, 0);
    return (conta.saldoInicial || 0) + entradas - saidas;
  };

  const getSaldoTotal = () => contas.reduce((s, c) => s + getSaldoConta(c.id), 0);

  const getDRE = (ano, mes) => {
    const filtered = lancamentos.filter((l) => {
      const d = new Date(l.data + "T00:00:00");
      if (ano && d.getFullYear().toString() !== ano) return false;
      if (mes && (d.getMonth() + 1).toString().padStart(2, "0") !== mes) return false;
      return true;
    });

    const resultado = {};
    planoContas.forEach((pc) => {
      const entradas = filtered.filter((l) => l.planoId === pc.id && l.tipo === "Entrada").reduce((s, l) => s + l.valor, 0);
      const saidas = filtered.filter((l) => l.planoId === pc.id && l.tipo === "Saida").reduce((s, l) => s + l.valor, 0);
      resultado[pc.id] = { entradas, saidas, saldo: entradas - saidas };
    });

    const receitas = planoContas.filter((p) => p.tipo === "Receita").reduce((s, p) => s + resultado[p.id]?.entradas, 0);
    const custos = planoContas.filter((p) => p.tipo === "Custo").reduce((s, p) => s + resultado[p.id]?.saidas, 0);
    const despesas = planoContas.filter((p) => p.tipo === "Despesa").reduce((s, p) => s + resultado[p.id]?.saidas, 0);
    const lucroBruto = receitas - custos;
    const lucroLiquido = lucroBruto - despesas;

    return { receitas, custos, despesas, lucroBruto, lucroLiquido, resultado, lucroPct: receitas > 0 ? lucroLiquido / receitas : 0 };
  };

  const getMensal = () => {
    return MESES.map((m, i) => {
      const mes = (i + 1).toString().padStart(2, "0");
      const dre = getDRE(filterPeriodo.ano, mes);
      return { name: m, Receita: dre.receitas, Custo: dre.custos, Despesas: dre.despesas, "Lucro Líquido": dre.lucroLiquido };
    });
  };

  const dreAtual = getDRE(filterPeriodo.ano, filterPeriodo.mes);
  const mensal = getMensal();
  const lancsFiltrados = getLancamentosFiltrados();

  // ── MODAL HELPERS ───────────────────────────────────────────────────────
  const openModal = (type, item = null) => { setModalOpen(type); setEditingItem(item); };
  const closeModal = () => { setModalOpen(null); setEditingItem(null); };

  // ── PAGES ───────────────────────────────────────────────────────────────
  const PAGES = {
    dashboard: <Dashboard
      dreAtual={dreAtual} mensal={mensal} contas={contas}
      getSaldoConta={getSaldoConta} getSaldoTotal={getSaldoTotal}
      lancamentos={lancamentos} planoContas={planoContas}
      filterPeriodo={filterPeriodo} setFilterPeriodo={setFilterPeriodo}
    />,
    lancamentos: <Lancamentos
      lancamentos={lancsFiltrados} contas={contas} planoContas={planoContas}
      onAdd={() => openModal("lancamento")}
      onEdit={(item) => openModal("lancamento", item)}
      onDelete={(id) => setLancamentos((p) => p.filter((l) => l.id !== id))}
      search={search} setSearch={setSearch}
      tipoFilter={tipoFilter} setTipoFilter={setTipoFilter}
      filterPeriodo={filterPeriodo} setFilterPeriodo={setFilterPeriodo}
    />,
    dre: <DRE
      dreAtual={dreAtual} planoContas={planoContas} lancamentos={lancamentos}
      getDRE={getDRE} filterPeriodo={filterPeriodo} setFilterPeriodo={setFilterPeriodo}
    />,
    contas: <Contas
      contas={contas} getSaldoConta={getSaldoConta} getSaldoTotal={getSaldoTotal}
      onAdd={() => openModal("conta")}
      onEdit={(item) => openModal("conta", item)}
      onDelete={(id) => setContas((p) => p.filter((c) => c.id !== id))}
    />,
    plano: <PlanoContas
      planoContas={planoContas}
      onAdd={() => openModal("plano")}
      onEdit={(item) => openModal("plano", item)}
      onDelete={(id) => setPlanoContas((p) => p.filter((c) => c.id !== id))}
    />,
  };

  const nav = [
    { id: "dashboard", icon: "◉", label: "Dashboard" },
    { id: "lancamentos", icon: "↔", label: "Lançamentos" },
    { id: "dre", icon: "▤", label: "D.R.E." },
    { id: "contas", icon: "◎", label: "Contas / Caixas" },
    { id: "plano", icon: "▦", label: "Plano de Contas" },
  ];

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="brand-row">
              <div className="brand-mark">GF</div>
              <div>
                <h1>Gestor<br/>Financeiro</h1>
                <p>Painel BI · v1.0</p>
              </div>
            </div>
          </div>
          <nav className="nav-section">
            <div className="nav-label">Menu</div>
            {nav.map((n) => (
              <div key={n.id} className={`nav-item${page === n.id ? " active" : ""}`} onClick={() => setPage(n.id)}>
                <span className="nav-icon">{n.icon}</span>
                <span>{n.label}</span>
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="sidebar-footer-name">{company.nomeFantasia}</div>
            <div className="sidebar-footer-cnpj">{company.cnpj}</div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="main">
          <div className="topbar">
            <span className="topbar-title">{nav.find((n) => n.id === page)?.label}</span>
            <div className="topbar-right">
              <span className="company-badge">{company.nomeFantasia}</span>
            </div>
          </div>
          <div className="content">{PAGES[page]}</div>
        </main>

        {/* MODALS */}
        {modalOpen === "lancamento" && (
          <ModalLancamento
            item={editingItem} contas={contas} planoContas={planoContas}
            onClose={closeModal}
            onSave={(data) => {
              if (editingItem) {
                setLancamentos((p) => p.map((l) => (l.id === editingItem.id ? { ...data, id: editingItem.id } : l)));
              } else {
                setLancamentos((p) => [...p, { ...data, id: generateId() }]);
              }
              closeModal();
            }}
          />
        )}
        {modalOpen === "conta" && (
          <ModalConta
            item={editingItem} onClose={closeModal}
            onSave={(data) => {
              if (editingItem) {
                setContas((p) => p.map((c) => (c.id === editingItem.id ? { ...data, id: editingItem.id } : c)));
              } else {
                setContas((p) => [...p, { ...data, id: generateId() }]);
              }
              closeModal();
            }}
          />
        )}
        {modalOpen === "plano" && (
          <ModalPlano
            item={editingItem} onClose={closeModal}
            onSave={(data) => {
              if (editingItem) {
                setPlanoContas((p) => p.map((c) => (c.id === editingItem.id ? { ...data, id: editingItem.id } : c)));
              } else {
                setPlanoContas((p) => [...p, { ...data, id: generateId() }]);
              }
              closeModal();
            }}
          />
        )}
      </div>
    </>
  );
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────
function Dashboard({ dreAtual, mensal, contas, getSaldoConta, getSaldoTotal, lancamentos, planoContas, filterPeriodo, setFilterPeriodo }) {
  const pieData = [
    { name: "Receita", value: dreAtual.receitas },
    { name: "Custos", value: dreAtual.custos },
    { name: "Despesas", value: dreAtual.despesas },
    { name: "Lucro", value: Math.max(dreAtual.lucroLiquido, 0) },
  ].filter((d) => d.value > 0);

  const COLORS = CHART.pie;

  return (
    <div>
      {/* Period Selector */}
      <div className="toolbar">
        <div className="period-selector">
          <span style={{ color: "var(--text2)", fontSize: 13 }}>Período:</span>
          <select value={filterPeriodo.ano} onChange={(e) => setFilterPeriodo((p) => ({ ...p, ano: e.target.value }))}>
            {["2022","2023","2024","2025"].map((y) => <option key={y}>{y}</option>)}
          </select>
          <select value={filterPeriodo.mes} onChange={(e) => setFilterPeriodo((p) => ({ ...p, mes: e.target.value }))}>
            <option value="">Todos os meses</option>
            {MESES.map((m, i) => <option key={m} value={(i+1).toString().padStart(2,"0")}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{"--kpi-color": "var(--accent)"}}>
          <div className="kpi-label">Receita Total</div>
          <div className="kpi-value">{fmtBRL(dreAtual.receitas)}</div>
          <div className="kpi-sub">Entradas no período</div>
        </div>
        <div className="kpi-card" style={{"--kpi-color": "var(--danger)"}}>
          <div className="kpi-label">Custos</div>
          <div className="kpi-value">{fmtBRL(dreAtual.custos)}</div>
          <div className="kpi-sub">CMV e prod. diretos</div>
        </div>
        <div className="kpi-card" style={{"--kpi-color": "var(--accent2)"}}>
          <div className="kpi-label">Despesas</div>
          <div className="kpi-value">{fmtBRL(dreAtual.despesas)}</div>
          <div className="kpi-sub">Operacionais</div>
        </div>
        <div className="kpi-card" style={{"--kpi-color": dreAtual.lucroLiquido >= 0 ? "var(--accent)" : "var(--danger)"}}>
          <div className="kpi-label">Lucro Líquido</div>
          <div className="kpi-value">{fmtBRL(dreAtual.lucroLiquido)}</div>
          <div className="kpi-sub">{fmtPct(dreAtual.lucroPct)} de margem</div>
        </div>
        <div className="kpi-card" style={{"--kpi-color": "var(--accent3)"}}>
          <div className="kpi-label">Saldo Total</div>
          <div className="kpi-value">{fmtBRL(getSaldoTotal())}</div>
          <div className="kpi-sub">{contas.length} contas/caixas</div>
        </div>
        <div className="kpi-card" style={{"--kpi-color": "var(--accent2)"}}>
          <div className="kpi-label">Lucro Bruto</div>
          <div className="kpi-value">{fmtBRL(dreAtual.lucroBruto)}</div>
          <div className="kpi-sub">Receita − Custos</div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-title">Receita × Custo × Despesa (Mensal)</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={mensal} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 11, fontFamily: "JetBrains Mono" }} />
              <YAxis tick={{ fill: CHART.tick, fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "JetBrains Mono" }} />
              <Bar dataKey="Receita" fill={CHART.receita} radius={[4,4,0,0]} />
              <Bar dataKey="Custo" fill={CHART.custo} radius={[4,4,0,0]} />
              <Bar dataKey="Despesas" fill={CHART.despesas} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="card-title">Lucro Líquido Mensal</div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={mensal} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="lucroGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART.lucro} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART.lucro} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 11, fontFamily: "JetBrains Mono" }} />
              <YAxis tick={{ fill: CHART.tick, fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Lucro Líquido" stroke={CHART.lucro} fill="url(#lucroGrad)" strokeWidth={2.5} dot={{ fill: CHART.lucro, r: 4, strokeWidth: 2, stroke: "#fff" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Saldos + Pie */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-title">Saldo por Conta</div>
          <div className="saldo-grid" style={{ marginBottom: 0 }}>
            {contas.map((c) => (
              <div key={c.id} className="saldo-card">
                <div className="saldo-tipo">{c.tipo}</div>
                <div className="saldo-nome">{c.nome}</div>
                <div className="saldo-valor">{fmtBRL(getSaldoConta(c.id))}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Composição do Resultado</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmtBRL(v)} contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, fontFamily: "JetBrains Mono", fontSize: 12, boxShadow: "0 4px 16px rgba(15,23,42,0.08)" }} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "DM Mono" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── LANÇAMENTOS ────────────────────────────────────────────────────────────
function Lancamentos({ lancamentos, contas, planoContas, onAdd, onEdit, onDelete, search, setSearch, tipoFilter, setTipoFilter, filterPeriodo, setFilterPeriodo }) {
  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="period-selector">
            <select value={filterPeriodo.ano} onChange={(e) => setFilterPeriodo((p) => ({ ...p, ano: e.target.value }))}>
              {["2022","2023","2024","2025"].map((y) => <option key={y}>{y}</option>)}
            </select>
            <select value={filterPeriodo.mes} onChange={(e) => setFilterPeriodo((p) => ({ ...p, mes: e.target.value }))}>
              <option value="">Todos</option>
              {MESES.map((m, i) => <option key={m} value={(i+1).toString().padStart(2,"0")}>{m}</option>)}
            </select>
          </div>
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input className="search-input" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={onAdd}>+ Novo Lançamento</button>
        </div>
      </div>

      <div className="filter-bar">
        {["Todos","Entrada","Saida","Transferencia"].map((t) => (
          <div key={t} className={`filter-chip${tipoFilter === t ? " active" : ""}`} onClick={() => setTipoFilter(t)}>{t}</div>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lote</th>
                <th>Data</th>
                <th>Conta</th>
                <th>Plano</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Histórico</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state"><div className="empty-icon">◯</div><div className="empty-text">Nenhum lançamento encontrado</div></div></td></tr>
              )}
              {lancamentos.map((l) => {
                const conta = contas.find((c) => c.id === (l.contaEntradaId || l.contaSaidaId));
                const plano = planoContas.find((p) => p.id === l.planoId);
                return (
                  <tr key={l.id}>
                    <td className="td-mono" style={{ fontSize: 12, color: "var(--text3)" }}>{l.lote}</td>
                    <td className="td-mono">{new Date(l.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                    <td>{conta?.nome || "—"}</td>
                    <td style={{ color: "var(--text2)", fontSize: 12 }}>{plano?.descricao || "—"}</td>
                    <td>
                      <span className={`badge ${l.tipo === "Entrada" ? "badge-green" : l.tipo === "Saida" ? "badge-red" : "badge-blue"}`}>{l.tipo}</span>
                    </td>
                    <td className={l.tipo === "Entrada" ? "td-green" : "td-red"}>{fmtBRL(l.valor)}</td>
                    <td style={{ color: "var(--text2)", fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.historico}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => onEdit(l)} title="Editar">✎</button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => { if (confirm("Excluir este lançamento?")) onDelete(l.id); }} title="Excluir">✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 20, fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text2)" }}>
          <span>{lancamentos.length} registros</span>
          <span style={{ color: "var(--accent)" }}>Entradas: {fmtBRL(lancamentos.filter(l=>l.tipo==="Entrada").reduce((s,l)=>s+l.valor,0))}</span>
          <span style={{ color: "var(--danger)" }}>Saídas: {fmtBRL(lancamentos.filter(l=>l.tipo==="Saida").reduce((s,l)=>s+l.valor,0))}</span>
        </div>
      </div>
    </div>
  );
}

// ─── DRE ────────────────────────────────────────────────────────────────────
function DRE({ dreAtual, planoContas, lancamentos, getDRE, filterPeriodo, setFilterPeriodo }) {
  const receitas = planoContas.filter((p) => p.tipo === "Receita");
  const custos = planoContas.filter((p) => p.tipo === "Custo");
  const despesas = planoContas.filter((p) => p.tipo === "Despesa");

  const Row = ({ pc, isTotal, indent }) => {
    const v = dreAtual.resultado?.[pc.id];
    if (!v && !isTotal) return null;
    const val = pc.tipo === "Receita" ? v?.entradas : v?.saidas;
    if (!val || val === 0) return null;
    return (
      <tr style={indent ? {} : {}}>
        <td style={{ paddingLeft: indent ? 32 : 16, color: "var(--text2)", fontSize: 12 }}>{pc.codigo}</td>
        <td>{pc.descricao}</td>
        <td className={pc.tipo === "Receita" ? "td-green td-mono" : "td-red td-mono"}>{fmtBRL(val)}</td>
        <td></td>
      </tr>
    );
  };

  const dreData = MESES.map((m, i) => {
    const mes = (i+1).toString().padStart(2,"0");
    const d = getDRE(filterPeriodo.ano, mes);
    return { name: m, Receita: d.receitas, "Lucro Bruto": d.lucroBruto, "Lucro Líquido": d.lucroLiquido };
  });

  return (
    <div>
      <div className="toolbar">
        <div className="period-selector">
          <span style={{ color: "var(--text2)", fontSize: 13 }}>Período:</span>
          <select value={filterPeriodo.ano} onChange={(e) => setFilterPeriodo((p) => ({...p, ano: e.target.value}))}>
            {["2022","2023","2024","2025"].map((y) => <option key={y}>{y}</option>)}
          </select>
          <select value={filterPeriodo.mes} onChange={(e) => setFilterPeriodo((p) => ({...p, mes: e.target.value}))}>
            <option value="">Acumulado</option>
            {MESES.map((m, i) => <option key={m} value={(i+1).toString().padStart(2,"0")}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="charts-grid" style={{ marginBottom: 24 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>
              D.R.E. — {filterPeriodo.mes ? MESES[parseInt(filterPeriodo.mes)-1] : "Acumulado"} {filterPeriodo.ano}
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Código</th><th>Conta</th><th>Valor</th><th></th></tr></thead>
              <tbody>
                <tr style={{ background: "rgba(16, 185, 129, 0.06)" }}>
                  <td colSpan={4} style={{ padding: "10px 16px", fontWeight: 600, color: "var(--accent)", fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>RECEITAS</td>
                </tr>
                {receitas.map((pc) => <Row key={pc.id} pc={pc} indent />)}
                <tr className="dre-total">
                  <td colSpan={2} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>Total Receitas</td>
                  <td className="td-green td-mono">{fmtBRL(dreAtual.receitas)}</td>
                  <td></td>
                </tr>

                <tr style={{ background: "rgba(244, 63, 94, 0.05)" }}>
                  <td colSpan={4} style={{ padding: "10px 16px", fontWeight: 600, color: "var(--danger)", fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>(-) CUSTOS</td>
                </tr>
                {custos.map((pc) => <Row key={pc.id} pc={pc} indent />)}
                <tr className="dre-total">
                  <td colSpan={2} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>Total Custos</td>
                  <td className="td-red td-mono">{fmtBRL(dreAtual.custos)}</td>
                  <td></td>
                </tr>

                <tr style={{ background: "rgba(59, 130, 246, 0.06)", borderTop: "2px solid var(--border-light)" }}>
                  <td colSpan={2} style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13 }}>= LUCRO BRUTO</td>
                  <td className={`td-mono`} style={{ fontWeight: 700, fontSize: 15, color: dreAtual.lucroBruto >= 0 ? "var(--accent)" : "var(--danger)" }}>{fmtBRL(dreAtual.lucroBruto)}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text3)" }}>{fmtPct(dreAtual.receitas > 0 ? dreAtual.lucroBruto/dreAtual.receitas : 0)}</td>
                </tr>

                <tr style={{ background: "rgba(249, 115, 22, 0.05)" }}>
                  <td colSpan={4} style={{ padding: "10px 16px", fontWeight: 600, color: "var(--accent2)", fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>(-) DESPESAS</td>
                </tr>
                {despesas.map((pc) => <Row key={pc.id} pc={pc} indent />)}
                <tr className="dre-total">
                  <td colSpan={2} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>Total Despesas</td>
                  <td className="td-amber td-mono">{fmtBRL(dreAtual.despesas)}</td>
                  <td></td>
                </tr>

                <tr style={{ background: dreAtual.lucroLiquido >= 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(244, 63, 94, 0.08)", borderTop: "2px solid var(--border-light)" }}>
                  <td colSpan={2} style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14 }}>= LUCRO LÍQUIDO</td>
                  <td className="td-mono" style={{ fontWeight: 700, fontSize: 18, color: dreAtual.lucroLiquido >= 0 ? "var(--accent)" : "var(--danger)" }}>{fmtBRL(dreAtual.lucroLiquido)}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text2)", fontWeight: 700 }}>{fmtPct(dreAtual.lucroPct)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Evolução Anual {filterPeriodo.ano}</div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={dreData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 11, fontFamily: "JetBrains Mono" }} />
              <YAxis tick={{ fill: CHART.tick, fontSize: 10 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "JetBrains Mono" }} />
              <Bar dataKey="Receita" fill={`${CHART.receita}40`} stroke={CHART.receita} strokeWidth={1} radius={[4,4,0,0]} />
              <Line type="monotone" dataKey="Lucro Bruto" stroke={CHART.lucroBruto} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Lucro Líquido" stroke={CHART.lucro} strokeWidth={2.5} dot={{ r: 4, fill: CHART.lucro, strokeWidth: 2, stroke: "#fff" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── CONTAS ──────────────────────────────────────────────────────────────────
function Contas({ contas, getSaldoConta, getSaldoTotal, onAdd, onEdit, onDelete }) {
  return (
    <div>
      <div className="toolbar">
        <div />
        <button className="btn btn-primary" onClick={onAdd}>+ Nova Conta</button>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card" style={{"--kpi-color": "var(--accent3)"}}>
          <div className="kpi-label">Saldo Total</div>
          <div className="kpi-value">{fmtBRL(getSaldoTotal())}</div>
          <div className="kpi-sub">{contas.length} contas</div>
        </div>
        {contas.slice(0, 4).map((c) => (
          <div key={c.id} className="kpi-card" style={{"--kpi-color": c.tipo === "Banco" ? "var(--accent3)" : "var(--accent2)"}}>
            <div className="kpi-label">{c.tipo}</div>
            <div className="kpi-value">{fmtBRL(getSaldoConta(c.id))}</div>
            <div className="kpi-sub">{c.nome}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Saldo Inicial</th>
                <th>Saldo Atual</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contas.map((c) => (
                <tr key={c.id}>
                  <td className="td-mono">{c.codigo}</td>
                  <td>{c.nome}</td>
                  <td><span className={`badge ${c.tipo === "Banco" ? "badge-blue" : "badge-amber"}`}>{c.tipo}</span></td>
                  <td className="td-mono">{fmtBRL(c.saldoInicial)}</td>
                  <td className="td-green">{fmtBRL(getSaldoConta(c.id))}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => onEdit(c)}>✎</button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => { if (confirm("Excluir conta?")) onDelete(c.id); }}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── PLANO DE CONTAS ─────────────────────────────────────────────────────────
function PlanoContas({ planoContas, onAdd, onEdit, onDelete }) {
  return (
    <div>
      <div className="toolbar">
        <div className="tabs">
          {["Receita","Custo","Despesa"].map((t) => (
            <span key={t} style={{ padding: "6px 14px", fontSize: 12, fontFamily: "var(--font-mono)", color: t === "Receita" ? "var(--accent)" : t === "Custo" ? "var(--danger)" : "var(--accent2)" }}>{t}</span>
          ))}
        </div>
        <button className="btn btn-primary" onClick={onAdd}>+ Nova Conta</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Código</th><th>Classificação</th><th>Descrição</th><th>Tipo</th><th></th></tr>
            </thead>
            <tbody>
              {planoContas.map((pc) => (
                <tr key={pc.id}>
                  <td className="td-mono" style={{ fontSize: 12 }}>{pc.codigo}</td>
                  <td style={{ color: "var(--text2)", fontSize: 12 }}>{pc.classificacao}</td>
                  <td>{pc.descricao}</td>
                  <td>
                    <span className={`badge ${pc.tipo === "Receita" ? "badge-green" : pc.tipo === "Custo" ? "badge-red" : "badge-amber"}`}>{pc.tipo}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => onEdit(pc)}>✎</button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => { if (confirm("Excluir?")) onDelete(pc.id); }}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL LANÇAMENTO ────────────────────────────────────────────────────────
function ModalLancamento({ item, contas, planoContas, onClose, onSave }) {
  const [form, setForm] = useState({
    lote: item?.lote || "",
    data: item?.data || new Date().toISOString().slice(0, 10),
    tipo: item?.tipo || "Entrada",
    contaEntradaId: item?.contaEntradaId || "",
    contaSaidaId: item?.contaSaidaId || "",
    planoId: item?.planoId || "",
    valor: item?.valor || "",
    historico: item?.historico || "",
    exportado: item?.exportado || false,
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.data || !form.valor || !form.planoId) return alert("Preencha todos os campos obrigatórios.");
    onSave({ ...form, valor: parseFloat(form.valor) });
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{item ? "Editar Lançamento" : "Novo Lançamento"}</span>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Lote</label>
              <input className="form-input" value={form.lote} onChange={(e) => set("lote", e.target.value)} placeholder="L001" />
            </div>
            <div className="form-group">
              <label className="form-label">Data *</label>
              <input className="form-input" type="date" value={form.data} onChange={(e) => set("data", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo *</label>
              <select className="form-select" value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
                <option>Entrada</option>
                <option>Saida</option>
                <option>Transferencia</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Valor *</label>
              <input className="form-input" type="number" step="0.01" value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" />
            </div>
          </div>
          <div className="form-grid" style={{ marginTop: 12 }}>
            {(form.tipo === "Entrada" || form.tipo === "Transferencia") && (
              <div className="form-group">
                <label className="form-label">Conta Entrada</label>
                <select className="form-select" value={form.contaEntradaId} onChange={(e) => set("contaEntradaId", e.target.value)}>
                  <option value="">— Selecione —</option>
                  {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
            {(form.tipo === "Saida" || form.tipo === "Transferencia") && (
              <div className="form-group">
                <label className="form-label">Conta Saída</label>
                <select className="form-select" value={form.contaSaidaId} onChange={(e) => set("contaSaidaId", e.target.value)}>
                  <option value="">— Selecione —</option>
                  {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Plano de Contas *</label>
              <select className="form-select" value={form.planoId} onChange={(e) => set("planoId", e.target.value)}>
                <option value="">— Selecione —</option>
                {planoContas.map((p) => <option key={p.id} value={p.id}>[{p.tipo}] {p.descricao}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">Histórico</label>
            <textarea className="form-textarea" value={form.historico} onChange={(e) => set("historico", e.target.value)} placeholder="Descrição do lançamento..." />
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="exportado" checked={form.exportado} onChange={(e) => set("exportado", e.target.checked)} />
            <label htmlFor="exportado" style={{ fontSize: 13, color: "var(--text2)", cursor: "pointer" }}>Exportado para Domínio</label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL CONTA ─────────────────────────────────────────────────────────────
function ModalConta({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    codigo: item?.codigo || "",
    nome: item?.nome || "",
    tipo: item?.tipo || "Banco",
    saldoInicial: item?.saldoInicial || 0,
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <span className="modal-title">{item ? "Editar Conta" : "Nova Conta"}</span>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Código</label>
              <input className="form-input" type="number" value={form.codigo} onChange={(e) => set("codigo", parseInt(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
                <option>Banco</option><option>Caixa</option><option>Outros</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: "1/-1" }}>
              <label className="form-label">Nome</label>
              <input className="form-input" value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Saldo Inicial</label>
              <input className="form-input" type="number" step="0.01" value={form.saldoInicial} onChange={(e) => set("saldoInicial", parseFloat(e.target.value))} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL PLANO ─────────────────────────────────────────────────────────────
function ModalPlano({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    codigo: item?.codigo || "",
    classificacao: item?.classificacao || "RECEITA",
    descricao: item?.descricao || "",
    tipo: item?.tipo || "Receita",
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <span className="modal-title">{item ? "Editar Conta" : "Nova Conta"}</span>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Código</label>
              <input className="form-input" value={form.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="1.1.001" />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={form.tipo} onChange={(e) => { set("tipo", e.target.value); set("classificacao", e.target.value.toUpperCase()); }}>
                <option>Receita</option><option>Custo</option><option>Despesa</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: "1/-1" }}>
              <label className="form-label">Descrição</label>
              <input className="form-input" value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
            </div>
            <div className="form-group" style={{ gridColumn: "1/-1" }}>
              <label className="form-label">Classificação</label>
              <input className="form-input" value={form.classificacao} onChange={(e) => set("classificacao", e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>Salvar</button>
        </div>
      </div>
    </div>
  );
}
