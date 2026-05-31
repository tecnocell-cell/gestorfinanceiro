import { memo, useMemo } from "react";
import { fmtBRL } from "../../finance.js";

const TIPO_ICON = {
  Caixa:    "💵",
  Banco:    "🏦",
  Poupança: "🐷",
  default:  "💳",
};

/**
 * ContasWidget — lista de contas com saldos para o Dashboard V2.
 * Aceita getSaldoConta como função para evitar re-calcular aqui.
 */
function ContasWidget({ contas, getSaldoConta }) {
  const ativas = useMemo(
    () => contas.filter((c) => !c.inativo),
    [contas]
  );

  const items = useMemo(
    () => ativas
      .map((c) => ({ ...c, saldo: getSaldoConta(c.id) }))
      .sort((a, b) => b.saldo - a.saldo),
    [ativas, getSaldoConta]
  );

  const totalGeral = useMemo(
    () => items.reduce((s, c) => s + c.saldo, 0),
    [items]
  );

  if (!items.length) {
    return (
      <div className="dash-accounts-card">
        <div className="chart-card-v2-header">
          <div>
            <div className="chart-card-v2-title">🏦 Contas</div>
            <div className="chart-card-v2-sub">Nenhuma conta cadastrada</div>
          </div>
        </div>
        <div className="dash-accounts-empty">
          <span style={{ fontSize: 32 }}>🏦</span>
          <span>Cadastre uma conta para acompanhar saldos aqui.</span>
        </div>
      </div>
    );
  }

  // Para barra de proporção
  const maxAbs = Math.max(...items.map((c) => Math.abs(c.saldo)), 1);

  return (
    <div className="dash-accounts-card">
      <div className="chart-card-v2-header">
        <div>
          <div className="chart-card-v2-title">🏦 Contas</div>
          <div className="chart-card-v2-sub">
            {items.length} conta{items.length !== 1 ? "s" : ""} ativa{items.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div
          className={`dash-account-balance ${totalGeral >= 0 ? "positive" : "negative"}`}
          style={{ fontSize: 16 }}
        >
          {fmtBRL(totalGeral)}
        </div>
      </div>

      <div className="dash-accounts-list">
        {items.map((c) => {
          const pct = Math.min(100, Math.round((Math.abs(c.saldo) / maxAbs) * 100));
          const positivo = c.saldo >= 0;
          return (
            <div key={c.id} className="dash-account-item">
              <div className="dash-account-info">
                <span className="dash-account-icon">{TIPO_ICON[c.tipo] ?? TIPO_ICON.default}</span>
                <div className="dash-account-meta">
                  <div className="dash-account-name">{c.apelido || c.nome}</div>
                  <div className="dash-account-type">{c.tipo}</div>
                </div>
              </div>
              <div className="dash-account-right">
                <div className={`dash-account-balance ${positivo ? "positive" : "negative"}`}>
                  {fmtBRL(c.saldo)}
                </div>
                <div className="dash-account-bar" aria-hidden>
                  <span
                    className={`dash-account-bar-fill ${positivo ? "positive" : "negative"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(ContasWidget);
