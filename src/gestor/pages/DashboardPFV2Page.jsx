/**
 * DashboardPFV2Page — Dashboard Premium (Pessoa Física)
 *
 * Etapa 4: layout reestruturado
 *  - KPIs compactos
 *  - Hero chart Receitas × Despesas (12 meses) com saldo destacado
 *  - Widgets de Últimos lançamentos, Próximos vencimentos e Contas
 *  - Estados vazios elegantes
 *
 * Sem alterações em backend, API, banco, autenticação ou fórmulas financeiras.
 */
import { useMemo, memo } from "react";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, Label,
} from "recharts";
import { useGestor }        from "../GestorContext.jsx";
import { useRecorrencias }  from "../hooks/useRecorrencias.js";
import { fmtBRL }           from "../finance.js";
import { MESES, CHART }     from "../constants.js";
import RecorrenciaAlert     from "../components/RecorrenciaAlert.jsx";
import ContasAPagarAlert    from "../components/ContasAPagarAlert.jsx";
import KpiCardV2            from "../components/dashboard/KpiCardV2.jsx";
import ChartCardV2          from "../components/dashboard/ChartCardV2.jsx";
import ContasWidget         from "../components/dashboard/ContasWidget.jsx";
import DashPeriodToolbar    from "../components/dashboard/DashPeriodToolbar.jsx";
import DashInsight          from "../components/dashboard/DashInsight.jsx";
import HeroChart12m         from "../components/dashboard/HeroChart12m.jsx";
import ResumoInteligente    from "../components/dashboard/ResumoInteligente.jsx";
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
} from "../components/icons.jsx";

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

const safePct = (cur, prev) => {
  if (!Number.isFinite(prev) || prev === 0) return null;
  return (cur - prev) / Math.abs(prev);
};

const PIE_COLORS = [
  CHART.despesas, CHART.custo, CHART.pie[2],
  CHART.pie[3], CHART.pie[4], CHART.pie[1],
];

const PieLegend = memo(function PieLegend({ payload, categoriasData }) {
  if (!payload?.length) return null;
  const iconeMap = Object.fromEntries((categoriasData || []).map((c) => [c.name, c.icone]));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8, fontSize: 11 }}>
      {payload.map((p) => (
        <div key={p.value} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: "var(--muted-foreground)", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.value}>
            {iconeMap[p.value] ? `${iconeMap[p.value]} ` : ""}{p.value}
          </span>
        </div>
      ))}
    </div>
  );
});

export default function DashboardPFV2Page() {
  const {
    contas, planoContas, lancamentos,
    getSaldoConta, getSaldoTotal,
    filterPeriodo,
  } = useGestor();

  const { recorrencias, loading: recLoading } = useRecorrencias();

  const saldoTotal = useMemo(() => getSaldoTotal(), [getSaldoTotal]);

  const pfTotais = useMemo(() => {
    let receitas = 0, despesas = 0;
    for (const l of lancamentos) {
      if (!l.data) continue;
      if (filterPeriodo.ano && !l.data.startsWith(filterPeriodo.ano)) continue;
      if (filterPeriodo.mes && l.data.slice(5, 7) !== filterPeriodo.mes) continue;
      if (l.tipo === "Entrada") receitas += Number(l.valor) || 0;
      else if (l.tipo === "Saida") despesas += Number(l.valor) || 0;
    }
    return { receitas, despesas };
  }, [lancamentos, filterPeriodo]);

  const saldoMes = pfTotais.receitas - pfTotais.despesas;

  const toKey = (v) => {
    if (!v) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
  };

  const recAtivas = useMemo(
    () => recorrencias.filter((r) => r.status === "ativa"),
    [recorrencias]
  );

  const recProximas = useMemo(() => {
    if (!recorrencias.length) return [];
    const limite = em7Str();
    return recAtivas.filter((r) => toKey(r.proxima_data) <= limite);
  }, [recorrencias, recAtivas]);

  const fluxoPrevisto = useMemo(() => {
    if (!recAtivas.length) return 0;
    const limite = em30Str();
    return recAtivas
      .filter((r) => toKey(r.proxima_data) <= limite)
      .reduce(
        (acc, r) => acc + (r.tipo === "Receita" ? parseFloat(r.valor) : -parseFloat(r.valor)),
        0
      );
  }, [recAtivas]);

  const pfMensal = useMemo(() => {
    const totais = Array.from({ length: 12 }, () => ({ rec: 0, desp: 0 }));
    for (const l of lancamentos) {
      if (!l.data) continue;
      if (filterPeriodo.ano && !l.data.startsWith(filterPeriodo.ano)) continue;
      const mesIdx = parseInt(l.data.slice(5, 7), 10) - 1;
      if (mesIdx < 0 || mesIdx > 11) continue;
      if (l.tipo === "Entrada") totais[mesIdx].rec  += Number(l.valor) || 0;
      else if (l.tipo === "Saida") totais[mesIdx].desp += Number(l.valor) || 0;
    }
    return MESES.map((name, i) => ({ name, Receitas: totais[i].rec, Despesas: totais[i].desp }));
  }, [lancamentos, filterPeriodo.ano]);

  const mensalData    = pfMensal;
  const sparkReceitas = useMemo(() => pfMensal.map((m) => m.Receitas), [pfMensal]);
  const sparkDespesas = useMemo(() => pfMensal.map((m) => m.Despesas), [pfMensal]);
  const sparkSaldo    = useMemo(
    () => pfMensal.map((m) => m.Receitas - m.Despesas),
    [pfMensal]
  );

  const insight = useMemo(() => {
    if (pfTotais.receitas === 0 && pfTotais.despesas === 0) {
      return "Nenhum lançamento no período. Registre entradas e saídas para ver tendências e insights.";
    }
    if (saldoMes < 0) {
      return `Atenção: déficit de ${fmtBRL(Math.abs(saldoMes))} no período. Vale revisar despesas e recorrências dos próximos dias.`;
    }
    if (recProximas.length > 0) {
      return `${recProximas.length} recorrência(s) vencem esta semana. Confira A Pagar/Receber para não perder prazos.`;
    }
    return `Período saudável com saldo de ${fmtBRL(saldoMes)}. Receitas ${fmtBRL(pfTotais.receitas)} e despesas ${fmtBRL(pfTotais.despesas)}.`;
  }, [pfTotais, saldoMes, recProximas.length]);

  const categoriasData = useMemo(() => {
    const h = {};
    const meta = {};
    for (const l of lancamentos) {
      const d = new Date(l.data + "T00:00:00");
      if (filterPeriodo.ano && d.getFullYear().toString() !== filterPeriodo.ano) continue;
      if (filterPeriodo.mes && (d.getMonth() + 1).toString().padStart(2, "0") !== filterPeriodo.mes) continue;

      const plano = planoContas.find((p) => p.id === l.planoId);
      if (!plano || plano.tipo === "Receita") continue;

      h[plano.descricao] = (h[plano.descricao] || 0) + l.valor;
      if (!meta[plano.descricao]) meta[plano.descricao] = { fill: plano.cor, icone: plano.icone };
    }
    return Object.entries(h)
      .map(([name, value]) => ({ name, value, ...meta[name] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [lancamentos, planoContas, filterPeriodo]);

  // ── Etapa 4.2: deltas vs mês anterior ────────────────────────────────
  const deltas = useMemo(() => {
    if (!pfMensal.length) return null;
    const mesAtualIdx = filterPeriodo.mes
      ? Math.max(0, parseInt(filterPeriodo.mes, 10) - 1)
      : new Date().getMonth();
    const cur  = pfMensal[mesAtualIdx]     || { Receitas: 0, Despesas: 0 };
    const prev = pfMensal[mesAtualIdx - 1] || null;
    const saldoCur  = cur.Receitas - cur.Despesas;
    const saldoPrev = prev ? prev.Receitas - prev.Despesas : null;
    return {
      receitas: prev ? safePct(cur.Receitas, prev.Receitas) : null,
      despesas: prev ? safePct(cur.Despesas, prev.Despesas) : null,
      saldo:    prev ? safePct(saldoCur, saldoPrev ?? 0) : null,
      mesAtual: MESES[mesAtualIdx],
      mesAnterior: mesAtualIdx > 0 ? MESES[mesAtualIdx - 1] : null,
    };
  }, [pfMensal, filterPeriodo.mes]);

  // ── Etapa 4.2: bullets do ResumoInteligente ───────────────────────────
  const resumoItems = useMemo(() => {
    const items = [];
    if (deltas?.receitas !== null && deltas?.receitas !== undefined) {
      const dir = deltas.receitas >= 0 ? "cresceram" : "caíram";
      items.push({
        tone: deltas.receitas >= 0 ? "success" : "danger",
        icon: deltas.receitas >= 0 ? "up" : "down",
        text: `Receitas ${dir} ${Math.abs(deltas.receitas * 100).toFixed(1)}% vs ${deltas.mesAnterior}`,
      });
    }
    if (deltas?.despesas !== null && deltas?.despesas !== undefined) {
      const dir = deltas.despesas >= 0 ? "subiram" : "recuaram";
      items.push({
        tone: deltas.despesas <= 0 ? "success" : "warning",
        icon: deltas.despesas <= 0 ? "down" : "up",
        text: `Despesas ${dir} ${Math.abs(deltas.despesas * 100).toFixed(1)}% vs ${deltas.mesAnterior}`,
      });
    }
    if (categoriasData.length > 0) {
      const totalDesp = categoriasData.reduce((s, c) => s + c.value, 0);
      const top = categoriasData[0];
      const pct = totalDesp > 0 ? (top.value / totalDesp) * 100 : 0;
      items.push({
        tone: pct > 40 ? "warning" : "info",
        icon: "money",
        text: `${top.icone ? top.icone + " " : ""}${top.name} representa ${pct.toFixed(0)}% dos gastos`,
      });
    }
    if (recProximas.length > 0) {
      items.push({
        tone: "warning",
        icon: "time",
        text: `${recProximas.length} vencimento${recProximas.length !== 1 ? "s" : ""} nos próximos 7 dias`,
      });
    }
    if (Math.abs(fluxoPrevisto) > 0) {
      items.push({
        tone: fluxoPrevisto >= 0 ? "success" : "danger",
        icon: fluxoPrevisto >= 0 ? "up" : "down",
        text: fluxoPrevisto >= 0
          ? `Fluxo previsto positivo de ${fmtBRL(fluxoPrevisto)} em 30 dias`
          : `Fluxo previsto negativo de ${fmtBRL(Math.abs(fluxoPrevisto))} em 30 dias`,
      });
    }
    if (saldoMes !== 0) {
      items.push({
        tone: saldoMes >= 0 ? "success" : "danger",
        icon: "money",
        text: saldoMes >= 0
          ? `Saldo do período: ${fmtBRL(saldoMes)} no positivo`
          : `Déficit do período: ${fmtBRL(Math.abs(saldoMes))}`,
      });
    }
    return items.slice(0, 5);
  }, [deltas, categoriasData, recProximas.length, fluxoPrevisto, saldoMes]);


  const kpis = [
    {
      icon: TrendingUp,
      label: "Receitas",
      value: fmtBRL(pfTotais.receitas),
      sub: "Entradas no período",
      valueClass: "success",
      sparkline: sparkReceitas,
      tone: "success",
      compact: true,
      delta: deltas?.receitas !== null && deltas?.receitas !== undefined
        ? { pct: deltas.receitas, label: `vs ${deltas.mesAnterior}` } : undefined,
    },
    {
      icon: TrendingDown,
      label: "Despesas",
      value: fmtBRL(pfTotais.despesas),
      sub: "Gastos no período",
      valueClass: pfTotais.despesas > pfTotais.receitas ? "danger" : "",
      sparkline: sparkDespesas,
      tone: "danger",
      compact: true,
      delta: deltas?.despesas !== null && deltas?.despesas !== undefined
        ? { pct: deltas.despesas, label: `vs ${deltas.mesAnterior}`, invert: true } : undefined,
    },
    {
      icon: CircleDollarSign,
      label: "Saldo do Período",
      value: fmtBRL(saldoMes),
      sub: saldoMes >= 0 ? "Sobrou no mês" : "Déficit no mês",
      valueClass: saldoMes >= 0 ? "success" : "danger",
      sparkline: sparkSaldo,
      tone: saldoMes >= 0 ? "success" : "danger",
      compact: true,
      delta: deltas?.saldo !== null && deltas?.saldo !== undefined && Number.isFinite(deltas.saldo)
        ? { pct: deltas.saldo, label: `vs ${deltas.mesAnterior}` } : undefined,
    },
    {
      icon: Wallet,
      label: "Saldo Total",
      value: fmtBRL(saldoTotal),
      sub: `${contas.filter((c) => !c.inativo).length} conta${contas.filter((c) => !c.inativo).length !== 1 ? "s" : ""}`,
      valueClass: saldoTotal >= 0 ? "success" : "danger",
      tone: "default",
      compact: true,
    },
    {
      icon: Repeat,
      label: "Recorrências",
      value: recLoading ? "—" : recAtivas.length.toString(),
      sub: recLoading ? "Carregando…"
        : recProximas.length > 0
          ? `${recProximas.length} vencendo esta semana`
          : "Todas em dia",
      valueClass: recProximas.length > 0 ? "warning" : "",
      tone: "warning",
      compact: true,
    },
    {
      icon: Hourglass,
      label: "Fluxo Previsto (30d)",
      value: recLoading ? "—" : fmtBRL(fluxoPrevisto),
      sub: "Recorrências ativas",
      valueClass: fluxoPrevisto >= 0 ? "success" : "danger",
      tone: fluxoPrevisto >= 0 ? "success" : "danger",
      compact: true,
    },
  ];

  return (
    <div className="dash-v2-root">

      <div className="dash-hero">
        <DashPeriodToolbar
          title="Finanças pessoais"
          subtitle="Resumo inteligente do período"
          icon={Wallet}
        />
        <DashInsight
          message={insight}
          tone={saldoMes < 0 ? "warn" : recProximas.length > 0 ? "info" : "success"}
        />
        <div className="kpi-v2-grid kpi-v2-grid--compact">
          {kpis.map((k) => (
            <KpiCardV2 key={k.label} {...k} />
          ))}
        </div>
      </div>

      {/* ── Hero chart + widgets laterais ─────────────────────────────────── */}
      <div className="dash-section">

        <div className="dash-alerts-row">
          <RecorrenciaAlert />
          <ContasAPagarAlert />
        </div>

        <div className="dash-main-grid">
          <div className="dash-main-grid-hero">
            <HeroChart12m
              data={mensalData}
              title="Receitas × Despesas (12 meses)"
              subtitle="Linha pontilhada destaca o saldo mensal"
            />
          </div>
          <div className="dash-main-grid-side">
            <ResumoInteligente items={resumoItems} />
            <UltimosLancamentosWidget limit={6} />
          </div>
        </div>

        <div className="dash-widgets-grid">
          <ProximosVencimentosWidget limit={6} />
          <ContasWidget contas={contas} getSaldoConta={getSaldoConta} />
        </div>

        {/* Charts detalhados existentes */}
        <div className="dash-section-title">Evolução mensal</div>
        <div className="dash-charts-grid dash-charts-grid--featured" style={{ marginBottom: 16 }}>

          <ChartCardV2
            className="dash-chart-featured"
            title="Receitas × Despesas"
            sub={`Ano ${filterPeriodo.ano} · visão consolidada`}
            height={300}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mensalData} barCategoryGap="28%" barGap={3}>
                <CartesianGrid strokeDasharray="4 8" stroke={CHART.grid} strokeOpacity={0.65} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: CHART.tick, fontSize: 10, fontWeight: 500 }} tickFormatter={fmtK} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART.grid, opacity: 0.35 }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10, fontWeight: 500 }} />
                <Bar dataKey="Receitas" fill={CHART.receita}  radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Despesas" fill={CHART.despesas} radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCardV2>

          <ChartCardV2
            title="Tendência de Resultado"
            sub={`Receitas vs Despesas em ${filterPeriodo.ano}`}
            height={300}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mensalData}>
                <defs>
                  <linearGradient id="recPFGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={CHART.receita} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CHART.receita} stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="despPFGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={CHART.despesas} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={CHART.despesas} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke={CHART.grid} strokeOpacity={0.65} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: CHART.tick, fontSize: 10, fontWeight: 500 }} tickFormatter={fmtK} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: CHART.grid, strokeWidth: 1, strokeDasharray: "4 4" }} />
                <ReferenceLine y={0} stroke={CHART.tick} strokeOpacity={0.45} strokeDasharray="3 4" />
                <Area type="monotone" dataKey="Receitas" stroke={CHART.receita}  fill="url(#recPFGrad)"  strokeWidth={2.25} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="Despesas" stroke={CHART.despesas} fill="url(#despPFGrad)" strokeWidth={2.25} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCardV2>
        </div>

        <div className="dash-section-title">Composição</div>
        <div className="dash-charts-grid">

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
