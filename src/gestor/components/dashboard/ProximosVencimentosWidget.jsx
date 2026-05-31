import { memo, useMemo } from "react";
import { useGestor } from "../../GestorContext.jsx";
import { useRecorrencias } from "../../hooks/useRecorrencias.js";
import { fmtBRL, fmtDate } from "../../finance.js";
import EmptyState from "./EmptyState.jsx";
import { WidgetTitle } from "../IconBox.jsx";
import { CalendarDays, CircleCheck, ArrowUpRight, ArrowDownLeft } from "../icons.jsx";

const hojeStr  = () => new Date().toISOString().slice(0, 10);
const emNStr   = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const toKey = (v) => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};

const diasEntre = (a, b) => {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((da - db) / 86_400_000);
};

/**
 * ProximosVencimentosWidget (Etapa 4.1)
 * - Layout mais respirável, badges menores
 * - Status, valor e data com hierarquia visual clara
 */
function ProximosVencimentosWidget({ limit = 6, dias = 14, onVerTodos }) {
  const { lancamentos } = useGestor();
  const { recorrencias, loading } = useRecorrencias();

  const hoje = hojeStr();
  const limiteData = emNStr(dias);

  const items = useMemo(() => {
    const out = [];
    for (const l of lancamentos) {
      if (l.tipo === "Transferencia") continue;
      const status = l.status ?? "pago";
      if (status === "pago") continue;
      const venc = toKey(l.vencimento) || toKey(l.data);
      if (!venc || venc > limiteData) continue;
      out.push({
        id: `l-${l.id}`,
        kind: "lanc",
        descricao: l.historico || "(sem histórico)",
        tipo: l.tipo,
        valor: Number(l.valor) || 0,
        data: venc,
      });
    }
    for (const r of recorrencias) {
      if (r.status !== "ativa") continue;
      const prox = toKey(r.proxima_data);
      if (!prox || prox > limiteData) continue;
      out.push({
        id: `r-${r.id}`,
        kind: "rec",
        descricao: r.descricao || "Recorrência",
        tipo: r.tipo === "Receita" ? "Entrada" : "Saida",
        valor: Number(r.valor) || 0,
        data: prox,
      });
    }
    return out.sort((a, b) => a.data.localeCompare(b.data)).slice(0, limit);
  }, [lancamentos, recorrencias, limiteData, limit]);

  if (loading && items.length === 0) {
    return (
      <div className="dash-list-widget">
        <div className="dash-list-widget-header">
          <div>
            <div className="dash-list-widget-title"><WidgetTitle icon={CalendarDays}>Próximos vencimentos</WidgetTitle></div>
            <div className="dash-list-widget-sub">Carregando…</div>
          </div>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="dash-list-widget">
        <div className="dash-list-widget-header">
          <div>
            <div className="dash-list-widget-title"><WidgetTitle icon={CalendarDays}>Próximos vencimentos</WidgetTitle></div>
            <div className="dash-list-widget-sub">Tudo em dia</div>
          </div>
        </div>
        <EmptyState
          icon={CircleCheck}
          tone="success"
          title="Sem vencimentos próximos"
          description="Configure recorrências para automatizar lembretes de contas regulares."
        />
      </div>
    );
  }

  const atrasados = items.filter((i) => i.data < hoje).length;

  return (
    <div className="dash-list-widget">
      <div className="dash-list-widget-header">
        <div>
          <div className="dash-list-widget-title">📅 Próximos vencimentos</div>
          <div className="dash-list-widget-sub">
            {items.length} nos próximos {dias} dias
            {atrasados > 0 && <span className="dash-badge dash-badge--danger dash-badge--xs" style={{ marginLeft: 6 }}>{atrasados} vencido{atrasados !== 1 ? "s" : ""}</span>}
          </div>
        </div>
        {onVerTodos && (
          <button className="dash-list-widget-link" type="button" onClick={onVerTodos}>
            Ver todos →
          </button>
        )}
      </div>

      <ul className="dash-list-widget-list dash-list-widget-list--cozy">
        {items.map((i) => {
          const d = diasEntre(i.data, hoje);
          let badgeCls, badgeTxt;
          if (d < 0)       { badgeCls = "danger";  badgeTxt = `Vencido ${Math.abs(d)}d`; }
          else if (d === 0){ badgeCls = "warning"; badgeTxt = "Hoje"; }
          else if (d <= 3) { badgeCls = "warning"; badgeTxt = `${d}d`; }
          else             { badgeCls = "info";    badgeTxt = `${d}d`; }

          const isOut = i.tipo === "Saida";
          return (
            <li key={i.id} className="dash-list-widget-row">
              <span className={`dash-tipo-pill dash-tipo-pill--${isOut ? "out" : "in"}`}>
                {isOut ? <ArrowDownLeft size={13} strokeWidth={2.25} /> : <ArrowUpRight size={13} strokeWidth={2.25} />}
              </span>
              <div className="dash-list-widget-main">
                <div className="dash-list-widget-hist" title={i.descricao}>
                  {i.descricao}
                  {i.kind === "rec" && <span className="dash-badge dash-badge--info dash-badge--xs" style={{ marginLeft: 6 }}>Rec.</span>}
                </div>
                <div className="dash-list-widget-meta">
                  <span className={`dash-badge dash-badge--${badgeCls} dash-badge--xs`}>{badgeTxt}</span>
                  <span className="dash-list-widget-meta-sep">·</span>
                  <span>{fmtDate(i.data)}</span>
                </div>
              </div>
              <div className="dash-list-widget-side">
                <div className={`dash-list-widget-val dash-list-widget-val--${isOut ? "out" : "in"}`}>
                  {isOut ? "− " : "+ "}{fmtBRL(i.valor)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default memo(ProximosVencimentosWidget);
