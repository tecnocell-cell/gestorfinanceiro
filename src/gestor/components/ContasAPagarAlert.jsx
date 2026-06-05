/**
 * ContasAPagarAlert — widget silencioso para o Dashboard V2.
 * Mostra contas vencidas e vencendo nos próximos 7 dias.
 * Retorna null se não houver nada a alertar (sem ruído).
 *
 * Regra: "atrasado" é calculado no frontend e nunca persistido.
 *  vencimento < hoje  && status !== "pago"  → atrasado
 *  vencimento ≤ hoje+7 && status !== "pago" → vencendo
 */
import { useMemo } from "react";
import { useGestor } from "../GestorContext.jsx";
import { fmtBRL, fmtDate, getStatusLancamento, isLancamentoPago } from "../finance.js";

const hojeStr = () => new Date().toISOString().slice(0, 10);
const em7Str  = () => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

export default function ContasAPagarAlert({ onIrParaContas }) {
  const { lancamentos } = useGestor();

  const items = useMemo(() => {
    const h7 = em7Str();
    return lancamentos
      .filter((l) => {
        if (l.tipo === "Transferencia") return false;
        if (isLancamentoPago(l)) return false;
        const venc = l.vencimento ?? l.data;
        return venc <= h7;
      })
      .map((l) => ({
        ...l,
        _venc:   l.vencimento ?? l.data,
        _status: getStatusLancamento(l),
      }))
      .sort((a, b) => a._venc.localeCompare(b._venc))
      .slice(0, 5);
  }, [lancamentos]);

  if (!items.length) return null;

  const atrasados = items.filter((i) => i._status === "atrasado").length;

  return (
    <div className="contas-alert">
      <div className="recorrencia-alert-header">
        <div className="recorrencia-alert-title">
          <span>⊖</span>
          Contas a Pagar/Receber
          <span className={`recorrencia-alert-count${atrasados > 0 ? " danger-count" : ""}`}>
            {items.length}
          </span>
          {atrasados > 0 && (
            <span className="contas-alert-badge-late">{atrasados} vencida{atrasados !== 1 ? "s" : ""}</span>
          )}
        </div>
        {onIrParaContas && (
          <button className="recorrencia-alert-link" type="button" onClick={onIrParaContas}>
            Ver todas →
          </button>
        )}
      </div>

      <div className="recorrencia-alert-list">
        {items.map((l) => (
          <div
            key={l.id}
            className={`recorrencia-alert-item${l._status === "atrasado" ? " atrasada" : ""}`}
          >
            <div className="recorrencia-alert-item-left">
              <span style={{ fontSize: 14, flexShrink: 0 }}>
                {l.tipo === "Entrada" ? "↑" : "↓"}
              </span>
              <span className="recorrencia-alert-desc">
                {l.historico || "Sem descrição"}
              </span>
            </div>
            <div className="recorrencia-alert-right">
              <span
                className="recorrencia-alert-valor"
                style={{ color: l.tipo === "Entrada" ? "var(--success-fg)" : "var(--danger-fg)" }}
              >
                {fmtBRL(l.valor)}
              </span>
              <span className="recorrencia-alert-date">
                {l._status === "atrasado" ? "Venceu " : "Vence "}{fmtDate(l._venc)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
