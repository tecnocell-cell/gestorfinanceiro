import { memo, useMemo } from "react";
import { useGestor } from "../../GestorContext.jsx";
import { fmtBRL, fmtDate } from "../../finance.js";
import EmptyState from "./EmptyState.jsx";

const TIPO_META = {
  Entrada:       { cls: "in",  label: "Entrada",       icon: "↑" },
  Saida:         { cls: "out", label: "Saída",         icon: "↓" },
  Transferencia: { cls: "tr",  label: "Transferência", icon: "↔" },
};

// Etapa 4.2: data relativa estilo Linear/Notion (Hoje, Ontem, 3d atrás)
function relDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return fmtDate(iso);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - hoje.getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === -1) return "Ontem";
  if (diff > 0 && diff <= 7) return `Em ${diff}d`;
  if (diff < 0 && diff >= -7) return `${Math.abs(diff)}d atrás`;
  return fmtDate(iso);
}

/**
 * UltimosLancamentosWidget — feed dos N lançamentos mais recentes (Etapa 4.2).
 * Mostra ícone, histórico, categoria · conta, data relativa e valor.
 */
function UltimosLancamentosWidget({ limit = 8, onVerTodos }) {
  const { lancamentos, contas, planoContas } = useGestor();

  const contaById = useMemo(
    () => Object.fromEntries(contas.map((c) => [c.id, c])),
    [contas]
  );
  const planoById = useMemo(
    () => Object.fromEntries(planoContas.map((p) => [p.id, p])),
    [planoContas]
  );

  const items = useMemo(() => {
    return [...lancamentos]
      .sort((a, b) => {
        const da = a.data || "";
        const db = b.data || "";
        if (da !== db) return db.localeCompare(da);
        return (Number(b.codigo) || 0) - (Number(a.codigo) || 0);
      })
      .slice(0, limit);
  }, [lancamentos, limit]);

  if (!items.length) {
    return (
      <div className="dash-list-widget">
        <div className="dash-list-widget-header">
          <div>
            <div className="dash-list-widget-title">🧾 Últimos lançamentos</div>
            <div className="dash-list-widget-sub">Movimentações mais recentes</div>
          </div>
        </div>
        <EmptyState
          icon="📭"
          title="Nenhum lançamento ainda"
          description="Registre uma entrada ou saída para acompanhar suas movimentações em tempo real."
          hint="Use o botão ‘+ Lançamento’ no topo da página."
        />
      </div>
    );
  }

  return (
    <div className="dash-list-widget">
      <div className="dash-list-widget-header">
        <div>
          <div className="dash-list-widget-title">🧾 Últimos lançamentos</div>
          <div className="dash-list-widget-sub">{items.length} mais recentes</div>
        </div>
        {onVerTodos && (
          <button className="dash-list-widget-link" type="button" onClick={onVerTodos}>
            Ver todos →
          </button>
        )}
      </div>

      <ul className="dash-list-widget-list dash-list-widget-list--cozy">
        {items.map((l) => {
          const meta = TIPO_META[l.tipo] || TIPO_META.Saida;
          const conta = contaById[l.contaId];
          const plano = planoById[l.planoId];
          const cat = plano ? `${plano.icone ? plano.icone + " " : ""}${plano.descricao}` : null;
          const subline = [cat, conta?.apelido || conta?.nome].filter(Boolean).join(" · ");
          return (
            <li key={l.id} className="dash-list-widget-row">
              <span className={`dash-tipo-pill dash-tipo-pill--${meta.cls}`} title={meta.label}>
                {meta.icon}
              </span>
              <div className="dash-list-widget-main">
                <div className="dash-list-widget-hist" title={l.historico || ""}>
                  {l.historico || <em>(sem histórico)</em>}
                </div>
                {subline && <div className="dash-list-widget-meta">{subline}</div>}
              </div>
              <div className="dash-list-widget-side">
                <div className={`dash-list-widget-val dash-list-widget-val--${meta.cls}`}>
                  {meta.cls === "out" ? "− " : meta.cls === "in" ? "+ " : ""}
                  {fmtBRL(l.valor)}
                </div>
                <div className="dash-list-widget-date" title={fmtDate(l.data)}>{relDate(l.data)}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default memo(UltimosLancamentosWidget);
