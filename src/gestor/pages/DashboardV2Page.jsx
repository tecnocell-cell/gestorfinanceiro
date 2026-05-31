/**
 * DashboardV2Page — Dashboard Premium (Pessoa Jurídica)
 *
 * Etapa 4: layout reestruturado
 *  - KPIs compactos (modo `compact` do KpiCardV2)
 *  - Gráfico hero Receitas × Despesas (12 meses) com gradientes e linha de saldo
 *  - Widgets de Últimos lançamentos e Próximos vencimentos
 *  - Estados vazios elegantes
 *
 * Sem alterações em backend, API, banco, autenticação ou fórmulas financeiras.
 * Apenas reutiliza dados já existentes do GestorContext / useRecorrencias.
 */
import { useMemo, memo } from "react";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, Label,
} from "recharts";
import { useGestor }        from "../GestorContext.jsx";
import { useRecorrencias }  from "../hooks/useRecorrencias.js";
import { fmtBRL, fmtPct }   from "../finance.js";
import { MESES, CHART }     from "../constants.js";
import RecorrenciaAlert     from "../components/RecorrenciaAlert.jsx";
import ContasAPagarAlert    from "../components/ContasAPagarAlert.jsx";
import KpiCardV2            from "../components/dashboard/KpiCardV2.jsx";
import ChartCardV2          from "../components/dashboard/ChartCardV2.jsx";
import ContasWidget         from "../components/dashboard/ContasWidget.jsx";
import DashPeriodToolbar    from "../components/dashboard/DashPeriodToolbar.jsx";
import DashInsight          from "../components/dashboard/DashInsight.jsx";
import HeroChart12m         from "../components/dashboard/HeroChart12m.jsx";
import UltimosLancamentosWidget   from "../components/dashboard/UltimosLancamentosWidget.jsx";
import ProximosVencimentosWidget  from "../components/dashboard/ProximosVencimentosWidget.jsx";
import CustomTooltip        from "../components/CustomTooltip.jsx";
import {
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  Hourglass,
  Repeat,
  Wallet,
  LayoutDashboard,
} from "../components/icons.jsx";

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

  const { recorrencias, loading: recLoading } = useRecorrencias();

  // ── Cálculos derivados (memoizados) ────────────────────────────────────────

  const saldoTotal  = useMemo(() => getSaldoTotal(), [getSaldoTotal]);
  const lucroLiq    = dreAtual.lucroAposImpostos ?? dreAtual.lucroLiquido;
  const margem      = dreAtual.receitas > 0 ? (lucroLiq / dreAtual.receitas) : 0;

  const recProximas = useMemo(() => {
    if (!recorrencias.length) return [];
    const limite = em7Str();
    return recorrencias.filter((r) => r.status === "ativa" && r.proxima_data <= limite);
  }, [recorrencias]);

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

  // Dados do gráfico hero (12 meses, Receitas × Despesas)
  // mensal já vem com { name, Receita, Custo, Despesas, "Lucro Líquido" } — apenas converte schema.
  const hero12m = useMemo(
    () => mensal.map((m) => ({
      name: m.name,
      Receitas: m.Receita || 0,
      Despesas: (m.Custo || 0) + (m.Despesas || 0),
    })),
    [mensal]
  );

  const categoriasData = useMemo(() => {
    const h = {};
    const meta = {};
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

  const sparkReceitas = useMemo(() => mensal.map((m) => m.Receita || 0), [mensal]);
  const sparkDespesas = useMemo(
    () => mensal.map((m) => (m.Custo || 0) + (m.Despesas || 0)),
    [mensal]
  );
  const sparkLucro = useMemo(() => mensal.map((m) => m["Lucro Líquido"] || 0), [mensal]);

  const insight = useMemo(() => {
    if (dreAtual.receitas === 0 && dreAtual.custos === 0 && dreAtual.despesas === 0) {
      return "Sem movimentação no período. Lance receitas e despesas para acompanhar margem e fluxo de caixa.";
    }
    if (lucroLiq < 0) {
      return `Resultado negativo de ${fmtBRL(Math.abs(lucroLiq))} (margem ${fmtPct(margem)}). Revise custos, despesas e impostos do período.`;
    }
    if (recProximas.length > 0) {
      return `${recProximas.length} recorrência(s) nos próximos 7 dias. Confira compromissos em A Pagar/Receber.`;
    }
    return `Operação lucrativa: lucro ${fmtBRL(lucroLiq)} com margem de ${fmtPct(margem)} no período.`;
  }, [dreAtual, lucroLiq, margem, recProximas.length]);

  const kpis = [
    {
      icon: Wallet,
      label: "Saldo Total",
      value: fmtBRL(saldoTotal),
      sub: `${contas.filter((c) => !c.inativo).length} conta${contas.filter((c) => !c.inativo).length !== 1 ? "s" : ""}`,
      valueClass: saldoTotal >= 0 ? "success" : "danger",
      compact: true,
    },
    {
      icon: TrendingUp,
      label: "Receitas",
      value: fmtBRL(dreAtual.receitas),
      sub: "Entradas no período",
      valueClass: "success",
      sparkline: sparkReceitas,
      tone: "success",
      compact: true,
    },
    {
      icon: TrendingDown,
      label: "Custos + Despesas",
      value: fmtBRL(dreAtual.custos + dreAtual.despesas),
      sub: `Impostos: ${fmtBRL(dreAtual.impostos)}`,
      valueClass: "danger",
      sparkline: sparkDespesas,
      tone: "danger",
      compact: true,
    },
    {
      icon: CircleDollarSign,
      label: "Lucro Líquido",
      value: fmtBRL(lucroLiq),
      sub: `Margem: ${fmtPct(margem)}`,
      valueClass: lucroLiq >= 0 ? "success" : "danger",
      sparkline: sparkLucro,
      tone: lucroLiq >= 0 ? "success" : "danger",
      compact: true,
    },
    {
      icon: Repeat,
      label: "Recorrências",
      value: recLoading ? "—" : recProximas.length.toString(),
      sub: recLoading ? "Carregando…" : recProximas.length > 0 ? "Vencendo em 7 dias" : "Nenhuma vencendo",
      valueClass: recProximas.length > 0 ? "warning" : "",
      tone: "warning",
      compact: true,
    },
    {
      icon: Hourglass,
      label: "Fluxo Previsto (30d)",
      value: recLoading ? "—" : fmtBRL(fluxoPrevisto),
      sub: "Com base nas recorrências ativas",
      valueClass: fluxoPrevisto >= 0 ? "success" : "danger",
      tone: fluxoPrevisto >= 0 ? "success" : "danger",
      compact: true,
    },
  ];

  return (
    <div className="dash-v2-root">

      <div className="dash-hero">
        <DashPeriodToolbar
          title="Visão geral"
          subtitle="Indicadores da empresa no período"
          icon={LayoutDashboard}
        />
        <DashInsight
          message={insight}
          tone={lucroLiq < 0 ? "warn" : recProximas.length > 0 ? "info" : "success"}
        />
        <div className="kpi-v2-grid kpi-v2-grid--compact">
          {kpis.map((k) => (
            <KpiCardV2 key={k.label} {...k} />
          ))}
        </div>
      </div>

      {/* ── Hero chart + widgets laterais ──────────────────────────────── */}
      <div className="dash-section">

        <div className="dash-alerts-row">
          <RecorrenciaAlert />
          <ContasAPagarAlert />
        </div>

        <div className="dash-main-grid">
          <div className="dash-main-grid-hero">
            <HeroChart12m
              data={hero12m}
              title="Receitas × Despesas (12 meses)"
              subtitle="Saldo destacado em pontilhado"
            />
          </div>
          <div className="dash-main-grid-side">
            <UltimosLancamentosWidget limit={7} />
          </div>
        </div>

        <div className="dash-widgets-grid">
          <ProximosVencimentosWidget limit={6} />
          <ContasWidget contas={contas} getSaldoConta={getSaldoConta} />
        </div>

        {/* Gráficos detalhados (mantidos da etapa anterior) */}
        <div className="dash-section-title">Desempenho mensal</div>
        <div className="dash-charts-grid dash-charts-grid--featured" style={{ marginBottom: 16 }}>

          <ChartCardV2
            className="dash-chart-featured"
            title="Receitas × Custos × Despesas"
            sub={`Ano ${filterPeriodo.ano} · visão consolidada`}
            height={300}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mensal} barCategoryGap="28%" barGap={2}>
                <CartesianGrid strokeDasharray="4 8" stroke={CHART.grid} strokeOpacity={0.65} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: CHART.tick, fontSize: 10, fontWeight: 500 }} tickFormatter={fmtK} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART.grid, opacity: 0.35 }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10, fontWeight: 500 }} />
                <Bar dataKey="Receita"  fill={CHART.receita}  radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Custo"    fill={CHART.custo}    radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Despesas" fill={CHART.despesas} radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCardV2>

          <ChartCardV2
            title="Tendência do Lucro Líquido"
            sub={`Evolução em ${filterPeriodo.ano}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mensal}>
                <defs>
                  <linearGradient id="lucroGradV2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={CHART.lucro} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={CHART.lucro} stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="receitaGradV2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={CHART.receita} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={CHART.receita} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke={CHART.grid} strokeOpacity={0.65} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: CHART.tick, fontSize: 10, fontWeight: 500 }} tickFormatter={fmtK} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: CHART.grid, strokeWidth: 1, strokeDasharray: "4 4" }} />
                <ReferenceLine y={0} stroke={CHART.tick} strokeOpacity={0.45} strokeDasharray="3 4" />
                <Area
                  type="monotone"
                  dataKey="Receita"
                  stroke={CHART.receita}
                  fill="url(#receitaGradV2)"
                  strokeWidth={2.25}
                  dot={false}
                  strokeDasharray="5 3"
                  strokeOpacity={1}
                />
                <Area
                  type="monotone"
                  dataKey="Lucro Líquido"
                  stroke={CHART.lucro}
                  fill="url(#lucroGradV2)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: CHART.lucro }}
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
                    <Label
                      position="center"
                      content={({ viewBox }) => {
                        const { cx, cy } = viewBox || {};
                        const total = categoriasData.reduce((s, x) => s + x.value, 0);
                        return (
                          <g>
                            <text x={cx} y={cy - 6} textAnchor="middle" className="pie-center-label">Total</text>
                            <text x={cx} y={cy + 12} textAnchor="middle" className="pie-center-value">{fmtK(total)}</text>
                          </g>
                        );
                      }}
                    />
                  </Pie>
                  <Tooltip formatter={(v) => fmtBRL(v)} />
                  <Legend content={(props) => <PieLegend {...props} categoriasData={categoriasData} />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCardV2>

          <ContasWidget contas={contas} getSaldoConta={getSaldoConta} />
        </div>
      </div>
    </div>
  );
}
