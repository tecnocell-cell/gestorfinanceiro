import { useState, useEffect, useCallback } from "react";
import { adminApi } from "../api.js";
import AdminSection from "./AdminSection.jsx";

function StatusRow({ label, ok, detail, warn }) {
  const tone = ok ? "ok" : warn ? "warn" : "err";
  return (
    <div className={`admin-status-row admin-status-row--${tone}`}>
      <span className="admin-status-label">{label}</span>
      <span className="admin-status-detail">{detail}</span>
    </div>
  );
}

function BetaChecklist({ title, items, segment, onToggle }) {
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

/** panel: 'producao' | 'beta' | 'logs' */
export default function AdminGoLiveSection({ panel = "producao" }) {
  const [goLive, setGoLive] = useState(null);
  const [prod, setProd] = useState(null);
  const [beta, setBeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([adminApi.goLive(), adminApi.productionCheck(), adminApi.betaHomologacao()])
      .then(([gl, pc, b]) => {
        setGoLive(gl);
        setProd(pc);
        setBeta(b);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleBeta = async (segment, key, checked) => {
    try {
      const data = await adminApi.patchBetaHomologacao({ segment, key, checked });
      setBeta(data);
    } catch (e) {
      setError(e.message);
    }
  };

  const showProducao = panel === "producao";
  const showBeta = panel === "beta";
  const showLogs = panel === "logs";

  if (loading) return <p className="admin-loading">Carregando homologação…</p>;
  if (error) return <div className="alert alert-warn">{error}</div>;
  if (!goLive) return null;

  return (
    <div className="admin-homolog-panel">
      {showProducao && (
        <AdminSection title="Status do ambiente" description="Serviços necessários para vender com segurança.">
          <div className="card admin-inner-card">
            <StatusRow
              label="E-mail transacional"
              ok={goLive.email?.configured}
              detail={goLive.email?.message}
              warn={!goLive.email?.configured}
            />
            <StatusRow
              label="Cobrança online"
              ok={goLive.billing?.configured}
              detail={goLive.billing?.message}
            />
            <StatusRow
              label="Confirmação de pagamentos"
              ok={goLive.webhook?.tokenConfigured}
              detail={
                goLive.webhook?.tokenConfigured
                  ? "Configurado"
                  : "Pendente — confirme no painel de cobrança"
              }
              warn={!goLive.webhook?.tokenConfigured}
            />
            <StatusRow
              label="WhatsApp sistema"
              ok={goLive.whatsapp?.configured}
              detail={goLive.whatsapp?.message}
              warn={!goLive.whatsapp?.configured}
            />
            <StatusRow
              label="Backup"
              ok={goLive.backup?.configured}
              detail={goLive.backup?.message}
              warn={!goLive.backup?.configured}
            />
          </div>
        </AdminSection>
      )}

      {showProducao && prod && (
        <AdminSection
          title="Checklist de produção"
          description={
            prod.ok
              ? "Todos os itens obrigatórios estão OK."
              : `${prod.blockingCount} pendência(s) antes do go-live.`
          }
        >
          <div className="card admin-inner-card">
            <ul className="admin-prod-checklist">
              {prod.checks.map((c) => (
                <li key={c.id} className={`admin-prod-item admin-prod-item--${c.ok ? "ok" : c.warnOnly ? "warn" : "err"}`}>
                  <span className="admin-prod-icon">{c.ok ? "✓" : c.warnOnly ? "!" : "✗"}</span>
                  <span>
                    <strong>{c.label}</strong> — {c.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </AdminSection>
      )}

      {showLogs && (
        <AdminSection title="Auditoria" description="Últimos eventos de cobrança e integrações.">
          <div className="admin-logs-grid">
            <div className="card admin-inner-card">
              <div className="card-title">Eventos de cobrança</div>
              {goLive.recentOps?.length > 0 ? (
                <ul className="saas-mini-list admin-log-list">
                  {goLive.recentOps.slice(0, 20).map((l) => (
                    <li key={l.id}>
                      <strong>{l.tipo}</strong>
                      {l.usuario_id ? ` · ${String(l.usuario_id).slice(0, 8)}…` : ""}
                      <span className="admin-log-time">
                        {new Date(l.created_at).toLocaleString("pt-BR")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-empty">Nenhum registro recente.</p>
              )}
            </div>
            <div className="card admin-inner-card">
              <div className="card-title">Alertas de integração</div>
              {goLive.webhookErrors?.length > 0 ? (
                <ul className="saas-mini-list admin-log-list">
                  {goLive.webhookErrors.map((e, i) => (
                    <li key={i}>
                      {e.evento} — {e.message}
                      <span className="admin-log-time">
                        {new Date(e.at).toLocaleString("pt-BR")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-empty">Nenhum alerta recente.</p>
              )}
            </div>
          </div>
        </AdminSection>
      )}

      {showBeta && beta && (
        <AdminSection
          title="Beta fechado"
          description={`Progresso: ${beta.progress.done} de ${beta.progress.total} (${beta.progress.percent}%)`}
        >
          <div className="admin-beta-grid">
            <BetaChecklist title="Pessoa Física" items={beta.pf} segment="pf" onToggle={toggleBeta} />
            <BetaChecklist title="Pessoa Jurídica" items={beta.pj} segment="pj" onToggle={toggleBeta} />
          </div>
        </AdminSection>
      )}

      <div className="admin-footer-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
          Atualizar
        </button>
      </div>
    </div>
  );
}
