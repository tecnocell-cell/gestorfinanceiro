import { useCallback, useEffect, useState } from "react";
import { billingApi } from "../../api.js";
import { PUBLIC_MESSAGES } from "../../planRules.js";
import MercadoPagoPaymentBrick from "./MercadoPagoPaymentBrick.jsx";
import CardPaymentSandbox from "./CardPaymentSandbox.jsx";

/**
 * Forma de pagamento no Portal do Cliente (Etapa 7.8 + 7.8A Payment Brick)
 */
export default function PaymentMethodsSection({
  planoSlug,
  amountCentavos,
  payerEmail,
  onPixReady,
  onCardResult,
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

  const payCard = useCallback(
    async ({ cardToken, installments, payer, payment_method_id }) => {
      if (!planoSlug) return;
      setBusy?.("card-pay");
      setError?.("");
      setMsg?.("");
      try {
        const data = await billingApi.checkout({
          plano_slug: planoSlug,
          metodo: "cartao",
          gateway: "mercado_pago",
          cardToken,
          installments,
          payer: payer || (payerEmail ? { email: payerEmail } : undefined),
          payment_method_id,
        });
        onCardResult?.(data);
        if (data.activated) {
          setMsg?.("Pagamento aprovado. Seu plano foi ativado.");
        } else if (data.payment_status === "rejected") {
          setError?.("Pagamento recusado. Tente outro cartão ou use PIX.");
        } else if (data.payment_status === "cancelled") {
          setError?.("Pagamento cancelado.");
        } else {
          setMsg?.("Pagamento em processamento.");
        }
      } catch (e) {
        setError?.(e.message || PUBLIC_MESSAGES.billing);
      } finally {
        setBusy?.(null);
      }
    },
    [planoSlug, payerEmail, onCardResult, setBusy, setError, setMsg]
  );

  if (!methods) return <p className="text-muted">Carregando formas de pagamento…</p>;

  if (!methods.pagamento_online) {
    return (
      <div className="plan-payment-offline card">
        <p>{PUBLIC_MESSAGES.checkoutModalBody}</p>
      </div>
    );
  }

  const showCard = methods.metodos?.cartao;
  const showBrick = methods.cartao_brick && methods.public_key;
  const showSandbox = methods.cartao_sandbox && !showBrick;
  const amountReais = amountCentavos ? amountCentavos / 100 : 0;

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
              {showSandbox ? "Homologação (sandbox)" : "Pagamento com cartão"}
            </span>
          </button>
        ) : (
          <div className="plan-pay-card disabled">
            <span className="plan-pay-card-title">Cartão de crédito</span>
            <span className="plan-pay-card-desc">Cartão em breve</span>
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
        <div className="plan-payment-card-panel">
          {showBrick && amountReais > 0 ? (
            <MercadoPagoPaymentBrick
              publicKey={methods.public_key}
              amountReais={amountReais}
              payerEmail={payerEmail}
              onSubmit={payCard}
              onError={(e) => setError?.(e.message)}
            />
          ) : showSandbox ? (
            <CardPaymentSandbox onPay={payCard} busy={busy === "card-pay"} />
          ) : (
            <p className="admin-card-hint">Configure a chave pública do Mercado Pago no Super Admin.</p>
          )}
        </div>
      )}
    </div>
  );
}
