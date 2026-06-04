import { isOnboardingDone } from "../onboarding.js";

export default function OnboardingDashboardCard({ empresa, isPF, onContinue }) {
  if (!empresa || isOnboardingDone(empresa)) return null;

  return (
    <div
      className="card"
      style={{
        marginBottom: 16,
        border: "1px solid oklch(0.88 0.04 155)",
        background: "linear-gradient(145deg, oklch(0.98 0.02 150), oklch(0.96 0.03 155))",
      }}
    >
      <div className="card-title" style={{ fontSize: 15 }}>Configure sua conta</div>
      <p style={{ fontSize: 13, margin: "0 0 12px", color: "var(--muted-foreground)" }}>
        Complete os primeiros passos para aproveitar o Fluxiva — você pode usar o sistema enquanto isso.
      </p>
      <button type="button" className="btn btn-primary" onClick={onContinue}>
        Continuar configuração
      </button>
    </div>
  );
}
