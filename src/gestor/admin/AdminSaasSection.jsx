import { useState, useEffect, useCallback } from "react";
import { adminApi, systemApi } from "../api.js";
import { CHART } from "../constants.js";
import {
  PlanBadge,
  SubscriptionStatusBadge,
  PF_PLAN_OPTIONS,
  PJ_PLAN_OPTIONS,
} from "./saasBadges.jsx";
import { User } from "../components/icons.jsx";

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const fmtDt = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR") : "—");
const fmtShort = (iso) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
const diasLabel = (d) => {
  if (d == null) return "—";
  if (d < 0) return `${Math.abs(d)}d atraso`;
  if (d === 0) return "Hoje";
  return `${d}d`;
};
const fmtBRL = (c) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((c || 0) / 100);

const FILTROS = [
  ["todos", "Todos"],
  ["pf", "PF"],
  ["pj", "PJ"],
  ["trial", "Trial"],
  ["ativos", "Ativos"],
  ["atrasados", "Atrasados"],
  ["vencidos", "Vencidos"],
  ["cancelados", "Cancelados"],
];

function Badge({ tipo }) {
  const isPF = tipo === "fisica";
  return (
    <span className={`badge ${isPF ? "badge-pf" : "badge-pj"}`}>{isPF ? "PF" : "PJ"}</span>
  );
}

function StatusBadge({ ativo }) {
  return (
    <span className={`badge saas-badge-conta ${ativo ? "badge-green" : "badge-red"}`}>
      {ativo ? "Ativo" : "Inativo"}
    </span>
  );
}

function AlertCard({ title, items, loading }) {
  return (
    <div className="card saas-alert-card">
      <div className="card-title">{title}</div>
      {loading ? (
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Carregando…</p>
      ) : !items?.length ? (
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>Nenhum alerta no momento.</p>
      ) : (
        <ul className="saas-alert-list">
          {items.map((a, i) => (
            <li key={a.id || i} className={`saas-alert-item saas-alert-item--${a.severity || "info"}`}>
              <span aria-hidden>⚠</span> {a.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModalEditarPlano({ cliente, onClose, onSaved }) {
  const [slug, setSlug] = useState(cliente.plano_slug || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const options = cliente.tipo_perfil === "fisica" ? PF_PLAN_OPTIONS : PJ_PLAN_OPTIONS;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await adminApi.changeClientePlano(cliente.id, slug);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header modal-header-forest">
          <h2 className="modal-title" style={{ color: "var(--primary-foreground)" }}>Editar plano</h2>
        </div>
        <form onSubmit={submit} className="modal-body">
          <p style={{ fontSize: 13, margin: "0 0 12px" }}>
            <strong>{cliente.nome}</strong>
            <br />
            Plano atual: <PlanBadge slug={cliente.plano_slug} nome={cliente.plano_nome} />
          </p>
          <label className="form-label">Novo plano</label>
          <select className="form-select" value={slug} onChange={(e) => setSlug(e.target.value)} required>
            {options.map((o) => (
              <option key={o.slug} value={o.slug}>{o.label}</option>
            ))}
          </select>
          {error && <div className="alert alert-warn" style={{ marginTop: 12 }}>{error}</div>}
          <div className="modal-footer" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Salvando…" : "Confirmar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalClienteDetalhe({ clienteId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [webhooks, setWebhooks] = useState([]);
  const [actMsg, setActMsg] = useState("");
  const [actBusy, setActBusy] = useState(null);

  const reload = useCallback(() => {
    return adminApi.getCliente(clienteId).then(setData);
  }, [clienteId]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      reload(),
      adminApi.clienteWebhooks(clienteId).then((r) => setWebhooks(r.eventos || [])),
    ])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clienteId, reload]);

  const runAdminAction = async (key, fn) => {
    setActBusy(key);
    setActMsg("");
    try {
      const result = await fn();
      setActMsg(result.message || "Operação concluída.");
      await reload();
      const wh = await adminApi.clienteWebhooks(clienteId);
      setWebhooks(wh.eventos || []);
    } catch (e) {
      setActMsg(e.message);
    } finally {
      setActBusy(null);
    }
  };

  const c = data?.cliente;
  const faturaPendente = (data?.faturas || []).find((f) => f.status === "pendente");

  const assinatura = data?.assinatura;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal saas-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header modal-header-forest">
          <div>
            <h2 className="modal-title" style={{ color: "var(--primary-foreground)" }}>
              Cliente — detalhes
            </h2>
            {c?.email && (
              <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.85 }}>{c.email}</p>
            )}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="modal-body">
          {loading && <p className="admin-loading">Carregando…</p>}
          {error && <div className="alert alert-warn">{error}</div>}
          {c && data && (
            <>
              <div className="saas-detail-kpis">
                <div className="saas-detail-kpi">
                  <span className="saas-detail-kpi-label">Valor do plano</span>
                  <span className="saas-detail-kpi-value">{c.plano_valor_formatado || "—"}</span>
                </div>
                <div className="saas-detail-kpi">
                  <span className="saas-detail-kpi-label">Total pago</span>
                  <span className="saas-detail-kpi-value">{c.total_pago_formatado || "—"}</span>
                </div>
                <div className="saas-detail-kpi">
                  <span className="saas-detail-kpi-label">Faturas vencidas</span>
                  <span
                    className={`saas-detail-kpi-value${c.faturas_vencidas > 0 ? " saas-detail-kpi-value--danger" : ""}`}
                  >
                    {c.faturas_vencidas ?? 0}
                  </span>
                </div>
                <div className="saas-detail-kpi">
                  <span className="saas-detail-kpi-label">Vencimento</span>
                  <span className="saas-detail-kpi-value">{diasLabel(c.dias_para_vencimento)}</span>
                </div>
              </div>

              <div className="saas-detail-grid">
                <section className="card admin-inner-card">
                  <h3 className="saas-detail-h3">Cadastro</h3>
                  <table className="admin-kv-table">
                    <tbody>
                      <tr><th>Perfil</th><td>{c.nome_perfil || "—"}</td></tr>
                      <tr><th>Telefone</th><td>{c.telefone || "—"}</td></tr>
                      <tr><th>Tipo</th><td>{c.tipo_perfil === "fisica" ? "PF" : "PJ"}</td></tr>
                      <tr><th>Conta</th><td>{c.ativo ? "Ativa" : "Inativa"}</td></tr>
                      <tr><th>Último login</th><td>{fmtDt(c.ultimo_acesso)}</td></tr>
                      <tr><th>Última atividade</th><td>{fmtDt(c.ultima_atividade)}</td></tr>
                    </tbody>
                  </table>
                </section>

                <section className="card admin-inner-card">
                  <h3 className="saas-detail-h3">Plano e assinatura</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    <PlanBadge slug={c.plano_slug} nome={c.plano_nome} />
                    <SubscriptionStatusBadge status={c.assinatura_status} />
                  </div>
                  <table className="admin-kv-table">
                    <tbody>
                      {c.trial_ate && (
                        <tr><th>Trial até</th><td>{fmt(c.trial_ate)}</td></tr>
                      )}
                      {c.proxima_cobranca && (
                        <tr><th>Próxima cobrança</th><td>{fmt(c.proxima_cobranca)}</td></tr>
                      )}
                      {assinatura?.plano?.preco_centavos != null && (
                        <tr>
                          <th>Preço cadastro</th>
                          <td>{fmtBRL(assinatura.plano.preco_centavos)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>

                <section className="card admin-inner-card saas-detail-full" id="saas-detail-faturas">
                  <h3 className="saas-detail-h3">Faturas ({data.faturas?.length || 0})</h3>
                  {(data.faturas || []).length === 0 ? (
                    <p className="admin-empty">Nenhuma fatura.</p>
                  ) : (
                    <div className="admin-table-wrap" style={{ boxShadow: "none", border: "none" }}>
                      <table className="data-table" style={{ width: "100%", fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>Vencimento</th>
                            <th>Valor</th>
                            <th>Status</th>
                            <th>Pago em</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.faturas || []).map((f) => (
                            <tr key={f.id}>
                              <td>{fmt(f.vencimento)}</td>
                              <td>{fmtBRL(f.valor_centavos)}</td>
                              <td>{f.status}</td>
                              <td>{f.pago_em ? fmtDt(f.pago_em) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="card admin-inner-card saas-detail-full">
                  <h3 className="saas-detail-h3">Pagamentos ({data.pagamentos?.length || 0})</h3>
                  {(data.pagamentos || []).length === 0 ? (
                    <p className="admin-empty">Nenhum pagamento.</p>
                  ) : (
                    <ul className="saas-mini-list">
                      {(data.pagamentos || []).map((p) => (
                        <li key={p.id}>
                          {fmtBRL(p.valor_centavos)} — {p.status} — {fmtDt(p.created_at)}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {(data.equipe?.length > 0 || data.whatsapps?.length > 0) && (
                  <>
                    {data.equipe?.length > 0 && (
                      <section className="card admin-inner-card">
                        <h3 className="saas-detail-h3">Equipe ({data.equipe.length})</h3>
                        <ul className="saas-mini-list">
                          {data.equipe.map((m, i) => (
                            <li key={i}>
                              {m.nome} ({m.perfil}) — {m.email}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                    {data.whatsapps?.length > 0 && (
                      <section className="card admin-inner-card">
                        <h3 className="saas-detail-h3">WhatsApp ({data.whatsapps.length})</h3>
                        <ul className="saas-mini-list">
                          {data.whatsapps.map((w) => (
                            <li key={w.id}>
                              {w.phone_number}
                              {w.is_primary ? " ★" : ""}
                              {!w.active ? " (inativo)" : ""}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </>
                )}

                <section className="card admin-inner-card saas-detail-full">
                  <h3 className="saas-detail-h3">Ações de cobrança</h3>
                  <p className="admin-card-hint">
                    Upgrade: cobrança PIX integral; plano após pagamento. Downgrade: imediato.
                  </p>
                  <div className="admin-card-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={!!actBusy}
                      onClick={() =>
                        runAdminAction("reenviar", () => adminApi.reenviarCobranca(clienteId))
                      }
                    >
                      {actBusy === "reenviar" ? "…" : "Reenviar cobrança"}
                    </button>
                    {faturaPendente && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={!!actBusy}
                        onClick={() =>
                          runAdminAction("pago", () =>
                            adminApi.marcarFaturaPaga(clienteId, faturaPendente.id)
                          )
                        }
                      >
                        {actBusy === "pago" ? "…" : "Marcar como pago"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={!!actBusy || c.assinatura_status === "cancelada"}
                      onClick={() => {
                        if (!window.confirm("Cancelar assinatura deste cliente?")) return;
                        runAdminAction("cancelar", () =>
                          adminApi.cancelarAssinaturaCliente(clienteId)
                        );
                      }}
                    >
                      {actBusy === "cancelar" ? "…" : "Cancelar assinatura"}
                    </button>
                  </div>
                  {actMsg && <p className="admin-card-hint" style={{ marginTop: 10 }}>{actMsg}</p>}
                </section>

                <section className="card admin-inner-card saas-detail-full">
                  <h3 className="saas-detail-h3">Eventos recentes ({webhooks.length})</h3>
                  {webhooks.length === 0 ? (
                    <p className="admin-empty">Nenhum evento registrado.</p>
                  ) : (
                    <ul className="saas-mini-list admin-log-list">
                      {webhooks.slice(0, 12).map((e) => (
                        <li key={e.id}>
                          {e.evento}
                          <span className="admin-log-time">{fmtDt(e.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** mode: 'saas' = métricas/alertas · 'tenants' = tabela clientes · 'full' = tudo */
export default function AdminSaasSection({
  mode = "full",
  onEnterTenant,
  showNovo,
  setShowNovo,
  ModalNovoUsuario,
  ModalResetSenha,
  resetTarget,
  setResetTarget,
  onUserCreated,
}) {
  const showSaas = mode === "full" || mode === "saas";
  const showTenants = mode === "full" || mode === "tenants";
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [cobrancaAlertas, setCobrancaAlertas] = useState({ avisos: [] });
  const [metrics, setMetrics] = useState(null);
  const [editPlano, setEditPlano] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const loadClientes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = busca.trim();
      const params = new URLSearchParams({ filtro });
      if (q) params.set("q", q);
      const { clientes: list } = await adminApi.listClientes(params.toString());
      setClientes(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [busca, filtro]);

  useEffect(() => {
    const t = setTimeout(loadClientes, busca ? 280 : 0);
    return () => clearTimeout(t);
  }, [loadClientes, busca]);

  useEffect(() => {
    systemApi.configStatus().then((s) => setSystemAlerts(s.alerts || [])).catch(() => {});
    adminApi.cobrancaAlertas().then(setCobrancaAlertas).catch(() => {});
    adminApi.saasMetrics().then(setMetrics).catch(() => {});
  }, []);

  const handleToggle = async (id) => {
    try {
      const { ativo } = await adminApi.toggleUser(id);
      setClientes((list) => list.map((u) => (u.id === id ? { ...u, ativo } : u)));
    } catch (err) {
      alert("Erro: " + err.message);
    }
  };

  const handleDelete = async (u) => {
    if (!confirm(`Excluir permanentemente a conta de ${u.nome} (${u.email})?`)) return;
    try {
      await adminApi.deleteUser(u.id);
      setClientes((list) => list.filter((x) => x.id !== u.id));
    } catch (err) {
      alert("Erro: " + err.message);
    }
  };

  const metricCards = metrics
    ? [
        { label: "MRR estimado", value: metrics.mrr_formatado },
        { label: "ARR estimado", value: metrics.arr_formatado },
        { label: "Trials ativos", value: metrics.trials_ativos },
        { label: "Conversão Trial → Pago", value: `${metrics.conversao_trial_pago_pct}%` },
        { label: "Churn 30 dias", value: `${metrics.churn_30d} (${metrics.churn_30d_pct}%)` },
      ]
    : [];

  return (
    <>
      {showSaas && (
      <div className="admin-saas-dashboard">
      <div className="saas-alerts-row">
        <AlertCard title="Alertas do sistema" items={systemAlerts} loading={false} />
        <AlertCard
          title="Avisos de cobrança"
          items={cobrancaAlertas.avisos}
          loading={!cobrancaAlertas.avisos && !cobrancaAlertas.trials_terminando_3d}
        />
      </div>

      {metricCards.length > 0 && (
        <div className="admin-kpi-grid" style={{ marginBottom: 20 }}>
          {metricCards.map(({ label, value }) => (
            <div key={label} className="admin-kpi" style={{ "--admin-kpi-color": CHART.receita }}>
              <div className="admin-kpi-value">{value}</div>
              <div className="admin-kpi-label">{label}</div>
            </div>
          ))}
        </div>
      )}
      </div>
      )}

      {showTenants && (
      <div className="admin-tenants-panel">
      <div className="saas-filter-chips">
        {FILTROS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`saas-filter-chip${filtro === id ? " saas-filter-chip--active" : ""}`}
            onClick={() => setFiltro(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="toolbar admin-tenants-toolbar">
        <p className="admin-tenants-count">
          {loading ? "Carregando…" : `${clientes.length} cliente${clientes.length !== 1 ? "s" : ""}`}
        </p>
        <div className="toolbar-right">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              className="form-input search-input"
              placeholder="Nome, e-mail, empresa, telefone…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <button type="button" onClick={() => setShowNovo?.(true)} className="btn btn-primary">
            ➕ Novo Cliente
          </button>
        </div>
      </div>

      <div className="admin-table-wrap admin-table-wrap--scroll">
        {loading ? (
          <div className="empty-state">Carregando…</div>
        ) : error ? (
          <div className="empty-state" style={{ color: "var(--danger-fg)" }}>⚠ {error}</div>
        ) : clientes.length === 0 ? (
          <div className="empty-state">Nenhum cliente encontrado</div>
        ) : (
          <div className="admin-tenant-scroll">
            <table className="admin-tenant-table admin-tenant-table--compact">
              <colgroup>
                <col className="saas-col-cliente" />
                <col className="saas-col-plan" />
                <col className="saas-col-status" />
                <col className="saas-col-venc" />
                <col className="saas-col-tipo" />
                <col className="saas-col-conta" />
                <col className="saas-col-detalhe" />
                <col className="saas-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th className="saas-col-cliente">Cliente</th>
                  <th className="saas-col-plan">Plano</th>
                  <th className="saas-col-status">Status</th>
                  <th className="saas-col-venc">Vencimento</th>
                  <th className="saas-col-tipo">Tipo</th>
                  <th className="saas-col-conta">Conta</th>
                  <th className="saas-col-detalhe">Detalhe</th>
                  <th className="saas-col-actions">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((u) => (
                  <tr key={u.id}>
                    <td className="saas-col-cliente">
                      <button
                        type="button"
                        className="saas-link-name"
                        onClick={() => setDetailId(u.id)}
                        title="Ver cliente"
                      >
                        <strong className="saas-cliente-nome">{u.nome}</strong>
                      </button>
                      <div className="saas-cliente-meta" title={u.email}>{u.email}</div>
                    </td>
                    <td className="saas-col-plan"><PlanBadge slug={u.plano_slug} nome={u.plano_nome} /></td>
                    <td className="saas-col-status">
                      <div className="saas-status-cell">
                        <SubscriptionStatusBadge status={u.assinatura_status} />
                        {u.faturas_vencidas > 0 && (
                          <span className="badge badge-red" title="Faturas vencidas">
                            {u.faturas_vencidas} venc.
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="saas-col-venc">
                      <div
                        className="saas-venc-cell"
                        title={`Trial: ${fmt(u.trial_ate)} · Cobrança: ${fmt(u.proxima_cobranca)}`}
                      >
                        <strong>{diasLabel(u.dias_para_vencimento)}</strong>
                        <span className="saas-venc-date">
                          {u.assinatura_status === "trial"
                            ? fmtShort(u.trial_ate)
                            : fmtShort(u.proxima_cobranca)}
                        </span>
                      </div>
                    </td>
                    <td className="saas-col-tipo"><Badge tipo={u.tipo_perfil} /></td>
                    <td className="saas-col-conta"><StatusBadge ativo={u.ativo} /></td>
                    <td className="saas-col-detalhe">
                      <button
                        type="button"
                        className="saas-ver-cliente-btn"
                        title="Ver cliente"
                        aria-label={`Ver cliente — ${u.nome}`}
                        onClick={() => setDetailId(u.id)}
                      >
                        <User size={15} strokeWidth={1.75} aria-hidden />
                      </button>
                    </td>
                    <td className="saas-col-actions">
                      <div className="saas-row-actions" role="group" aria-label={`Ações — ${u.nome}`}>
                        <button
                          type="button"
                          className="saas-act-btn saas-act-btn--neutral"
                          title="Entrar como tenant"
                          aria-label="Entrar como tenant"
                          disabled={!u.ativo}
                          onClick={() => onEnterTenant?.(u)}
                        >
                          ⇄
                        </button>
                        <button
                          type="button"
                          className="saas-act-btn saas-act-btn--primary"
                          title="Alterar plano"
                          aria-label="Editar plano"
                          onClick={() => setEditPlano(u)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="saas-act-btn saas-act-btn--warn"
                          title="Redefinir senha"
                          aria-label="Redefinir senha"
                          onClick={() => setResetTarget(u)}
                        >
                          🔑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggle(u.id)}
                          title={u.ativo ? "Desativar conta" : "Ativar conta"}
                          aria-label={u.ativo ? "Desativar conta" : "Ativar conta"}
                          className={`saas-act-btn ${u.ativo ? "saas-act-btn--danger" : "saas-act-btn--neutral"}`}
                        >
                          {u.ativo ? "⊘" : "✓"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(u)}
                          title="Excluir cliente"
                          aria-label="Excluir cliente"
                          className="saas-act-btn saas-act-btn--danger"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNovo && ModalNovoUsuario && (
        <ModalNovoUsuario
          onClose={() => setShowNovo(false)}
          onCreated={(u) => {
            onUserCreated?.(u);
            loadClientes();
          }}
        />
      )}
      {resetTarget && ModalResetSenha && (
        <ModalResetSenha user={resetTarget} onClose={() => setResetTarget(null)} />
      )}
      {editPlano && (
        <ModalEditarPlano
          cliente={editPlano}
          onClose={() => setEditPlano(null)}
          onSaved={loadClientes}
        />
      )}
      {detailId && (
        <ModalClienteDetalhe clienteId={detailId} onClose={() => setDetailId(null)} />
      )}
      </div>
      )}
    </>
  );
}
