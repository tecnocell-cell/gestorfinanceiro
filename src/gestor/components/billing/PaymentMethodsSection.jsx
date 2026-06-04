import { useEffect, useState } from "react";
import { billingApi } from "../../api.js";
import { PUBLIC_MESSAGES } from "../../planRules.js";

/**
 * Forma de pagamento no Portal do Cliente (Etapa 7.8)
 */
export default function PaymentMethodsSection({
  planoSlug,
  onPixReady,
  busy,
  setBusy,
  setError,
  setMsg,
}) {
  const [methods, setMethods] = useState(null);
  const [metodo, setMetodo] = useState("pix");

  useEffect(() => {
    billingApi
      .paymentMethods()
      .then(setMethods)
      .catch(() => setMethods({ pagamento_online: false, metodos: {} }));
  }, []);

  const payPix = async () => {
    if (!planoSlug) return;
    setBusy?.("pix-pay");
    setError?.("");
    setMsg?.("");
    try {
      const data = await billingApi.checkout({
        plano_slug: planoSlug,
        metodo: "pix",
        gateway: methods?.gateway_ativo,
      });
      onPixReady?.(data);
      setMsg?.("PIX gerado. Pague para ativar seu plano.");
    } catch (e) {
      setError?.(e.message || PUBLIC_MESSAGES.billing);
    } finally {
      setBusy?.(null);
    }
  };

  if (!methods) return <p className="text-muted">Carregando formas de pagamento…</p>;

  if (!methods.pagamento_online) {
    return (
      <div className="plan-payment-offline card">
        <p>{PUBLIC_MESSAGES.checkoutModalBody}</p>
      </div>
    );
  }

  const showCard = methods.metodos?.cartao;
  const cardTest = methods.cartao_em_teste;

  return (
    <div className="plan-payment-methods">
      <h3 className="plan-section-title">Forma de pagamento</h3>
      <div className="plan-pay-cards">
        {methods.metodos?.pix && (
          <button
            type="button"
            className={`plan-pay-card ${metodo === "pix" ? "active" : ""}`}
            onClick={() => setMetodo("pix")}
          >
            <span className="plan-pay-card-title">PIX</span>
            <span className="plan-pay-card-desc">Pagamento instantâneo</span>
          </button>
        )}
        {showCard ? (
          <button
            type="button"
            className={`plan-pay-card ${metodo === "cartao" ? "active" : ""}`}
            onClick={() => setMetodo("cartao")}
          >
            <span className="plan-pay-card-title">Cartão de crédito</span>
            <span className="plan-pay-card-desc">
              {cardTest ? "Cartão em teste" : "Pagamento com cartão"}
            </span>
          </button>
        ) : (
          <div className="plan-pay-card disabled">
            <span className="plan-pay-card-title">Cartão de crédito</span>
            <span className="plan-pay-card-desc">Em breve</span>
          </div>
        )}
        <div className="plan-pay-card disabled">
          <span className="plan-pay-card-title">Boleto</span>
          <span className="plan-pay-card-desc">Em breve</span>
        </div>
      </div>

      {metodo === "pix" && methods.metodos?.pix && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy === "pix-pay" || !planoSlug}
          onClick={payPix}
        >
          {busy === "pix-pay" ? "Gerando PIX…" : "Gerar cobrança PIX"}
        </button>
      )}

      {metodo === "cartao" && showCard && (
        <p className="text-sm text-muted" style={{ marginTop: 8 }}>
          Integração com Payment Brick: use a chave pública configurada no painel. Em produção,
          cartão exige PAYMENT_CARD_ENABLED=true e token gerado no frontend (não armazenamos dados
          do cartão).
        </p>
      )}
    </div>
  );
}
