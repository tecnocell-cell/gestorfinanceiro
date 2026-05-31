import { memo, useMemo } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { CHART, MESES } from "../../constants.js";
import { fmtBRL } from "../../finance.js";
import EmptyState from "./EmptyState.jsx";

const fmtK = (v) => {
  const n = Math.abs(v);
  if (n >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
};

/**
 * Custom tooltip premium — Receitas / Despesas / Saldo em BRL.
 */
function HeroTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const get = (k) => payload.find((p) => p.dataKey === k)?.value ?? 0;
  const rec = get("Receitas");
  const desp = get("Despesas");
  const saldo = rec - desp;
  return (
    <div className="dash-hero-tooltip">
      <div className="dash-hero-tooltip-title">{label}</div>
      <div className="dash-hero-tooltip-row">
        <span className="dot" style={{ background: CHART.receita }} />
        <span className="lbl">Receitas</span>
        <span className="val success">{fmtBRL(rec)}</span>
      </div>
      <div className="dash-hero-tooltip-row">
        <span className="dot" style={{ background: CHART.despesas }} />
        <span className="lbl">Despesas</span>
        <span className="val danger">{fmtBRL(desp)}</span>
      </div>
      <div className="dash-hero-tooltip-divider" />
      <div className="dash-hero-tooltip-row">
        <span className="dot" style={{ background: saldo >= 0 ? "var(--success)" : "var(--danger)" }} />
        <span className="lbl"><strong>Saldo</strong></span>
        <span className={`val ${saldo >= 0 ? "success" : "danger"}`}><strong>{fmtBRL(saldo)}</strong></span>
      </div>
    </div>
  );
}

/**
 * HeroChart12m — Gráfico principal premium (Etapa 4.1).
 *
 * Maior, mais vivo, com totais resumidos no header.
 * Não realiza cálculos novos: usa os dados já preparados pela página.
 */
function HeroChart12m({ data, title = "Receitas × Despesas (12 meses)", subtitle }) {
  const enriched = useMemo(
    () => (data || []).map((d) => ({ ...d, Saldo: (d.Receitas || 0) - (d.Despesas || 0) })),
    [data]
  );

  const totals = useMemo(() => {
    let r = 0, d = 0;
    for (const x of enriched) { r += x.Receitas || 0; d += x.Despesas || 0; }
    return { rec: r, desp: d, saldo: r - d };
  }, [enriched]);

  const hasData = totals.rec + totals.desp > 0;

  return (
    <div className="dash-hero-chart">
      <div className="dash-hero-chart-header">
        <div className="dash-hero-chart-headline">
          <div className="dash-hero-chart-title">{title}</div>
          {subtitle && <div className="dash-hero-chart-sub">{subtitle}</div>}
        </div>
        <div className="dash-hero-chart-totals">
          <div className="dash-hero-chart-total">
            <span className="lbl"><i className="dot" style={{ background: CHART.receita }} />Receitas</span>
            <span className="val success">{fmtBRL(totals.rec)}</span>
          </div>
          <div className="dash-hero-chart-total">
            <span className="lbl"><i className="dot" style={{ background: CHART.despesas }} />Despesas</span>
            <span className="val danger">{fmtBRL(totals.desp)}</span>
          </div>
          <div className="dash-hero-chart-total">
            <span className="lbl"><i className="dot" style={{ background: "var(--primary)" }} />Saldo</span>
            <span className={`val ${totals.saldo >= 0 ? "success" : "danger"}`}>{fmtBRL(totals.saldo)}</span>
          </div>
        </div>
      </div>

      <div className="dash-hero-chart-body">
        {!hasData ? (
          <EmptyState
            icon="📈"
            title="Sem movimentação nos últimos 12 meses"
            description="Lance receitas e despesas para visualizar a evolução completa."
            hint="Dica: cadastre recorrências para automatizar a entrada de dados."
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={enriched} margin={{ top: 14, right: 14, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="heroRecGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor={CHART.receita} stopOpacity={0.75} />
                  <stop offset="60%" stopColor={CHART.receita} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={CHART.receita} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="heroDespGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor={CHART.despesas} stopOpacity={0.55} />
                  <stop offset="60%" stopColor={CHART.despesas} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={CHART.despesas} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke={CHART.grid} strokeOpacity={0.55} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} dy={4} />
              <YAxis tick={{ fill: CHART.tick, fontSize: 10, fontWeight: 500 }} tickFormatter={fmtK} axisLine={false} tickLine={false} width={46} />
              <Tooltip content={<HeroTooltip />} cursor={{ stroke: CHART.grid, strokeWidth: 1, strokeDasharray: "4 4" }} />
              <Area type="monotone" dataKey="Receitas" stroke={CHART.receita}  fill="url(#heroRecGrad)"  strokeWidth={2.75} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)", fill: CHART.receita }} />
              <Area type="monotone" dataKey="Despesas" stroke={CHART.despesas} fill="url(#heroDespGrad)" strokeWidth={2.75} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)", fill: CHART.despesas }} />
              <Line type="monotone" dataKey="Saldo" stroke="var(--primary)" strokeWidth={2.25} strokeDasharray="6 4" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)", fill: "var(--primary)" }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default memo(HeroChart12m);

export { MESES as _MESES };
