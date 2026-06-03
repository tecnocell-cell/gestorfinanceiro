import { useEffect, useState } from "react";
import { billingApi } from "../api.js";
import { AlertTriangle } from "./icons.jsx";

const FEATURE_LABELS = {
  openFinance: "Open Finance automático (Pluggy)",
  integracaoPfPj: "Integração PF/PJ",
  projetos: "Projetos financeiros",
  centroCusto: "Centros de custo",
  whatsappAudio: "WhatsApp com áudio",
  whatsappComprovante: "WhatsApp com comprovante",
  iaComprovante: "Leitura de comprovante por IA",
};

const LIMIT_LABELS = {
  lancamentos: "lançamentos",
  clientes: "clientes",
  projetos: "projetos",
  centrosCusto: "centros de custo",
  whatsappNumeros: "números WhatsApp",
};

function goToPlanos() {
  window.dispatchEvent(new CustomEvent("gestor-navigate", { detail: { page: "plano-assinatura" } }));
}

/**
 * @param {{ feature?: string, limitKey?: string, className?: string }} props
 * feature — flag booleana (projetos, centroCusto, integracaoPfPj, openFinance)
 * limitKey — chave em uso/limites (lancamentos, clientes, projetos, centrosCusto, whatsappNumeros)
 */
export default function PlanLimitNotice({ feature, limitKey, className = "" }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    billingApi
      .usage()
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !usage) return null;

  let message = null;

  if (feature) {
    const key = feature === "centrosCusto" ? "centroCusto" : feature;
    if (!usage.recursos?.[key]) {
      message = "Seu plano atual não inclui este recurso.";
    }
  }

  if (!message && limitKey) {
    const lim = usage.limites?.[limitKey];
    const usado = usage.uso?.[limitKey];
    if (lim != null && usado != null && usado >= lim) {
      message = "Você atingiu o limite do seu plano.";
    }
  }

  if (!message) return null;

  const detail =
    feature && FEATURE_LABELS[feature]
      ? FEATURE_LABELS[feature]
      : limitKey && LIMIT_LABELS[limitKey]
        ? LIMIT_LABELS[limitKey]
        : null;

  return (
    <div
      className={`card ${className}`.trim()}
      style={{
        marginBottom: 16,
        borderColor: "var(--amber-dark, #b45309)",
        background: "oklch(0.98 0.02 85)",
      }}
      role="status"
    >
      <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
        <AlertTriangle size={16} strokeWidth={2} aria-hidden />
        Limite do plano
      </div>
      <p style={{ fontSize: 13, margin: "0 0 10px", color: "var(--muted)" }}>
        {message}
        {detail ? ` (${detail})` : ""}
      </p>
      <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={goToPlanos}>
        Ver planos
      </button>
    </div>
  );
}
