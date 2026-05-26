/**
 * DashboardPFV2Page — Dashboard Premium (Pessoa Física)
 *
 * ISOLAMENTO TOTAL: arquivo novo. Nenhum arquivo existente alterado.
 * Rollback: remover import em GestorApp.jsx e restaurar DashboardPFPage no PAGE_MAP_PF.
 *
 * Dados reutilizados (mesmos do DashboardPFPage original):
 *  - dreAtual.receitas / dreAtual.despesas
 *  - mensal: [{ name, Receita, Despesas }] (12 meses)
 *  - contas, getSaldoConta, getSaldoTotal
 *  - lancamentos + planoContas → pie de categorias
 *  - filterPeriodo / setFilterPeriodo
 */
import { useMemo, memo } from "react";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useGestor }        from "../GestorContext.jsx";
import { useRecorrencias }  from "../hooks/useRecorrencias.js";
import { fmtBRL }           from "../finance.js";
import { MESES, CHART }     from "../constants.js";
import RecorrenciaAlert     from "../components/RecorrenciaAlert.jsx";
import ContasAPagarAlert   from "../components/ContasAPagarAlert.jsx";
import KpiCardV2            from "../components/dashboard/KpiCardV2.jsx";
import ChartCardV2          from "../components/dashboard/ChartCardV2.jsx";
import ContasWidget         from "../components/dashboard/ContasWidget.jsx";
import CustomTooltip        from "../components/CustomTooltip.jsx";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const hojeStr = () => new Date().toISOString().slice(0, 10);
const em7Str  = () => new Date(Date.now() +  7 * 86_400_000).toISOString().slice(0, 10);
const em30Str = () => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

const fmtK = (v) => {
  const n = Math.abs(v);
  if (n >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
};

const PIE_COLORS = [
  CHART.despesas, CHART.custo, CHART.pie[2],
  CHART.pie[3], CHART.pie[4], CHART.pie[1],
];

// ─── Period Toolbar (hero escuro) ─────────────────────────────────────────────

function PeriodToolbar() {
  const { filterPeriodo, setFilterPeriodo } = useGestor();
  return (
    <div className="dash-hero-toolbar">
      <div className="dash-hero-label">💼 Finanças Pessoais</div>
      <div className="period-selector">
        <span>Período:</span>
        <select
          value={filterPeriodo.ano}
          onChange={(e) => setFilterPeriodo((p) => ({ ...p, ano: e.target.value }))}
        >
          {["2023", "2024", "2025", "2026", "2027"].map((y) => <option key={y}>{y}</option>)}
        </select>
        <select
          value={filterPeriodo.mes}
          onChange={(e) => setFilterPeriodo((p) => ({ ...p, mes: e.target.value }))}
        >
          <option value="">Todos os meses</option>
          {MESES.map((m, i) => (
            <option key={m} value={(i + 1).toString().padStart(2, "0")}>{m}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── Legenda customizada para Pie ─────────────────────────────────────────────

const PieLegend = memo(function PieLegend({ payload }) {
  if (!payload?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8, fontSize: 11 }}>
      {payload.map((p) => (
        <div key={p.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: p.color, display: "inline-block", flexShrink: 0,
          }} />
          <span style={{
            color: "var(--muted-foreground)",
            maxWidth: 100, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }} title={p.value}>
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
});

// ─── Página principal ────────────────────────────────────────────────────────

export default function DashboardPFV2Page() {
  const {
    dreAtual, mensal, contas, planoContas, lancamentos,
    getSaldoConta, getSaldoTotal,
    filterPeriodo,
  } = useGestor();

  const { recorrencias, loading: recLoading } = useRecorrencias();

  // ── Cálculos ───────────────────────────────────────────────────────────────

  const saldoTotal = useMemo(() => getSaldoTotal(), [getSaldoTotal]);
  const saldoMes   = dreAtual.receitas - dreAtual.despesas;

  const recProximas = useMemo(() => {
    if (!recorrencias.length) return [];
    const limite = em7Str();
    return recorrencias.filter((r) => r.status === "ativa" && r.proxima_data <= limite);
  }, [recorrencias]);

  const fluxoPrevisto = useMemo(() => {
    if (!recorrencias.length) return 0;
    const hoje  = hojeStr();
    const limite = em30Str();
    return recorrencias
      .filter((r) => r.status === "ativa" && r.proxima_data >= hoje && r.proxima_data <= limite)
      .reduce(
        (acc, r) => acc + (r.tipo === "Receita" ? parseFloat(r.valor) : -parseFloat(r.valor)),
        0
      );
  }, [recorrencias]);

  // Dados para o gráfico bar (usa a mesma forma do DashboardPFPage original)
  const mensalData = useMemo(
    () => mensal.map((m) => ({ name: m.name, Receitas: m.Receita, Despesas: m.Despesas })),
    [mensal]
  );

  // Despesas por categoria (top 6 no período)
  const categoriasData = useMemo(() => {
    const h = {};
    for (const l of lancamentos) {
      const d = new Date(l.data + "T00:00:00");
      if (filterPeriodo.ano && d.getFullYear().toString() !== filterPeriodo.ano) continue;
      if (filterPeriodo.mes && (d.getMonth() + 1).toString().padStart(2, "0") !== filterPeriodo.mes) continue;

      const plano = planoContas.find((p) => p.id === l.planoId);
      if (!plano || plano.tipo === "Receita") continue;

      h[plano.descricao] = (h[plano.descricao] || 0) + l.valor;
    }
    return Object.entries(h)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [lancamentos, planoContas, filterPeriodo]);

  // ── KPIs ───────────────────────────────────────────────────────────────────

  const kpis = [
    {
      icon: "↑",
      label: "Receitas",
      value: fmtBRL(dreAtual.receitas),
      sub: "Entradas no período",
      valueClass: "success",
    },
    {
      icon: "↓",
      label: "Despesas",
      value: fmtBRL(dreAtual.despesas),
      sub: "Gastos no período",
      valueClass: dreAtual.despesas > dreAtual.receitas ? "danger" : "",
    },
    {
      icon: "◎",
      label: "Saldo do Período",
      value: fmtBRL(saldoMes),
      sub: saldoMes >= 0 ? "Sobrou no mês" : "Déficit no mês",
      valueClass: saldoMes >= 0 ? "success" : "danger",
      trend: saldoMes >= 0
        ? { dir: "up",   label: "Período positivo" }
        : { dir: "down", label: "Período negativo" },
    },
    {
      icon: "💰",
      label: "Saldo Total",
      value: fmtBRL(saldoTotal),
      sub: `${contas.filter((c) => !c.inativo).length} conta${contas.filter((c) => !c.inativo).length !== 1 ? "s" : ""}`,
      valueClass: saldoTotal >= 0 ? "success" : "danger",
    },
    {
      icon: "↺",
      label: "Recorrências",
      value: recLoading ? "—" : recProximas.length.toString(),
      sub: recLoading ? "Carregando…" : recProximas.length > 0 ? "Vencendo em 7 dias" : "Em dia",
      valueClass: recProximas.length > 0 ? "warning" : "",
    },
    {
      icon: "⌛",
      label: "Fluxo Previsto (30d)",
      value: recLoading ? "—" : fmtBRL(fluxoPrevisto),
      sub: "Recorrências ativas",
      valueClass: fluxoPrevisto >= 0 ? "success" : "danger",
    },
  ];

  return (
    <div className="dash-v2-root">

      {/* ── Hero escuro ───────────────────────────────────────────────────── */}
      <div className="dash-hero">
        <PeriodToolbar />
        <div className="kpi-v2-grid">
          {kpis.map((k, i) => (
            <KpiCardV2 key={k.label} {...k} delay={i * 60} />
          ))}
        </div>
      </div>

      {/* ── Seção clara ───────────────────────────────────────────────────── */}
      <div className="dash-section">

        <RecorrenciaAlert />
        <ContasAPagarAlert />

        <div className="dash-section-title">Evolução Mensal</div>
        <div className="dash-charts-grid" style={{ marginBottom: 16 }}>

          {/* Bar: Receitas vs Despesas */}
          <ChartCardV2
            title="Receitas × Despesas"
            sub={`Ano ${filterPeriodo.ano}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mensalData} barCategoryGap="28%" barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: CHART.tick, fontSize: 10 }} tickFormatter={fmtK} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="Receitas" fill={CHART.receita}  radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="Despesas" fill={CHART.despesas} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCardV2>

          {/* Area: Tendência de saldo */}
          <ChartCardV2
            title="Tendência de Resultado"
            sub={`Receitas vs Despesas em ${filterPeriodo.ano}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mensalData}>
                <defs>
                  <linearGradient id="recPFGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={CHART.receita} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART.receita} stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="despPFGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={CHART.despesas} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={CHART.despesas} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: CHART.tick, fontSize: 10 }} tickFormatter={fmtK} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Receitas" stroke={CHART.receita}  fill="url(#recPFGrad)"  strokeWidth={2}   dot={false} />
                <Area type="monotone" dataKey="Despesas" stroke={CHART.despesas} fill="url(#despPFGrad)" strokeWidth={2}   dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCardV2>
        </div>

        {/* Linha 2: Categorias + Contas */}
        <div className="dash-section-title">Composição</div>
        <div className="dash-charts-grid">

          {/* Pie: Gastos por categoria */}
          <ChartCardV2
            title="Gastos por Categoria"
            sub={filterPeriodo.mes
              ? `${MESES[parseInt(filterPeriodo.mes) - 1]} / ${filterPeriodo.ano}`
              : `Ano ${filterPeriodo.ano}`}
            height={270}
          >
            {categoriasData.length === 0 ? (
              <div className="chart-card-v2-empty">
                <span style={{ fontSize: 32 }}>📂</span>
                <span>Nenhuma despesa categorizada</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoriasData}
                    cx="50%"
                    cy="42%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoriasData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtBRL(v)} />
                  <Legend content={<PieLegend />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCardV2>

          {/* Contas */}
          <ContasWidget contas={contas} getSaldoConta={getSaldoConta} />
        </div>
      </div>
    </div>
  );
}
