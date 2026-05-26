/**
 * RecorrenciaAlert — widget do dashboard
 * Mostra recorrências ativas vencendo nos próximos 7 dias (e atrasadas).
 * Totalmente silencioso em caso de erro — nunca quebra o dashboard.
 */
import { useRecorrencias } from "../hooks/useRecorrencias.js";
import { fmtBRL, fmtDate } from "../finance.js";

const hoje       = () => new Date().toISOString().slice(0, 10);
const em7Dias    = () => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
const isAtrasada = (data) => data < hoje();

export default function RecorrenciaAlert({ onIrParaRecorrencias }) {
  const { recorrencias, loading, error } = useRecorrencias();

  // Silencioso em caso de erro ou enquanto carrega
  if (loading || error) return null;

  const limite = em7Dias();
  const vencendo = recorrencias.filter(
    (r) => r.status === "ativa" && r.proxima_data <= limite
  );

  if (vencendo.length === 0) return null;

  return (
    <div className="recorrencia-alert">
      <div className="recorrencia-alert-header">
        <div className="recorrencia-alert-title">
          ↺ Recorrências vencendo
          <span className="recorrencia-alert-count">{vencendo.length}</span>
        </div>
        {onIrParaRecorrencias && (
          <button
            type="button"
            className="recorrencia-alert-link"
            onClick={onIrParaRecorrencias}
          >
            Gerenciar →
          </button>
        )}
      </div>

      <div className="recorrencia-alert-list">
        {vencendo.map((r) => {
          const atrasada = isAtrasada(r.proxima_data);
          return (
            <div
              key={r.id}
              className={`recorrencia-alert-item${atrasada ? " atrasada" : ""}`}
            >
              <div className="recorrencia-alert-item-left">
                <span
                  className={`badge ${r.tipo === "Receita" ? "badge-green" : "badge-red"}`}
                  style={{ fontSize: 10 }}
                >
                  {r.tipo === "Receita" ? "↑" : "↓"} {r.tipo}
                </span>
                <span className="recorrencia-alert-desc" title={r.descricao}>
                  {r.descricao}
                </span>
              </div>
              <div className="recorrencia-alert-right">
                <span className="recorrencia-alert-valor">{fmtBRL(r.valor)}</span>
                <span className="recorrencia-alert-date">
                  {atrasada ? "⚠ " : ""}
                  {fmtDate(r.proxima_data)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
