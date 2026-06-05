import { useEffect, useState } from "react";
import { adminApi } from "../api.js";

/** Alerta vermelho no Super Admin quando itens críticos estão ausentes. */
export default function AdminCriticalAlerts() {
  const [alerts, setAlerts] = useState(null);

  useEffect(() => {
    adminApi
      .criticalAlerts()
      .then((data) => setAlerts(data))
      .catch(() => setAlerts({ ok: true, alerts: [] }));
  }, []);

  if (!alerts || alerts.ok || !alerts.alerts?.length) return null;

  return (
    <div
      className="alert alert-warn"
      style={{
        margin: "0 0 16px",
        borderColor: "var(--danger, #dc2626)",
        background: "oklch(0.97 0.02 25)",
        color: "var(--danger, #b91c1c)",
      }}
      role="alert"
    >
      <strong>Release Candidate — pendências críticas:</strong>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>
        {alerts.alerts.map((a) => (
          <li key={a.label}>{a.message}</li>
        ))}
      </ul>
    </div>
  );
}
