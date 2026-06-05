import { memo, useMemo } from "react";
import { useGestor } from "../../GestorContext.jsx";
import {
  addMoney, fmtBRL, fmtDate, getDataRealizacao, getDataPrevista, getStatusLancamento,
  isLancamentoPago, isTransferenciaInterna,
} from "../../finance.js";
import { WidgetTitle } from "../IconBox.jsx";
import { ArrowDownLeft, ArrowUpRight, Clock, CircleCheck } from "../icons.jsx";

const hojeStr = () => new Date().toISOString().slice(0, 10);
const em7Str = () => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

function MovimentacoesMesWidget({ onVerContas }) {
  const { lancamentos, filterPeriodo } = useGestor();
  const hoje = hojeStr();
  const h7 = em7Str();

  const stats = useMemo(() => {
    let receitasPagas = 0;
    let despesasPagas = 0;
    let pendentes = 0;
    let vencidas = 0;
    let vence7 = 0;
    const quitadas = [];

    for (const l of lancamentos) {
      if (l.tipo === "Transferencia" || isTransferenciaInterna(l)) continue;
      const st = getStatusLancamento(l);

      if (isLancamentoPago(l)) {
        const dataRef = getDataRealizacao(l);
        if (!dataRef) continue;
        if (filterPeriodo.ano && !dataRef.startsWith(filterPeriodo.ano)) continue;
        if (filterPeriodo.mes && dataRef.slice(5, 7) !== filterPeriodo.mes) continue;
        if (l.tipo === "Entrada") receitasPagas = addMoney(receitasPagas, l.valor);
        else if (l.tipo === "Saida") {
          despesasPagas = addMoney(despesasPagas, l.valor);
          quitadas.push(l);
        }
      } else {
        const prev = getDataPrevista(l);
        if (!prev) continue;
        if (filterPeriodo.ano && !prev.startsWith(filterPeriodo.ano)) continue;
        if (filterPeriodo.mes && prev.slice(5, 7) !== filterPeriodo.mes) continue;
        pendentes = addMoney(pendentes, l.valor);
        if (st === "atrasado") vencidas += 1;
        else if (prev > hoje && prev <= h7) vence7 += 1;
      }
    }

    quitadas.sort((a, b) => (getDataRealizacao(b) || "").localeCompare(getDataRealizacao(a) || ""));

    return { receitasPagas, despesasPagas, pendentes, vencidas, vence7, quitadas: quitadas.slice(0, 5) };
  }, [lancamentos, filterPeriodo, hoje, h7]);

  const periodoLabel = filterPeriodo.mes
    ? `Mês ${filterPeriodo.mes}/${filterPeriodo.ano || ""}`
    : filterPeriodo.ano
      ? `Ano ${filterPeriodo.ano}`
      : "Período atual";

  return (
    <div className="dash-mov-mes-wrap">
      <div className="dash-list-widget dash-mov-mes-widget">
        <div className="dash-list-widget-header">
          <div>
            <div className="dash-list-widget-title">
              <WidgetTitle icon={CircleCheck}>Movimentações do mês</WidgetTitle>
            </div>
            <div className="dash-list-widget-sub">{periodoLabel} · recebidas, pagas e pendentes</div>
          </div>
          {onVerContas && (
            <button type="button" className="dash-list-widget-link" onClick={onVerContas}>
              Ver contas →
            </button>
          )}
        </div>

        <div className="dash-mov-mes-kpis">
          <div className="dash-mov-mes-kpi dash-mov-mes-kpi--in">
            <span className="dash-mov-mes-kpi-icon" aria-hidden><ArrowUpRight size={15} strokeWidth={2.25} /></span>
            <span className="dash-mov-mes-kpi-label">Recebidas</span>
            <strong className="dash-mov-mes-kpi-val">{fmtBRL(stats.receitasPagas)}</strong>
          </div>
          <div className="dash-mov-mes-kpi dash-mov-mes-kpi--out">
            <span className="dash-mov-mes-kpi-icon" aria-hidden><ArrowDownLeft size={15} strokeWidth={2.25} /></span>
            <span className="dash-mov-mes-kpi-label">Pagas</span>
            <strong className="dash-mov-mes-kpi-val">{fmtBRL(stats.despesasPagas)}</strong>
          </div>
          <div className="dash-mov-mes-kpi dash-mov-mes-kpi--pend">
            <span className="dash-mov-mes-kpi-icon" aria-hidden><Clock size={15} strokeWidth={2.25} /></span>
            <span className="dash-mov-mes-kpi-label">Pendentes</span>
            <strong className="dash-mov-mes-kpi-val">{fmtBRL(stats.pendentes)}</strong>
          </div>
          <div className="dash-mov-mes-kpi dash-mov-mes-kpi--warn">
            <span className="dash-mov-mes-kpi-label">Vencidas</span>
            <strong className="dash-mov-mes-kpi-val dash-mov-mes-kpi-val--count">{stats.vencidas}</strong>
          </div>
          <div className="dash-mov-mes-kpi dash-mov-mes-kpi--info">
            <span className="dash-mov-mes-kpi-label">Vencem em 7d</span>
            <strong className="dash-mov-mes-kpi-val dash-mov-mes-kpi-val--count">{stats.vence7}</strong>
          </div>
        </div>

        {stats.quitadas.length > 0 ? (
          <>
            <div className="dash-mov-mes-recent-title">Últimas quitações</div>
            <ul className="dash-list-widget-list dash-list-widget-list--cozy">
              {stats.quitadas.map((l) => (
                <li key={l.id} className="dash-list-widget-row">
                  <span className="dash-tipo-pill dash-tipo-pill--out">
                    <ArrowDownLeft size={13} strokeWidth={2.25} />
                  </span>
                  <div className="dash-list-widget-main">
                    <div className="dash-list-widget-hist" title={l.historico}>
                      {l.historico || "Despesa"}
                    </div>
                    <div className="dash-list-widget-meta">
                      <span>{fmtDate(getDataRealizacao(l))}</span>
                    </div>
                  </div>
                  <div className="dash-list-widget-side">
                    <div className="dash-list-widget-val dash-list-widget-val--out">
                      − {fmtBRL(l.valor)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="dash-mov-mes-empty">Nenhuma despesa quitada neste período.</p>
        )}
      </div>
    </div>
  );
}

export default memo(MovimentacoesMesWidget);
