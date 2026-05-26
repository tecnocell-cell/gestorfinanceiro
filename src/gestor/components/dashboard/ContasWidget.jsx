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
    () => ativas.map((c) => ({ ...c, saldo: getSaldoConta(c.id) })),
    [ativas, getSaldoConta]
  );

  const totalGeral = useMemo(
    () => items.reduce((s, c) => s + c.saldo, 0),
    [items]
  );

  if (!items.length) return null;

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
        {items.map((c) => (
          <div key={c.id} className="dash-account-item">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>{TIPO_ICON[c.tipo] ?? TIPO_ICON.default}</span>
              <div>
                <div className="dash-account-name">{c.apelido || c.nome}</div>
                <div className="dash-account-type">{c.tipo}</div>
              </div>
            </div>
            <div className={`dash-account-balance ${c.saldo >= 0 ? "positive" : "negative"}`}>
              {fmtBRL(c.saldo)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(ContasWidget);
