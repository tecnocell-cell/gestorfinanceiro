import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../admin/AdminLayout.jsx";
import AdminSection from "../admin/AdminSection.jsx";
import { adminApi } from "../api.js";

const TABS = [
  { id: "checklist", label: "Checklist" },
  { id: "relatorio", label: "Relatório" },
  { id: "logs", label: "Logs" },
];

function SectionChecklist({ section, onToggle }) {
  return (
    <div className="card admin-inner-card">
      <div className="card-title" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span>{section.label}</span>
        <span className="admin-wa-pill admin-wa-pill--ok">
          {section.progress.done}/{section.progress.total}
        </span>
      </div>
      <ul className="admin-checklist">
        {section.items.map((item) => (
          <li key={item.key}>
            <label className="admin-checklist-label">
              <input
                type="checkbox"
                checked={!!item.checked}
                onChange={(e) => onToggle(section.id, item.key, e.target.checked)}
              />
              <span>{item.label}</span>
            </label>
            {item.checked_at && (
              <span className="admin-card-hint" style={{ marginLeft: 26, display: "block" }}>
                {new Date(item.checked_at).toLocaleString("pt-BR")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    aprovado: "admin-wa-pill--ok",
    reprovado: "admin-wa-pill--off",
    pendente: "admin-wa-pill--warn",
  };
  return (
    <span className={`admin-wa-pill ${map[status] || map.pendente}`}>
      {status || "pendente"}
    </span>
  );
}

export default function AdminRealHomologacaoPage() {
  const [tab, setTab] = useState("checklist");
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [metaForm, setMetaForm] = useState({
    usuario_pf: "",
    usuario_pj: "",
    falhas: "",
    status: "pendente",
  });

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    adminApi
      .realHomologacao()
      .then((d) => {
        setData(d);
        setMetaForm({
          usuario_pf: d.meta?.usuario_pf || "",
          usuario_pj: d.meta?.usuario_pj || "",
          falhas: d.meta?.falhas || "",
          status: d.meta?.status || "pendente",
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadReport = useCallback(() => {
    setBusy(true);
    setError(null);
    adminApi
      .realHomologacaoReport()
      .then(setReport)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === "relatorio") loadReport();
  }, [tab, loadReport]);

  const toggle = async (section, key, checked) => {
    try {
      const d = await adminApi.patchRealHomologacao({ section, key, checked });
      setData(d);
      setMetaForm((m) => ({
        ...m,
        usuario_pf: d.meta?.usuario_pf || "",
        usuario_pj: d.meta?.usuario_pj || "",
        falhas: d.meta?.falhas || "",
        status: d.meta?.status || "pendente",
      }));
    } catch (e) {
      setError(e.message);
    }
  };

  const saveMeta = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const d = await adminApi.patchRealHomologacaoMeta(metaForm);
      setData(d);
      setMsg("Metadados salvos.");
      if (tab === "relatorio") await loadReport();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const exportReport = () => {
    if (!report) return;
    const text = JSON.stringify(report, null, 2);
    navigator.clipboard?.writeText(text).then(
      () => setMsg("Relatório copiado (JSON)."),
      () => setMsg(text.slice(0, 500))
    );
  };

  return (
    <AdminLayout
      title="Homologação Real"
      subtitle="Teste ponta a ponta como cliente real antes de abrir o beta."
    >
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

      {!loading && data && tab === "checklist" && (
        <>
          <AdminSection
            title="Progresso geral"
            description={`${data.progress.done} de ${data.progress.total} passos (${data.progress.percent}%)`}
          >
            <div className="card admin-inner-card">
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 4,
                      background: "var(--border)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${data.progress.percent}%`,
                        height: "100%",
                        background: "var(--rn-primary)",
                      }}
                    />
                  </div>
                </div>
                <StatusPill status={data.meta?.status} />
              </div>
            </div>
          </AdminSection>

          <AdminSection title="Usuários de teste e parecer" description="Registre quem testou e o resultado final.">
            <div className="card admin-inner-card">
              <div className="form-grid" style={{ gap: 12 }}>
                <label>
                  <span className="form-label">Usuário PF testado</span>
                  <input
                    className="form-input"
                    value={metaForm.usuario_pf}
                    onChange={(e) => setMetaForm((m) => ({ ...m, usuario_pf: e.target.value }))}
                    placeholder="e-mail ou nome do cliente PF"
                  />
                </label>
                <label>
                  <span className="form-label">Usuário PJ testado</span>
                  <input
                    className="form-input"
                    value={metaForm.usuario_pj}
                    onChange={(e) => setMetaForm((m) => ({ ...m, usuario_pj: e.target.value }))}
                    placeholder="e-mail ou razão social"
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span className="form-label">Falhas encontradas</span>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={metaForm.falhas}
                    onChange={(e) => setMetaForm((m) => ({ ...m, falhas: e.target.value }))}
                    placeholder="Descreva bugs, bloqueios ou regressões"
                  />
                </label>
                <label>
                  <span className="form-label">Status final</span>
                  <select
                    className="form-input"
                    value={metaForm.status}
                    onChange={(e) => setMetaForm((m) => ({ ...m, status: e.target.value }))}
                  >
                    <option value="pendente">Pendente</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="reprovado">Reprovado</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 12 }}
                disabled={busy}
                onClick={saveMeta}
              >
                Salvar parecer
              </button>
            </div>
          </AdminSection>

          <AdminSection title="Cenários obrigatórios" description="Marque cada passo validado manualmente em produção ou sandbox.">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {data.sections.map((section) => (
                <SectionChecklist key={section.id} section={section} onToggle={toggle} />
              ))}
            </div>
          </AdminSection>
        </>
      )}

      {!loading && tab === "relatorio" && (
        <AdminSection title="Relatório de homologação" description="Resumo para go/no-go do beta.">
          {busy && <p className="admin-loading">Gerando relatório…</p>}
          {!busy && report && (
            <div className="card admin-inner-card">
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <div>
                  <div className="card-title" style={{ marginBottom: 4 }}>
                    Status: <StatusPill status={report.status} />
                  </div>
                  <p className="admin-card-hint" style={{ margin: 0 }}>
                    Gerado em {new Date(report.generated_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <button type="button" className="btn btn-secondary" onClick={exportReport}>
                  Copiar relatório
                </button>
              </div>
              <p><strong>Data:</strong> {report.data}</p>
              <p><strong>Usuário PF:</strong> {report.usuario_testado.pf || "—"}</p>
              <p><strong>Usuário PJ:</strong> {report.usuario_testado.pj || "—"}</p>
              <p>
                <strong>Progresso:</strong> {report.progress.done}/{report.progress.total} ({report.progress.percent}%)
              </p>
              {report.falhas_encontradas.texto && (
                <p><strong>Falhas:</strong> {report.falhas_encontradas.texto}</p>
              )}
              <p className="admin-card-hint">
                Sinais: {report.signals.pagamentos_recentes} pagamentos recentes · SMTP {report.signals.smtp || "—"} ·{" "}
                {report.signals.rc_criticos_pendentes} crítico(s) RC
              </p>
              <div className="card-title" style={{ marginTop: 16 }}>Passos concluídos ({report.passos_concluidos.length})</div>
              <ul className="admin-checklist">
                {report.passos_concluidos.map((p) => (
                  <li key={`${p.section}-${p.key}`}>
                    <span>{p.section_label}: {p.label}</span>
                  </li>
                ))}
              </ul>
              {report.pendentes.length > 0 && (
                <>
                  <div className="card-title" style={{ marginTop: 16 }}>Pendentes ({report.pendentes.length})</div>
                  <ul className="admin-checklist">
                    {report.pendentes.map((p) => (
                      <li key={`${p.section}-${p.key}`}>
                        <span>{p.section_label}: {p.label}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </AdminSection>
      )}

      {!loading && data && tab === "logs" && (
        <AdminSection title="Logs da homologação" description="Últimas ações registradas no checklist.">
          <div className="card admin-inner-card">
            {(data.activity || []).length === 0 && (
              <p className="admin-card-hint">Nenhuma ação registrada ainda.</p>
            )}
            <ul className="admin-checklist">
              {(data.activity || []).map((log, i) => (
                <li key={i}>
                  <span>
                    {new Date(log.at).toLocaleString("pt-BR")} — {log.action}
                    {log.label ? `: ${log.label}` : ""}
                    {log.by ? ` (${log.by})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </AdminSection>
      )}
    </AdminLayout>
  );
}
