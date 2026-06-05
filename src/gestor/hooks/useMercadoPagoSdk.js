import { useEffect, useState } from "react";

const SDK_URL = "https://sdk.mercadopago.com/js/v2";
let sdkPromise = null;

function loadSdkScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("SDK indisponível no servidor."));
  }
  if (window.MercadoPago) return Promise.resolve(window.MercadoPago);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${SDK_URL}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(window.MercadoPago));
        existing.addEventListener("error", () => reject(new Error("Falha ao carregar Mercado Pago.")));
        return;
      }
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => resolve(window.MercadoPago);
      script.onerror = () => reject(new Error("Falha ao carregar Mercado Pago."));
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

/**
 * Carrega o SDK oficial do Mercado Pago (Payment Brick).
 */
export function useMercadoPagoSdk(enabled) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      setError(null);
      return;
    }
    let cancelled = false;
    loadSdkScript()
      .then(() => {
        if (!cancelled) {
          setReady(true);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setReady(false);
          setError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { ready, error, loadSdk: loadSdkScript };
}

export { loadSdkScript };
