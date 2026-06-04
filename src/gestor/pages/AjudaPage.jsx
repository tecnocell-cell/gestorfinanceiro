import { useGestor } from "../GestorContext.jsx";
import { isPessoaFisica } from "../profileLabels.js";
import PfPageShell from "../components/pf/PfPageShell.jsx";
import { HELP_PF, HELP_PJ } from "../helpContent.js";

function Conteudo({ onNavigate, isPF }) {
  const topics = isPF ? HELP_PF : HELP_PJ;

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div className="card-title">Central de Ajuda</div>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 16 }}>
        Guias rápidos para começar. Precisa de atendimento? Abra um chamado em Suporte.
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        {topics.map((t) => (
          <div
            key={t.id}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid oklch(0.92 0.02 150)",
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{t.title}</div>
            <p style={{ fontSize: 13, margin: "0 0 10px", color: "var(--muted-foreground)" }}>
              {t.body}
            </p>
            {onNavigate && t.page && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onNavigate(t.page)}>
                Ir para {t.title}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AjudaPage({ pfMode, onNavigate }) {
  const { tipo } = useGestor();
  const isPF = pfMode || isPessoaFisica(tipo);

  if (isPF) {
    return (
      <PfPageShell title="Ajuda" subtitle="Guias para finanças pessoais">
        <Conteudo onNavigate={onNavigate} isPF />
      </PfPageShell>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Ajuda</h1>
        <p className="page-subtitle">Guias para sua empresa</p>
      </div>
      <Conteudo onNavigate={onNavigate} isPF={false} />
    </div>
  );
}
