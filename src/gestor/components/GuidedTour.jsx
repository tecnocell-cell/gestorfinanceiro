/** Tour guiado primeiro acesso — Etapa 7.2 */
import { useState, useEffect } from "react";

const STEPS_PF = [
  { page: "dashboard", title: "Dashboard", desc: "Visão do período: saldo, receitas e despesas." },
  { page: "lancamentos", title: "Lançamentos", desc: "Registre entradas e saídas — base do seu controle." },
  { page: "whatsapp", title: "WhatsApp", desc: "Envie lançamentos por mensagem quando disponível." },
  { page: "plano-assinatura", title: "Plano", desc: "Portal do Cliente: plano, faturas e uso." },
];

const STEPS_PJ = [
  { page: "dashboard", title: "Dashboard", desc: "Indicadores da empresa no período." },
  { page: "lancamentos", title: "Lançamentos", desc: "Movimentações financeiras da empresa." },
  { page: "whatsapp", title: "WhatsApp", desc: "Lançamentos por mensagem com confirmação." },
  { page: "plano-assinatura", title: "Plano", desc: "Assinatura, faturas e limites do plano." },
];

export default function GuidedTour({ isPF, onNavigate, onDone }) {
  const steps = isPF ? STEPS_PF : STEPS_PJ;
  const [idx, setIdx] = useState(0);
  const step = steps[idx];

  useEffect(() => {
    if (step?.page && onNavigate) onNavigate(step.page);
  }, [idx, step?.page, onNavigate]);

  if (!step) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          background: "#fff",
          borderRadius: 16,
          padding: "20px 22px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", margin: "0 0 6px" }}>
          Tour · {idx + 1} de {steps.length}
        </p>
        <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>{step.title}</h3>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--muted-foreground)" }}>{step.desc}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {idx > 0 && (
            <button type="button" className="btn btn-secondary" onClick={() => setIdx((i) => i - 1)}>
              Voltar
            </button>
          )}
          {idx < steps.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={() => setIdx((i) => i + 1)}>
              Próximo
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onDone}>
              Entendi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
