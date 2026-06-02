import { memo, useMemo } from "react";
import { addMoney, fmtBRL } from "../../finance.js";
import { WidgetTitle } from "../IconBox.jsx";
import {
  Wallet, Landmark, PiggyBank, CreditCard, Banknote,
} from "../icons.jsx";

const TIPO_ICON = {
  Caixa:    Banknote,
  Banco:    Landmark,
  Poupança: PiggyBank,
  default:  CreditCard,
};

/**
 * ContasWidget — lista de contas com saldos (Etapa 4.2).
 */
function ContasWidget({ contas, getSaldoConta }) {
  const ativas = useMemo(() => contas.filter((c) => !c.inativo), [contas]);

  const items = useMemo(
    () => ativas
      .map((c) => ({ ...c, saldo: getSaldoConta(c.id) }))
      .sort((a, b) => b.saldo - a.saldo),
    [ativas, getSaldoConta]
  );

  const totalGeral = useMemo(() => items.reduce((s, c) => addMoney(s, c.saldo), 0), [items]);
  const baseAbs = useMemo(
    () => items.reduce((s, c) => addMoney(s, Math.abs(c.saldo)), 0) || 1,
    [items]
  );

  if (!items.length) {
    return (
      <div className="dash-accounts-card">
        <div className="chart-card-v2-header">
          <div>
            <div className="chart-card-v2-title"><WidgetTitle icon={Wallet}>Contas</WidgetTitle></div>
            <div className="chart-card-v2-sub">Nenhuma conta cadastrada</div>
          </div>
        </div>
        <div className="dash-accounts-empty">
          <span className="dash-accounts-empty-icon" aria-hidden><Wallet size={32} strokeWidth={1.5} /></span>
          <span>Cadastre uma conta para acompanhar saldos aqui.</span>
        </div>
      </div>
    );
  }

  const principalId = items[0]?.saldo > 0 ? items[0].id : null;

  return (
    <div className="dash-accounts-card">
      <div className="chart-card-v2-header">
        <div>
          <div className="chart-card-v2-title"><WidgetTitle icon={Wallet}>Contas</WidgetTitle></div>
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
          const pct = (Math.abs(c.saldo) / baseAbs) * 100;
          const pctTxt = pct >= 10 ? pct.toFixed(0) : pct.toFixed(1);
          const positivo = c.saldo >= 0;
          const isPrincipal = c.id === principalId;
          const Icon = TIPO_ICON[c.tipo] ?? TIPO_ICON.default;
          return (
            <div key={c.id} className={`dash-account-item${isPrincipal ? " dash-account-item--principal" : ""}`}>
              <div className="dash-account-info">
                <span className="dash-account-icon" aria-hidden><Icon size={15} strokeWidth={2} /></span>
                <div className="dash-account-meta">
                  <div className="dash-account-name-row">
                    <div className="dash-account-name">{c.apelido || c.nome}</div>
                    {isPrincipal && <span className="dash-account-chip">Principal</span>}
                  </div>
                  <div className="dash-account-type">{c.tipo || "Conta"} · {pctTxt}% do patrimônio</div>
                </div>
              </div>
              <div className="dash-account-side">
                <div className={`dash-account-balance ${positivo ? "positive" : "negative"}`}>
                  {fmtBRL(c.saldo)}
                </div>
                <div className="dash-account-bar" aria-hidden>
                  <span
                    className={`dash-account-bar-fill ${positivo ? "positive" : "negative"}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
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
