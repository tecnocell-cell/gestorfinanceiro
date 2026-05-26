import { useEffect, useMemo, useState } from "react";
import { useGestor } from "../../GestorContext.jsx";
import { fmtBRL, fmtDate } from "../../finance.js";
import { getPendingDueItems, playDueAlertSound } from "../../pfDueDates.js";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// urgência: "vermelho" = atrasado ou ≤ 3 dias | "laranja" = 4–7 dias
function getUrgencia(item) {
  if (item.atrasado || item.diasRestantes <= 3) return "vermelho";
  return "laranja";
}

function DueItemRow({ item }) {
  const urgencia = getUrgencia(item);
  const isVermelho = urgencia === "vermelho";

  const rowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderRadius: 8,
    marginBottom: 6,
    borderLeft: `4px solid ${isVermelho ? "#ef4444" : "#f97316"}`,
    background: isVermelho ? "rgba(239,68,68,0.07)" : "rgba(249,115,22,0.07)",
  };

  const dotStyle = {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: isVermelho ? "#ef4444" : "#f97316",
    marginRight: 6,
    flexShrink: 0,
  };

  let subLabel;
  if (item.atrasado) {
    subLabel = `${Math.abs(item.diasRestantes)} dia(s) de atraso`;
  } else if (item.hoje) {
    subLabel = "vence hoje";
  } else {
    subLabel = `vence em ${item.diasRestantes} dia(s)`;
  }

  return (
    <div style={rowStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
        <span style={dotStyle} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.descricao}
          </div>
          <div style={{ fontSize: 11, color: isVermelho ? "#ef4444" : "#f97316", marginTop: 2 }}>
            {fmtDate(item.vencimento)} · {subLabel}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: isVermelho ? "#ef4444" : "#f97316", whiteSpace: "nowrap", marginLeft: 12 }}>
        {fmtBRL(item.valor)}
      </div>
    </div>
  );
}

export default function PfDueAlert() {
  const { lancamentos, planoContas } = useGestor();
  const [visible, setVisible] = useState(false);

  // Janela de 7 dias: vermelho ≤3, laranja 4–7
  const dueItems = useMemo(
    () => getPendingDueItems(lancamentos, planoContas, 7),
    [lancamentos, planoContas]
  );

  useEffect(() => {
    if (dueItems.length === 0) return;

    const key = `due_alert_${todayKey()}`;
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    } catch { /* ignore */ }

    playDueAlertSound();
    setVisible(true);
  }, [dueItems.length]);

  if (!visible || dueItems.length === 0) return null;

  const atrasados  = dueItems.filter((d) => d.atrasado);
  const vermelhos  = dueItems.filter((d) => !d.atrasado && d.diasRestantes <= 3);
  const laranjas   = dueItems.filter((d) => !d.atrasado && d.diasRestantes > 3);

  const totalVermelho = atrasados.length + vermelhos.length;
  const totalLaranja  = laranjas.length;

  return (
    <div
      className="modal-backdrop"
      style={{ zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget) setVisible(false); }}
    >
      <div
        className="modal"
        style={{ maxWidth: 460, width: "100%", borderRadius: 14, overflow: "hidden" }}
      >
        {/* Cabeçalho */}
        <div style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <span>⏰</span>
              <span>Vencimentos próximos</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4, display: "flex", gap: 12 }}>
              {totalVermelho > 0 && (
                <span style={{ color: "#ef4444", fontWeight: 600 }}>
                  🔴 {totalVermelho} urgente{totalVermelho !== 1 ? "s" : ""}
                </span>
              )}
              {totalLaranja > 0 && (
                <span style={{ color: "#f97316", fontWeight: 600 }}>
                  🟠 {totalLaranja} em atenção
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setVisible(false)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 18, color: "var(--muted-foreground)", lineHeight: 1, padding: 4,
            }}
            aria-label="Fechar"
          >✕</button>
        </div>

        {/* Corpo */}
        <div style={{ padding: "14px 20px", maxHeight: 360, overflowY: "auto" }}>

          {/* Atrasadas */}
          {atrasados.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#ef4444", marginBottom: 6 }}>
                ⚠ Atrasadas
              </div>
              {atrasados.map((item) => <DueItemRow key={item.id} item={item} />)}
            </div>
          )}

          {/* Vencem em até 3 dias */}
          {vermelhos.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#ef4444", marginBottom: 6 }}>
                🔴 Vencem em até 3 dias
              </div>
              {vermelhos.map((item) => <DueItemRow key={item.id} item={item} />)}
            </div>
          )}

          {/* Vencem em 4–7 dias */}
          {laranjas.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#f97316", marginBottom: 6 }}>
                🟠 Vencem em 4–7 dias
              </div>
              {laranjas.map((item) => <DueItemRow key={item.id} item={item} />)}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
        }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setVisible(false)}
          >
            Fechar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setVisible(false)}
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
