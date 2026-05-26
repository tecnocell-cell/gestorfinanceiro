/**
 * DashboardV2Page — Dashboard Premium (Pessoa Jurídica)
 *
 * ISOLAMENTO TOTAL: este arquivo é novo. Nenhum arquivo existente foi alterado.
 * Rollback: remover import em GestorApp.jsx e restaurar DashboardPage no PAGE_MAP_PJ.
 *
 * Dados reutilizados do GestorContext (sem recalcular nada):
 *  - dreAtual      → receitas, custos, despesas, impostos, lucroLiquido, lucroAposImpostos
 *  - mensal        → array 12 meses: { name, Receita, Custo, Despesas, "Lucro Líquido" }
 *  - contas        → lista de contas
 *  - lancamentos   → para pie de categorias
 *  - planoContas   → para nomes de categorias
 *  - getSaldoConta → saldo por conta
 *  - getSaldoTotal → saldo total
 *  - filterPeriodo / setFilterPeriodo
 *
 * Adicionado: useRecorrencias (próximas + fluxo previsto 30 dias)
 */
import { useMemo, memo } from "react";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useGestor }        from "../GestorContext.jsx";
import { useRecorrencias }  from "../hooks/useRecorrencias.js";
import { fmtBRL, fmtPct }  from "../finance.js";
import { MESES, CHART }     from "../constants.js";
import RecorrenciaAlert     from "../components/RecorrenciaAlert.jsx";
import ContasAPagarAlert   from "../components/ContasAPagarAlert.jsx";
import KpiCardV2            from "../components/dashboard/KpiCardV2.jsx";
import ChartCardV2          from "../components/dashboard/ChartCardV2.jsx";
import ContasWidget         from "../components/dashboard/ContasWidget.jsx";
import CustomTooltip        from "../components/CustomTooltip.jsx";

// ─── Helpers locais ───────────────────────────────────────────────────────────

const hojeStr   = () => new Date().toISOString().slice(0, 10);
const em7Str    = () => new Date(Date.now() +  7 * 86_400_000).toISOString().slice(0, 10);
const em30Str   = () => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

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

// ─── Period Toolbar (estilo hero escuro) ──────────────────────────────────────

function PeriodToolbar() {
  const { filterPeriodo, setFilterPeriodo } = useGestor();
  return (
    <div className="dash-hero-toolbar">
      <div className="dash-hero-label">📊 Visão Geral</div>
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

// ─── Legenda customizada para o Pie (aceita icone via categoriasData) ────────

const PieLegend = memo(function PieLegend({ payload, categoriasData }) {
  if (!payload?.length) return null;
  const iconeMap = Object.fromEntries((categoriasData || []).map((c) => [c.name, c.icone]));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8, fontSize: 11 }}>
      {payload.map((p) => (
        <div key={p.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: "var(--muted-foreground)", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={p.value}>
            {iconeMap[p.value] ? `${iconeMap[p.value]} ` : ""}{p.value}
          </span>
        </div>
      ))}
    </div>
  );
});

// ─── Página principal ────────────────────────────────────────────────────────

export default function DashboardV2Page() {
  const {
    dreAtual, mensal, contas, planoContas, lancamentos,
    getSaldoConta, getSaldoTotal,
    filterPeriodo,
  } = useGestor();

  // Recorrências — silencioso se falhar (hook trata internamente)
  const { recorrencias, loading: recLoading } = useRecorrencias();

  // ── Cálculos derivados (todos memoizados) ──────────────────────────────────

  const saldoTotal  = useMemo(() => getSaldoTotal(), [getSaldoTotal]);
  const lucroLiq    = dreAtual.lucroAposImpostos ?? dreAtual.lucroLiquido;
  const margem      = dreAtual.receitas > 0 ? (lucroLiq / dreAtual.receitas) : 0;

  // Recorrências vencendo em 7 dias
  const recProximas = useMemo(() => {
    if (!recorrencias.length) return [];
    const limite = em7Str();
    return recorrencias.filter((r) => r.status === "ativa" && r.proxima_data <= limite);
  }, [recorrencias]);

  // Fluxo previsto nos próximos 30 dias (receitas - despesas de recorrências ativas)
  const fluxoPrevisto = useMemo(() => {
    if (!recorrencias.length) return 0;
    const hoje = hojeStr();
    const limite = em30Str();
    return recorrencias
      .filter((r) => r.status === "ativa" && r.proxima_data >= hoje && r.proxima_data <= limite)
      .reduce(
        (acc, r) => acc + (r.tipo === "Receita" ? parseFloat(r.valor) : -parseFloat(r.valor)),
        0
      );
  }, [recorrencias]);

  // Despesas por categoria (top 6 no período) — inclui cor e ícone da categoria
  const categoriasData = useMemo(() => {
    const h = {};
    const meta = {}; // name → { fill, icone }
    for (const l of lancamentos) {
      const d = new Date(l.data + "T00:00:00");
      if (filterPeriodo.ano && d.getFullYear().toString() !== filterPeriodo.ano) continue;
      if (filterPeriodo.mes && (d.getMonth() + 1).toString().padStart(2, "0") !== filterPeriodo.mes) continue;

      const plano = planoContas.find((p) => p.id === l.planoId);
      if (!plano || plano.tipo === "Receita") continue;

      const nome = plano.descricao;
      h[nome] = (h[nome] || 0) + l.valor;
      if (!meta[nome]) meta[nome] = { fill: plano.cor, icone: plano.icone };
    }
    return Object.entries(h)
      .map(([name, value]) => ({ name, value, ...meta[name] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [lancamentos, planoContas, filterPeriodo]);

  // ── KPI configs ────────────────────────────────────────────────────────────

  const kpis = [
    {
      icon: "💰",
      label: "Saldo Total",
      value: fmtBRL(saldoTotal),
      sub: `${contas.filter((c) => !c.inativo).length} conta${contas.filter((c) => !c.inativo).length !== 1 ? "s" : ""}`,
      valueClass: saldoTotal >= 0 ? "success" : "danger",
    },
    {
      icon: "↑",
      label: "Receitas",
      value: fmtBRL(dreAtual.receitas),
      sub: "Entradas no período",
      valueClass: "success",
    },
    {
      icon: "↓",
      label: "Custos + Despesas",
      value: fmtBRL(dreAtual.custos + dreAtual.despesas),
      sub: `Impostos: ${fmtBRL(dreAtual.impostos)}`,
      valueClass: "danger",
    },
    {
      icon: "◎",
      label: "Lucro Líquido",
      value: fmtBRL(lucroLiq),
      sub: `Margem: ${fmtPct(margem)}`,
      valueClass: lucroLiq >= 0 ? "success" : "danger",
      trend: lucroLiq >= 0
        ? { dir: "up",   label: `${fmtPct(Math.abs(margem))} de margem` }
        : { dir: "down", label: "Resultado negativo" },
    },
    {
      icon: "↺",
      label: "Recorrências",
      value: recLoading ? "—" : recProximas.length.toString(),
      sub: recLoading ? "Carregando…" : recProximas.length > 0 ? "Vencendo em 7 dias" : "Nenhuma vencendo",
      valueClass: recProximas.length > 0 ? "warning" : "",
    },
    {
      icon: "⌛",
      label: "Fluxo Previsto (30d)",
      value: recLoading ? "—" : fmtBRL(fluxoPrevisto),
      sub: "Com base nas recorrências ativas",
      valueClass: fluxoPrevisto >= 0 ? "success" : "danger",
    },
  ];

  return (
    <div className="dash-v2-root">

      {/* ── Hero escuro com KPIs ─────────────────────────────────────────── */}
      <div className="dash-hero">
        <PeriodToolbar />
        <div className="kpi-v2-grid">
          {kpis.map((k, i) => (
            <KpiCardV2
              key={k.label}
              {...k}
              delay={i * 60}
              loading={false}
            />
          ))}
        </div>
      </div>

      {/* ── Seção clara: alerta + gráficos ──────────────────────────────── */}
      <div className="dash-section">

        {/* Alerts — silenciosos se não houver nada */}
        <RecorrenciaAlert />
        <ContasAPagarAlert />

        {/* Gráficos linha 1 */}
        <div className="dash-section-title">Desempenho Mensal</div>
        <div className="dash-charts-grid" style={{ marginBottom: 16 }}>

          {/* Bar: Receita vs Custos vs Despesas */}
          <ChartCardV2
            title="Receitas × Custos × Despesas"
            sub={`Ano ${filterPeriodo.ano}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mensal} barCategoryGap="28%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: CHART.tick, fontSize: 10 }} tickFormatter={fmtK} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="Receita"  fill={CHART.receita}  radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="Custo"    fill={CHART.custo}    radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="Despesas" fill={CHART.despesas} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCardV2>

          {/* Area: Lucro Líquido */}
          <ChartCardV2
            title="Tendência do Lucro Líquido"
            sub={`Evolução em ${filterPeriodo.ano}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mensal}>
                <defs>
                  <linearGradient id="lucroGradV2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={CHART.lucro} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART.lucro} stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="receitaGradV2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={CHART.receita} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={CHART.receita} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: CHART.tick, fontSize: 10 }} tickFormatter={fmtK} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Receita"
                  stroke={CHART.receita}
                  fill="url(#receitaGradV2)"
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="4 2"
                />
                <Area
                  type="monotone"
                  dataKey="Lucro Líquido"
                  stroke={CHART.lucro}
                  fill="url(#lucroGradV2)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: CHART.lucro, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCardV2>
        </div>

        {/* Gráficos linha 2 */}
        <div className="dash-section-title">Composição</div>
        <div className="dash-charts-grid">

          {/* Pie: Despesas por categoria */}
          <ChartCardV2
            title="Despesas por Categoria"
            sub={filterPeriodo.mes
              ? `${MESES[parseInt(filterPeriodo.mes) - 1]} / ${filterPeriodo.ano}`
              : `Ano ${filterPeriodo.ano}`}
            height={270}
          >
            {categoriasData.length === 0 ? (
              <div className="chart-card-v2-empty">
                <span style={{ fontSize: 32 }}>📂</span>
                <span>Nenhuma despesa categorizada no período</span>
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
                    {categoriasData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtBRL(v)} />
                  <Legend content={(props) => <PieLegend {...props} categoriasData={categoriasData} />} />
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
