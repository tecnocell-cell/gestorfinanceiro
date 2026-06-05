import { useEffect, useRef, useState } from "react";
import { loadSdkScript } from "../../hooks/useMercadoPagoSdk.js";

/**
 * Payment Brick oficial Mercado Pago (Etapa 7.8A).
 * Tokeniza cartão no browser — dados sensíveis não passam pelo Fluxiva.
 */
export default function MercadoPagoPaymentBrick({
  publicKey,
  amountReais,
  payerEmail,
  onSubmit,
  onError,
}) {
  const containerId = useRef(`mp-brick-${Math.random().toString(36).slice(2, 9)}`);
  const brickRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState(null);

  useEffect(() => {
    if (!publicKey || !amountReais || amountReais <= 0) return undefined;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setInitError(null);
      try {
        const MercadoPago = await loadSdkScript();
        if (cancelled) return;

        const mp = new MercadoPago(publicKey, { locale: "pt-BR" });
        const bricks = mp.bricks();

        if (brickRef.current?.unmount) {
          try {
            brickRef.current.unmount();
          } catch {
            /* */
          }
        }

        const controller = await bricks.create("payment", containerId.current, {
          initialization: {
            amount: Number(amountReais),
            payer: payerEmail ? { email: payerEmail } : undefined,
          },
          customization: {
            paymentMethods: {
              creditCard: "all",
              debitCard: "all",
              maxInstallments: 12,
            },
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) setLoading(false);
            },
            onSubmit: async ({ formData }) => {
              try {
                await onSubmit({
                  cardToken: formData.token,
                  installments: formData.installments || 1,
                  payment_method_id: formData.payment_method_id,
                  payer: formData.payer,
                });
              } catch (e) {
                onError?.(e);
                throw e;
              }
            },
            onError: (err) => {
              onError?.(new Error(err?.message || "Erro no formulário de pagamento."));
            },
          },
        });

        brickRef.current = controller;
      } catch (e) {
        if (!cancelled) {
          setInitError(e.message || "Não foi possível carregar o formulário de cartão.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (brickRef.current?.unmount) {
        try {
          brickRef.current.unmount();
        } catch {
          /* */
        }
        brickRef.current = null;
      }
    };
  }, [publicKey, amountReais, payerEmail, onSubmit, onError]);

  if (initError) {
    return <div className="alert alert-warn">{initError}</div>;
  }

  return (
    <div className="mp-payment-brick-wrap">
      {loading && <p className="admin-loading">Carregando formulário de cartão…</p>}
      <div id={containerId.current} className="mp-payment-brick-container" />
      <p className="admin-card-hint" style={{ marginTop: 8 }}>
        Pagamento processado pelo Mercado Pago. Não armazenamos dados do cartão.
      </p>
    </div>
  );
}
