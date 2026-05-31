import { memo, useMemo } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
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
 * Custom tooltip formatado em BRL — mostra Receitas, Despesas e Saldo.
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
 * HeroChart12m — Gráfico principal dominante da Dashboard V2 (Etapa 4).
 *
 * Recebe um array de 12 meses com { name, Receitas, Despesas } e desenha
 * AreaChart com gradientes + linha de Saldo sobreposta.
 *
 * Não realiza cálculos novos: aceita os dados já preparados pela página.
 */
function HeroChart12m({ data, title = "Receitas × Despesas (12 meses)", subtitle }) {
  const enriched = useMemo(
    () => (data || []).map((d) => ({ ...d, Saldo: (d.Receitas || 0) - (d.Despesas || 0) })),
    [data]
  );

  const total = useMemo(
    () => enriched.reduce((acc, d) => acc + (d.Receitas || 0) + (d.Despesas || 0), 0),
    [enriched]
  );

  return (
    <div className="dash-hero-chart">
      <div className="dash-hero-chart-header">
        <div>
          <div className="dash-hero-chart-title">{title}</div>
          {subtitle && <div className="dash-hero-chart-sub">{subtitle}</div>}
        </div>
        <div className="dash-hero-chart-legend">
          <span className="lg-item"><i style={{ background: CHART.receita }} /> Receitas</span>
          <span className="lg-item"><i style={{ background: CHART.despesas }} /> Despesas</span>
          <span className="lg-item"><i style={{ background: "var(--primary)" }} /> Saldo</span>
        </div>
      </div>

      <div className="dash-hero-chart-body">
        {total === 0 ? (
          <EmptyState
            icon="📈"
            title="Sem movimentação nos últimos 12 meses"
            description="Adicione lançamentos para visualizar a evolução de receitas e despesas."
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={enriched} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="heroRecGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor={CHART.receita} stopOpacity={0.55} />
                  <stop offset="95%" stopColor={CHART.receita} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="heroDespGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor={CHART.despesas} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={CHART.despesas} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke={CHART.grid} strokeOpacity={0.55} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: CHART.tick, fontSize: 10, fontWeight: 500 }} tickFormatter={fmtK} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<HeroTooltip />} cursor={{ stroke: CHART.grid, strokeWidth: 1, strokeDasharray: "4 4" }} />
              <Area type="monotone" dataKey="Receitas" stroke={CHART.receita}  fill="url(#heroRecGrad)"  strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              <Area type="monotone" dataKey="Despesas" stroke={CHART.despesas} fill="url(#heroDespGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              <Line type="monotone" dataKey="Saldo" stroke="var(--primary)" strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "var(--primary)" }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default memo(HeroChart12m);

/* MESES export reuse hint (silenciar eslint se não usado) */
export { MESES as _MESES };
