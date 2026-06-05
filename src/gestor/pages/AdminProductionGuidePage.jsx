import { useEffect, useState } from "react";
import AdminLayout from "../admin/AdminLayout.jsx";
import AdminSection from "../admin/AdminSection.jsx";
import AdminCriticalAlerts from "../admin/AdminCriticalAlerts.jsx";
import { adminApi } from "../api.js";

function StatusBadge({ ok }) {
  return (
    <span className={`admin-wa-pill ${ok ? "admin-wa-pill--ok" : "admin-wa-pill--off"}`}>
      {ok ? "OK" : "Pendente"}
    </span>
  );
}

export default function AdminProductionGuidePage() {
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminApi
      .productionGuide()
      .then(setGuide)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout
      title="Guia de Produção"
      subtitle="Runbook operacional — deploy, cobrança, e-mail e WhatsApp."
    >
      <AdminCriticalAlerts />

      {error && <div className="alert alert-warn">{error}</div>}
      {loading && <p className="admin-loading">Carregando guia…</p>}

      {!loading && guide && (
        <>
          <AdminSection title="Status do ambiente" description="Validação rápida dos serviços citados no guia.">
            <div className="card admin-inner-card">
              <div className="admin-payment-card-head" style={{ marginBottom: 8 }}>
                <span>Mercado Pago</span>
                <StatusBadge ok={guide.status?.mercado_pago} />
              </div>
              <div className="admin-payment-card-head" style={{ marginBottom: 8 }}>
                <span>PUBLIC_API_URL</span>
                <StatusBadge ok={guide.status?.public_api_url} />
              </div>
              <div className="admin-payment-card-head" style={{ marginBottom: 8 }}>
                <span>E-mail</span>
                <StatusBadge ok={guide.status?.email} />
              </div>
              <div className="admin-payment-card-head" style={{ marginBottom: 8 }}>
                <span>WhatsApp</span>
                <StatusBadge ok={guide.status?.whatsapp} />
              </div>
              <div className="admin-payment-card-head">
                <span>Admin master</span>
                <StatusBadge ok={guide.status?.admin_master} />
              </div>
              {guide.status?.webhook_url && (
                <p className="admin-card-hint" style={{ marginTop: 12 }}>
                  Webhook MP: <code>{guide.status.webhook_url}</code>
                </p>
              )}
            </div>
          </AdminSection>

          {guide.sections.map((section) => {
            const stKey = section.statusKey;
            const stOk = stKey ? guide.status?.[stKey] : null;
            return (
              <AdminSection key={section.id} title={section.title}>
                <div className="card admin-inner-card">
                  {stKey && (
                    <div style={{ marginBottom: 10 }}>
                      <StatusBadge ok={stOk} />
                    </div>
                  )}
                  <ol className="admin-checklist" style={{ listStyle: "decimal", paddingLeft: 20 }}>
                    {section.steps.map((step, i) => (
                      <li key={i} style={{ marginBottom: 6, fontSize: 13 }}>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </AdminSection>
            );
          })}

          <AdminSection title="Comandos úteis">
            <div className="card admin-inner-card">
              <pre className="admin-payment-json-preview">
                {(guide.commands || []).join("\n")}
              </pre>
            </div>
          </AdminSection>
        </>
      )}
    </AdminLayout>
  );
}
