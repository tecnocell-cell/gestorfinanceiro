import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../admin/AdminLayout.jsx";
import AdminSection from "../admin/AdminSection.jsx";
import { betaApi } from "../api.js";
import { buildBetaInviteText, BETA_INVITE_SUBJECT } from "../beta/betaInviteTemplate.js";

const STATUS_OPTS = [
  ["aberto", "Aberto"],
  ["em_analise", "Em análise"],
  ["resolvido", "Resolvido"],
  ["arquivado", "Arquivado"],
];

const TIPO_LABEL = {
  bug: "Bug",
  duvida: "Dúvida",
  sugestao: "Sugestão",
  elogio: "Elogio",
};

function fmtDt(iso) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

export default function AdminBetaPage() {
  const [summary, setSummary] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inviteUrl, setInviteUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await betaApi.adminSummary();
      setSummary(data);
      setFeedbacks(data.feedbacks_recentes || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setInviteUrl(typeof window !== "undefined" ? window.location.origin : "");
    load();
  }, [load]);

  const patchStatus = async (id, status) => {
    try {
      await betaApi.patchFeedback(id, status);
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  const copyInvite = () => {
    const text = buildBetaInviteText({ appUrl: inviteUrl });
    navigator.clipboard?.writeText(text).then(
      () => alert("Texto de convite copiado."),
      () => alert(text)
    );
  };

  const fb = summary?.feedback || {};

  return (
    <AdminLayout
      title="Beta fechado"
      subtitle="Feedbacks de usuários reais, checklist médio e convite manual."
    >
      <AdminSection
        title="Painel beta"
        description="Requer BETA_MODE=true no servidor. E-mail automático não é obrigatório."
      >
        {loading && <p className="admin-loading">Carregando…</p>}
        {error && <div className="alert alert-warn">{error}</div>}
        {summary && (
          <>
            {!summary.betaMode && (
              <div className="alert alert-warn" style={{ marginBottom: 16 }}>
                BETA_MODE está desativado no servidor. Ative no .env para exibir selo e feedback aos clientes.
              </div>
            )}

            <div className="admin-kpi-grid" style={{ marginBottom: 20 }}>
              <div className="admin-kpi">
                <div className="admin-kpi-value">{fb.total ?? 0}</div>
                <div className="admin-kpi-label">Total feedbacks</div>
              </div>
              <div className="admin-kpi">
                <div className="admin-kpi-value">{fb.bugs_abertos ?? 0}</div>
                <div className="admin-kpi-label">Bugs abertos</div>
              </div>
              <div className="admin-kpi">
                <div className="admin-kpi-value">{fb.sugestoes ?? 0}</div>
                <div className="admin-kpi-label">Sugestões</div>
              </div>
              <div className="admin-kpi">
                <div className="admin-kpi-value">{summary.usuarios_beta_ativos ?? 0}</div>
                <div className="admin-kpi-label">Usuários beta ativos</div>
              </div>
              <div className="admin-kpi">
                <div className="admin-kpi-value">{summary.checklist_medio_percent ?? 0}%</div>
                <div className="admin-kpi-label">Checklist médio concluído</div>
              </div>
            </div>

            <div className="card admin-inner-card" style={{ marginBottom: 20 }}>
              <h3 className="saas-detail-h3">Convite beta (manual)</h3>
              <p className="admin-card-hint" style={{ marginBottom: 12 }}>
                Assunto sugerido: <strong>{BETA_INVITE_SUBJECT}</strong>
              </p>
              <label className="form-label">URL do app</label>
              <input
                className="form-input"
                value={inviteUrl}
                onChange={(e) => setInviteUrl(e.target.value)}
                placeholder="https://app.fluxiva.com.br"
              />
              <div className="admin-card-actions" style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={copyInvite}>
                  Copiar texto de convite
                </button>
              </div>
              <pre className="beta-invite-preview">{buildBetaInviteText({ appUrl: inviteUrl })}</pre>
            </div>

            <div className="admin-table-wrap">
              <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Usuário</th>
                    <th>Tela</th>
                    <th>Tipo</th>
                    <th>Mensagem</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbacks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-empty">Nenhum feedback ainda.</td>
                    </tr>
                  ) : (
                    feedbacks.map((f) => (
                      <tr key={f.id}>
                        <td>{fmtDt(f.created_at)}</td>
                        <td>
                          {f.usuario_nome}
                          <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{f.usuario_email}</div>
                        </td>
                        <td>{f.tela || "—"}</td>
                        <td>{TIPO_LABEL[f.tipo] || f.tipo}</td>
                        <td style={{ maxWidth: 220 }}>{f.mensagem}</td>
                        <td>
                          <select
                            className="form-select"
                            style={{ fontSize: 11, padding: "4px 8px" }}
                            value={f.status}
                            onChange={(e) => patchStatus(f.id, e.target.value)}
                          >
                            {STATUS_OPTS.map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AdminSection>
    </AdminLayout>
  );
}
