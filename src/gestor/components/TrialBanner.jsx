import { useMemo } from "react";
import { Sparkles } from "./icons.jsx";

function daysUntil(ref) {
  if (!ref) return null;
  const end = new Date(ref);
  end.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((end - now) / 86400000);
}

/**
 * Banner amigável para trial (7 / 3 / 1 dia).
 */
export default function TrialBanner({ assinatura, onGoPortal }) {
  const info = useMemo(() => {
    if (!assinatura || assinatura.status !== "trial" || !assinatura.trial_ate) {
      return null;
    }
    const dias = daysUntil(assinatura.trial_ate);
    if (dias == null || dias < 0) {
      return {
        tone: "danger",
        title: "Seu período de teste terminou",
        body: "Ative um plano no Portal do Cliente para continuar com todos os recursos.",
      };
    }
    if (dias === 0) {
      return {
        tone: "danger",
        title: "Último dia do seu trial",
        body: "Hoje é o último dia de teste. Escolha um plano para não perder o acesso completo.",
      };
    }
    if (dias <= 3) {
      return {
        tone: "warn",
        title: `Faltam ${dias} dia${dias > 1 ? "s" : ""} de trial`,
        body: `Seu teste termina em ${new Date(assinatura.trial_ate).toLocaleDateString("pt-BR")}. Contrate seu plano com antecedência.`,
      };
    }
    if (dias <= 7) {
      return {
        tone: "info",
        title: `Faltam ${dias} dias de trial`,
        body: "Explore o Fluxiva e, quando estiver pronto, ative seu plano no Portal do Cliente.",
      };
    }
    return null;
  }, [assinatura]);

  if (!info) return null;

  return (
    <div className={`trial-banner trial-banner--${info.tone}`} role="status">
      <div className="trial-banner-icon" aria-hidden>
        <Sparkles size={20} strokeWidth={2} />
      </div>
      <div className="trial-banner-text">
        <strong>{info.title}</strong>
        <p>{info.body}</p>
      </div>
      {onGoPortal && (
        <button type="button" className="btn btn-primary btn-sm" onClick={onGoPortal}>
          Ver planos
        </button>
      )}
    </div>
  );
}
