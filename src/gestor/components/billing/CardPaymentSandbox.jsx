import { useState } from "react";

const SCENARIOS = [
  { id: "approved", label: "Aprovado", token: "mock_mp_card_approved", desc: "Ativa assinatura" },
  { id: "rejected", label: "Recusado", token: "mock_mp_card_rejected", desc: "Cartão recusado" },
  { id: "installments", label: "Parcelado (3x)", token: "mock_mp_card_installments", installments: 3, desc: "Aprovado em 3 parcelas" },
  { id: "cancelled", label: "Cancelado", token: "mock_mp_card_cancelled", desc: "Pagamento cancelado" },
];

/**
 * Sandbox local — simula Payment Brick em homologação (BILLING_USE_MOCK_GATEWAY).
 */
export default function CardPaymentSandbox({ onPay, busy }) {
  const [scenario, setScenario] = useState("approved");

  const selected = SCENARIOS.find((s) => s.id === scenario) || SCENARIOS[0];

  const handlePay = () => {
    onPay({
      cardToken: selected.token,
      installments: selected.installments || 1,
      payer: { email: "sandbox@fluxiva.test" },
    });
  };

  return (
    <div className="card-payment-sandbox">
      <p className="admin-card-hint">
        Ambiente de homologação — simula o Payment Brick sem cobrança real.
      </p>
      <div className="card-sandbox-scenarios">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`card-sandbox-scenario${scenario === s.id ? " card-sandbox-scenario--active" : ""}`}
            onClick={() => setScenario(s.id)}
          >
            <span className="card-sandbox-scenario-title">{s.label}</span>
            <span className="card-sandbox-scenario-desc">{s.desc}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={handlePay}
        style={{ marginTop: 12 }}
      >
        {busy ? "Processando…" : `Simular pagamento — ${selected.label}`}
      </button>
    </div>
  );
}
