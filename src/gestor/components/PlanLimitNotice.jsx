import { useEffect, useState } from "react";
import { billingApi } from "../api.js";
import { PUBLIC_MESSAGES, FEATURE_LABELS, sanitizePublicMessage } from "../planRules.js";
import { AlertTriangle } from "./icons.jsx";

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

const NOTICE_STYLE = {
  marginBottom: 16,
  border: "1px solid oklch(0.88 0.02 85)",
  background: "oklch(0.98 0.015 95)",
  color: "oklch(0.28 0.03 155)",
};

/**
 * @param {{ feature?: string, limitKey?: string, className?: string }} props
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
      message = PUBLIC_MESSAGES.planBlocked;
    }
  }

  if (!message && limitKey) {
    const lim = usage.limites?.[limitKey];
    const usado = usage.uso?.[limitKey];
    if (lim != null && usado != null && usado >= lim) {
      message = PUBLIC_MESSAGES.whatsappLimit;
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
    <div className={`card plan-limit-notice ${className}`.trim()} style={NOTICE_STYLE} role="status">
      <div
        className="card-title"
        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "inherit" }}
      >
        <AlertTriangle size={16} strokeWidth={2} aria-hidden />
        Limite do plano
      </div>
      <p style={{ fontSize: 13, margin: "0 0 10px", color: "inherit" }}>
        {sanitizePublicMessage(message)}
        {detail ? ` — ${detail}` : ""}
      </p>
      <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} onClick={goToPlanos}>
        Ver planos
      </button>
    </div>
  );
}
