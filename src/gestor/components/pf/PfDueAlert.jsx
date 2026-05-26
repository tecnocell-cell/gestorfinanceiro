import { useEffect, useMemo, useState } from "react";
import { useGestor } from "../../GestorContext.jsx";
import { fmtBRL, fmtDate } from "../../finance.js";
import { getPendingDueItems, playDueAlertSound } from "../../pfDueDates.js";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function DueItemRow({ item }) {
  return (
    <div className={`pf-due-item${item.atrasado ? " pf-due-item-late" : ""}`}>
      <div>
        <div className="pf-due-item-title">{item.descricao}</div>
        <div className="pf-due-item-sub">
          {fmtDate(item.vencimento)}
          {item.atrasado
            ? ` · ${Math.abs(item.diasRestantes)} dia(s) de atraso`
            : item.hoje
              ? " · vence hoje"
              : ` · em ${item.diasRestantes} dia(s)`}
        </div>
      </div>
      <div className="pf-due-item-valor">{fmtBRL(item.valor)}</div>
    </div>
  );
}

export default function PfDueAlert() {
  const { lancamentos, planoContas } = useGestor();
  const [visible, setVisible] = useState(false);

  const dueItems = useMemo(
    () => getPendingDueItems(lancamentos, planoContas, 3),
    [lancamentos, planoContas]
  );

  useEffect(() => {
    if (dueItems.length === 0) return;

    const key = `pf_due_alert_${todayKey()}`;
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    } catch { /* ignore */ }

    playDueAlertSound();
    setVisible(true);
  }, [dueItems.length]);

  if (!visible || dueItems.length === 0) return null;

  const atrasados = dueItems.filter((d) => d.atrasado);
  const proximos = dueItems.filter((d) => !d.atrasado);

  return (
    <div className="modal-backdrop pf-due-backdrop">
      <div className="modal pf-due-modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">⏰ Vencimentos próximos</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>
              {dueItems.length} conta{dueItems.length > 1 ? "s" : ""} para vencer em até 3 dias
            </p>
          </div>
        </div>
        <div className="modal-body" style={{ paddingTop: 12 }}>
          {atrasados.length > 0 && (
            <div className="pf-due-group">
              <div className="pf-due-group-label pf-due-late">Atrasadas</div>
              {atrasados.map((item) => <DueItemRow key={item.id} item={item} />)}
            </div>
          )}
          {proximos.length > 0 && (
            <div className="pf-due-group">
              <div className="pf-due-group-label">Próximas</div>
              {proximos.map((item) => <DueItemRow key={item.id} item={item} />)}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={() => setVisible(false)}>
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
