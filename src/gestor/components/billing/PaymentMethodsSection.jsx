import { useCallback, useEffect, useState } from "react";
import { billingApi } from "../../api.js";
import { PUBLIC_MESSAGES } from "../../planRules.js";
import MercadoPagoPaymentBrick from "./MercadoPagoPaymentBrick.jsx";
import CardPaymentSandbox from "./CardPaymentSandbox.jsx";

const CSS = `
.pms-pix-result {
  margin-top: 16px;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid oklch(0.88 0.04 155);
  background: oklch(0.97 0.02 150);
}
.pms-pix-result-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--green-dark, #166534);
  margin: 0 0 12px;
}
.pms-qr-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.pms-qr-img {
  width: 180px;
  height: 180px;
  border: 3px solid var(--green-dark, #166534);
  border-radius: 12px;
  background: #fff;
  padding: 6px;
  object-fit: contain;
}
.pms-qr-placeholder {
  width: 180px;
  height: 180px;
  border: 2px dashed oklch(0.75 0.04 155);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--muted-foreground);
  text-align: center;
  padding: 12px;
}
.pms-copypaste {
  width: 100%;
  font-size: 11px;
  font-family: monospace;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid oklch(0.88 0.03 155);
  background: #fff;
  resize: none;
  color: var(--text);
  word-break: break-all;
}
.pms-copy-btn {
  width: 100%;
  margin-top: 8px;
  padding: 10px;
  border-radius: 10px;
  border: none;
  background: var(--green-dark, #166534);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.pms-copy-btn:active { opacity: 0.8; }
.pms-copy-btn--copied { background: oklch(0.5 0.12 155); }
.pms-pix-hint {
  font-size: 11px;
  color: var(--muted-foreground);
  margin: 8px 0 0;
  text-align: center;
}
.pms-refresh-btn {
  width: 100%;
  margin-top: 8px;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid oklch(0.88 0.03 155);
  background: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: var(--text);
}
`;

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  });
}

function PixResult({ pix, onRefresh, refreshing }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(pix.copy_paste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="pms-pix-result">
      <p className="pms-pix-result-title">✅ PIX gerado — escaneie ou copie para pagar</p>

      <div className="pms-qr-wrap">
        {pix.encoded_image ? (
          <img
            className="pms-qr-img"
            src={`data:image/png;base64,${pix.encoded_image}`}
            alt="QR Code PIX"
          />
        ) : (
          <div className="pms-qr-placeholder">QR Code indisponível</div>
        )}
      </div>

      {pix.copy_paste && (
        <>
          <textarea
            className="pms-copypaste"
            readOnly
            rows={3}
            value={pix.copy_paste}
            onClick={(e) => e.target.select()}
          />
          <button
            type="button"
            className={`pms-copy-btn ${copied ? "pms-copy-btn--copied" : ""}`}
            onClick={handleCopy}
          >
            {copied ? "✅ Copiado!" : "📋 Copiar chave PIX"}
          </button>
        </>
      )}

      <p className="pms-pix-hint">
        Após o pagamento, clique em "Confirmar pagamento" para atualizar o status.
      </p>

      <button
        type="button"
        className="pms-refresh-btn"
        disabled={refreshing}
        onClick={onRefresh}
      >
        {refreshing ? "Verificando…" : "Confirmar pagamento"}
      </button>
    </div>
  );
}

/**
 * Forma de pagamento no Portal do Cliente
 */
export default function PaymentMethodsSection({
  planoSlug,
  amountCentavos,
  payerEmail,
  onPixReady,
  onCardResult,
  onRefreshStatus,
  busy,
  setBusy,
  setError,
  setMsg,
}) {
  const [methods, setMethods] = useState(null);
  const [metodo, setMetodo] = useState("pix");
  const [pixResult, setPixResult] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    billingApi
      .paymentMethods()
      .then(setMethods)
      .catch(() => setMethods({ pagamento_online: false, metodos: {} }));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshStatus?.();
    } finally {
      setRefreshing(false);
    }
  };

  const payPix = async () => {
    if (!planoSlug) return;
    setPixResult(null);
    setBusy?.("pix-pay");
    setError?.("");
    setMsg?.("");
    try {
      const data = await billingApi.checkout({
        plano_slug: planoSlug,
        metodo: "pix",
        gateway: methods?.gateway_ativo,
      });
      const pix = data?.pix || null;
      setPixResult(pix);
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
          setMsg?.("✅ Pagamento aprovado. Seu plano foi ativado.");
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

  if (!methods) return <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Carregando formas de pagamento…</p>;

  if (!methods.pagamento_online) {
    return (
      <div className="plan-payment-offline">
        <p style={{ fontSize: 13 }}>{PUBLIC_MESSAGES.checkoutModalBody}</p>
      </div>
    );
  }

  const showCard = methods.metodos?.cartao;
  const showBrick = methods.cartao_brick && methods.public_key;
  const showSandbox = methods.cartao_sandbox && !showBrick;
  const amountReais = amountCentavos ? amountCentavos / 100 : 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="plan-payment-methods">
        <h3 className="plan-section-title">Forma de pagamento</h3>
        <div className="plan-pay-cards">
          {methods.metodos?.pix && (
            <button
              type="button"
              className={`plan-pay-card ${metodo === "pix" ? "active" : ""}`}
              onClick={() => { setMetodo("pix"); setPixResult(null); }}
            >
              <span className="plan-pay-card-title">PIX</span>
              <span className="plan-pay-card-desc">Pagamento instantâneo</span>
            </button>
          )}

          {showCard ? (
            <button
              type="button"
              className={`plan-pay-card ${metodo === "cartao" ? "active" : ""}`}
              onClick={() => { setMetodo("cartao"); setPixResult(null); }}
            >
              <span className="plan-pay-card-title">Cartão de crédito</span>
              <span className="plan-pay-card-desc">
                {showSandbox ? "Homologação (sandbox)" : "Pagamento com cartão"}
              </span>
            </button>
          ) : (
            <div className="plan-pay-card disabled">
              <span className="plan-pay-card-title">Cartão de crédito</span>
              <span className="plan-pay-card-desc">
                {methods.metodos?.cartao === false && methods.cartao_habilitado
                  ? "Configure a chave pública no Super Admin"
                  : "Em breve"}
              </span>
            </div>
          )}

          <div className="plan-pay-card disabled">
            <span className="plan-pay-card-title">Boleto</span>
            <span className="plan-pay-card-desc">Em breve</span>
          </div>
        </div>

        {/* ── PIX ─────────────────────────────────────────────────── */}
        {metodo === "pix" && methods.metodos?.pix && (
          <>
            {!pixResult && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy === "pix-pay" || !planoSlug}
                onClick={payPix}
              >
                {busy === "pix-pay" ? "Gerando PIX…" : "Gerar cobrança PIX"}
              </button>
            )}

            {pixResult && (
              <PixResult
                pix={pixResult}
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            )}
          </>
        )}

        {/* ── Cartão ──────────────────────────────────────────────── */}
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
              <p className="admin-card-hint" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                Configure a chave pública do Mercado Pago no Super Admin → aba Mercado Pago → campo <strong>Public Key</strong>.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
