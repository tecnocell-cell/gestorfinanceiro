import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../admin/AdminLayout.jsx";
import AdminSection from "../admin/AdminSection.jsx";
import AdminCriticalAlerts from "../admin/AdminCriticalAlerts.jsx";
import { adminApi } from "../api.js";

const TABS = [
  { id: "checklist", label: "Checklist RC" },
  { id: "pix", label: "Teste PIX" },
  { id: "cliente", label: "Teste guiado cliente" },
];

function SeverityBadge({ severity }) {
  const map = {
    critical: { label: "Crítico", cls: "admin-wa-pill--off" },
    warning: { label: "Aviso", cls: "admin-wa-pill--warn" },
    optional: { label: "Opcional", cls: "admin-wa-pill--ok" },
  };
  const s = map[severity] || map.optional;
  return <span className={`admin-wa-pill ${s.cls}`} style={{ marginRight: 8 }}>{s.label}</span>;
}

function StatusItem({ label, ok, detail, warn, severity }) {
  const tone = ok ? "ok" : warn || severity === "warning" ? "warn" : severity === "optional" ? "ok" : "err";
  return (
    <div className={`admin-status-row admin-status-row--${tone}`}>
      <span className="admin-status-label">
        {severity && <SeverityBadge severity={severity} />}
        {label}
      </span>
      <span className="admin-status-detail">{detail}</span>
    </div>
  );
}

function ClientChecklist({ title, items, segment, onToggle }) {
  return (
    <div className="card admin-inner-card">
      <div className="card-title">{title}</div>
      <ul className="admin-checklist">
        {items.map((item) => (
          <li key={item.key}>
            <label className="admin-checklist-label">
              <input
                type="checkbox"
                checked={!!item.checked}
                onChange={(e) => onToggle(segment, item.key, e.target.checked)}
              />
              <span>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function fmtBRL(centavos) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (centavos || 0) / 100
  );
}

export default function AdminReleaseCandidatePage() {
  const [tab, setTab] = useState("checklist");
  const [rc, setRc] = useState(null);
  const [pix, setPix] = useState(null);
  const [webhooks, setWebhooks] = useState([]);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      adminApi.releaseCandidate(),
      adminApi.rcPixTest(),
      adminApi.clientChecklist(),
    ])
      .then(([rcData, pixData, clientData]) => {
        setRc(rcData);
        setPix(pixData.test);
        setWebhooks(pixData.webhooks || []);
        setClient(clientData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runPixTest = async () => {
    setBusy("pix-create");
    setError(null);
    setMsg(null);
    try {
      const data = await adminApi.createRcPixTest();
      setPix(data.test);
      setWebhooks(data.webhooks || []);
      setMsg("Cobrança de homologação gerada. Não ativa assinatura de cliente.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const consultPix = async () => {
    setBusy("pix-status");
    setError(null);
    try {
      const data = await adminApi.consultRcPixTest();
      setPix(data.test);
      setWebhooks(data.webhooks || []);
      setMsg(`Status: ${data.test?.status_mp || data.test?.status || "—"}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const toggleClient = async (segment, key, checked) => {
    try {
      const data = await adminApi.patchClientChecklist({ segment, key, checked });
      setClient(data);
    } catch (e) {
      setError(e.message);
    }
  };

  const copyPix = () => {
    const text = pix?.pix?.copia_e_cola;
    if (!text) return;
    navigator.clipboard?.writeText(text).then(
      () => setMsg("PIX copiado."),
      () => setMsg(text)
    );
  };

  return (
    <AdminLayout
      title="Release Candidate"
      subtitle="Homologação final antes de clientes reais em produção."
    >
      <AdminCriticalAlerts />

      <div className="admin-tabs admin-payment-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`admin-tab${tab === t.id ? " admin-tab--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-warn">{error}</div>}
      {msg && !error && <div className="alert alert-success">{msg}</div>}
      {loading && <p className="admin-loading">Carregando…</p>}

      {!loading && tab === "checklist" && rc && (
        <AdminSection
          title="Checklist obrigatório"
          description={
            rc.ready
              ? "Itens críticos OK — revise avisos antes do go-live."
              : `${rc.criticalMissing?.length || 0} item(ns) crítico(s) pendente(s).`
          }
        >
          <div className="card admin-inner-card">
            {rc.checks.map((c) => (
              <StatusItem
                key={c.id}
                label={c.label}
                ok={c.ok}
                detail={c.detail}
                warn={c.severity === "warning" && !c.ok}
                severity={c.severity}
              />
            ))}
          </div>
          {rc.smtp && (
            <div className="card admin-inner-card" style={{ marginTop: 12 }}>
              <div className="card-title">SMTP / E-mail</div>
              <p style={{ fontSize: 13, margin: "0 0 8px" }}>
                Provedor esperado: <strong>{rc.smtp.provider_expected}</strong>
                {" · "}Status: <strong>{rc.smtp.detected}</strong>
              </p>
              <p className="admin-card-hint" style={{ margin: "0 0 8px" }}>
                Variáveis necessárias: {rc.smtp.variables_required?.join(", ")}
              </p>
              <pre className="admin-payment-json-preview" style={{ fontSize: 11 }}>
                {JSON.stringify(rc.smtp.variables, null, 2)}
              </pre>
            </div>
          )}
          <p className="admin-card-hint" style={{ marginTop: 12 }}>
            Webhook MP: <code>{rc.mpWebhookUrl}</code>
            {rc.publicApiUrl && (
              <>
                {" · "}
                API pública: <code>{rc.publicApiUrl}</code>
              </>
            )}
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
            Atualizar checklist
          </button>
        </AdminSection>
      )}

      {!loading && tab === "pix" && (
        <AdminSection
          title="Testar PIX Mercado Pago"
          description="Cobrança R$ 0,01 de homologação — não ativa assinatura real."
        >
          <div className="card admin-inner-card">
            <div className="admin-card-actions" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!!busy}
                onClick={runPixTest}
              >
                {busy === "pix-create" ? "Gerando…" : "Testar PIX Mercado Pago"}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!!busy || !pix?.payment_id}
                onClick={consultPix}
              >
                {busy === "pix-status" ? "Consultando…" : "Consultar status"}
              </button>
            </div>

            {pix ? (
              <>
                <p style={{ fontSize: 13, margin: "0 0 8px" }}>
                  <strong>{fmtBRL(pix.valor_centavos)}</strong>
                  {" · "}Status: {pix.status_mp || pix.status || "—"}
                  {" · "}ID: <code>{pix.payment_id}</code>
                </p>
                {pix.pix?.qr_code_base64 && (
                  <img
                    src={`data:image/png;base64,${pix.pix.qr_code_base64}`}
                    alt="QR PIX homologação"
                    style={{ maxWidth: 180, display: "block", marginBottom: 8 }}
                  />
                )}
                {pix.pix?.copia_e_cola ? (
                  <textarea
                    readOnly
                    rows={3}
                    value={pix.pix.copia_e_cola}
                    style={{ width: "100%", fontSize: 11, marginBottom: 8 }}
                  />
                ) : null}
                {pix.pix?.copia_e_cola && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={copyPix}>
                    Copiar PIX
                  </button>
                )}
                <p className="admin-card-hint" style={{ marginTop: 10 }}>
                  {pix.note}
                </p>
              </>
            ) : (
              <p className="admin-empty">Nenhum teste PIX gerado ainda.</p>
            )}
          </div>

          <div className="card admin-inner-card" style={{ marginTop: 12 }}>
            <div className="card-title">Checklist PIX real (homologação)</div>
            <ul className="admin-checklist">
              {(rc?.pix_go_live_checklist || []).map((item) => (
                <li key={item.key}>
                  <label className="admin-checklist-label">
                    <input type="checkbox" readOnly />
                    <span>{item.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="admin-card-hint">Marque manualmente após teste em sandbox ou produção.</p>
          </div>

          <div className="card admin-inner-card" style={{ marginTop: 12 }}>
            <div className="card-title">Últimos webhooks Mercado Pago</div>
            {webhooks.length === 0 ? (
              <p className="admin-empty">Nenhum webhook registrado.</p>
            ) : (
              <ul className="saas-mini-list admin-log-list">
                {webhooks.map((w) => (
                  <li key={w.id}>
                    {w.evento}
                    <span className="admin-log-time">
                      {w.created_at ? new Date(w.created_at).toLocaleString("pt-BR") : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </AdminSection>
      )}

      {!loading && tab === "cliente" && client && (
        <AdminSection
          title="Teste guiado do cliente"
          description={`Progresso: ${client.progress?.done}/${client.progress?.total} (${client.progress?.percent}%)`}
        >
          <div className="grid-2">
            <ClientChecklist
              title="Checklist PF"
              items={client.pf}
              segment="pf"
              onToggle={toggleClient}
            />
            <ClientChecklist
              title="Checklist PJ"
              items={client.pj}
              segment="pj"
              onToggle={toggleClient}
            />
          </div>
        </AdminSection>
      )}
    </AdminLayout>
  );
}
