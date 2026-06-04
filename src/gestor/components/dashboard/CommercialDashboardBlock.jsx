import { useEffect, useState } from "react";
import { billingApi } from "../../api.js";
import { usageMetric } from "../../planBillingUi.js";

const STATUS_LABEL = {
  trial: "Período de teste",
  ativa: "Ativa",
  atrasada: "Em atraso",
  cancelada: "Cancelada",
  vencida: "Vencida",
};

function fmtDate(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

function fmtBRL(centavos) {
  if (centavos == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    centavos / 100
  );
}

/**
 * Bloco comercial no dashboard (PF ou PJ) — Etapa 7.6
 */
export default function CommercialDashboardBlock({ isPF, onNavigate }) {
  const [assinatura, setAssinatura] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sub, uso] = await Promise.all([
          billingApi.assinatura(),
          billingApi.usage().catch(() => null),
        ]);
        if (!cancelled) {
          setAssinatura(sub.assinatura);
          setUsage(uso);
        }
      } catch {
        /* sem bloquear dashboard */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="card commercial-dash-card">
        <div className="card-title">Sua assinatura</div>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>Carregando…</p>
      </div>
    );
  }

  if (!assinatura) return null;

  const venc =
    assinatura.status === "trial"
      ? assinatura.trial_ate
      : assinatura.proxima_cobranca;
  const usuarios = usageMetric(usage?.uso?.usuarios, true);
  const whatsapp = usageMetric(usage?.uso?.whatsappNumeros, false);
  const waLim = usage?.limites?.whatsappNumeros ?? whatsapp.limite;

  return (
    <div className="card commercial-dash-card">
      <div className="card-title" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span>Sua assinatura</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onNavigate?.("plano-assinatura")}
        >
          Portal do Cliente
        </button>
      </div>
      <div className="commercial-dash-grid">
        <div>
          <div className="commercial-dash-label">Plano</div>
          <div className="commercial-dash-value">{assinatura.plano?.nome || "—"}</div>
        </div>
        <div>
          <div className="commercial-dash-label">Status</div>
          <div className="commercial-dash-value">
            <span className={`sub-status-pill sub-status-pill--${assinatura.status}`}>
              {STATUS_LABEL[assinatura.status] || assinatura.status}
            </span>
          </div>
        </div>
        <div>
          <div className="commercial-dash-label">
            {assinatura.status === "trial" ? "Trial até" : "Próximo vencimento"}
          </div>
          <div className="commercial-dash-value">{fmtDate(venc)}</div>
        </div>
        <div>
          <div className="commercial-dash-label">Valor mensal</div>
          <div className="commercial-dash-value">
            {fmtBRL(assinatura.plano?.preco_centavos)}
          </div>
        </div>
        {!isPF && (
          <div>
            <div className="commercial-dash-label">Equipe</div>
            <div className="commercial-dash-value">
              {usuarios.limite != null
                ? `${usuarios.usado} / ${usuarios.limite}`
                : usuarios.usado}
            </div>
          </div>
        )}
        <div>
          <div className="commercial-dash-label">WhatsApp</div>
          <div className="commercial-dash-value">
            {waLim != null ? `${whatsapp.usado} / ${waLim}` : whatsapp.usado}
          </div>
        </div>
      </div>
    </div>
  );
}
