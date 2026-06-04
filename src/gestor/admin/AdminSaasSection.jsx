import { useState, useEffect, useCallback } from "react";
import { adminApi, systemApi } from "../api.js";
import { CHART } from "../constants.js";
import {
  PlanBadge,
  SubscriptionStatusBadge,
  PF_PLAN_OPTIONS,
  PJ_PLAN_OPTIONS,
} from "./saasBadges.jsx";

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const fmtDt = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR") : "—");
const fmtShort = (iso) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
const fmtAccess = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal saas-detail-modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Cliente — detalhes</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Fechar</button>
        </div>
        <div className="modal-body">
          {loading && <p>Carregando…</p>}
          {error && <div className="alert alert-warn">{error}</div>}
          {c && (
            <div className="saas-detail-grid">
              <section>
                <h3 className="saas-detail-h3">Cadastro</h3>
                <p><strong>{c.nome}</strong> — {c.email}</p>
                <p>Empresa/perfil: {c.nome_perfil || "—"}</p>
                <p>Telefone: {c.telefone || "—"}</p>
                <p>Último login: {fmtDt(c.ultimo_acesso)}</p>
                <p>Última atividade: {fmtDt(c.ultima_atividade)}</p>
              </section>
              <section>
                <h3 className="saas-detail-h3">Plano e assinatura</h3>
                <p>
                  <PlanBadge slug={c.plano_slug} nome={c.plano_nome} />{" "}
                  <SubscriptionStatusBadge status={c.assinatura_status} />
                </p>
                {c.trial_ate && <p>Trial até: {fmt(c.trial_ate)}</p>}
                {c.proxima_cobranca && <p>Próxima cobrança: {fmt(c.proxima_cobranca)}</p>}
              </section>
              <section>
                <h3 className="saas-detail-h3">Faturas ({data.faturas?.length || 0})</h3>
                <ul className="saas-mini-list">
                  {(data.faturas || []).slice(0, 6).map((f) => (
                    <li key={f.id}>{fmtBRL(f.valor_centavos)} — {f.status} — venc. {fmt(f.vencimento)}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="saas-detail-h3">Pagamentos ({data.pagamentos?.length || 0})</h3>
                <ul className="saas-mini-list">
                  {(data.pagamentos || []).slice(0, 6).map((p) => (
                    <li key={p.id}>{fmtBRL(p.valor_centavos)} — {p.status} — {fmtDt(p.created_at)}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="saas-detail-h3">Equipe ({data.equipe?.length || 0})</h3>
                <ul className="saas-mini-list">
                  {(data.equipe || []).map((m, i) => (
                    <li key={i}>{m.nome} ({m.perfil}) — {m.email}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="saas-detail-h3">WhatsApp ({data.whatsapps?.length || 0})</h3>
                <ul className="saas-mini-list">
                  {(data.whatsapps || []).map((w) => (
                    <li key={w.id}>{w.phone_number}{w.is_primary ? " ★" : ""}{!w.active ? " (inativo)" : ""}</li>
                  ))}
                </ul>
              </section>
              <section className="saas-detail-full">
                <h3 className="saas-detail-h3">Cobrança (admin)</h3>
                <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 10px" }}>
                  Upgrade: cobrança cheia PIX; plano após pagamento. Downgrade: imediato, sem reembolso.
                </p>
                <div className="saas-admin-actions">
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
                    disabled={!!actBusy || c?.assinatura_status === "cancelada"}
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
                {actMsg && (
                  <p style={{ fontSize: 12, marginTop: 8, color: "var(--muted-foreground)" }}>{actMsg}</p>
                )}
              </section>
              <section className="saas-detail-full">
                <h3 className="saas-detail-h3">Histórico webhook Asaas ({webhooks.length})</h3>
                <ul className="saas-mini-list">
                  {webhooks.slice(0, 12).map((e) => (
                    <li key={e.id}>
                      {e.evento} — {fmtDt(e.created_at)}
                    </li>
                  ))}
                  {!webhooks.length && (
                    <li style={{ color: "var(--muted-foreground)" }}>Nenhum evento registrado.</li>
                  )}
                </ul>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminSaasSection({
  onEnterTenant,
  showNovo,
  setShowNovo,
  ModalNovoUsuario,
  ModalResetSenha,
  resetTarget,
  setResetTarget,
  onUserCreated,
}) {
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
      setClientes(list);
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

  const diasLabel = (d) => {
    if (d == null) return "—";
    if (d < 0) return `${Math.abs(d)}d atraso`;
    if (d === 0) return "Hoje";
    return `${d}d`;
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
      <h2 className="admin-section-title">Gestão comercial SaaS</h2>

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

      <div className="toolbar">
        <h2 className="admin-section-title" style={{ margin: 0 }}>Clientes / Tenants</h2>
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
          <button type="button" onClick={() => setShowNovo(true)} className="btn btn-primary">
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
            <table className="admin-tenant-table">
              <colgroup>
                <col className="saas-col-cliente" />
                <col className="saas-col-plan" />
                <col className="saas-col-status" />
                <col className="saas-col-billing" />
                <col className="saas-col-tipo" />
                <col className="saas-col-conta" />
                <col className="saas-col-access" />
                <col className="saas-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th className="saas-col-cliente">Cliente</th>
                  <th className="saas-col-plan">Plano</th>
                  <th className="saas-col-status">Status</th>
                  <th className="saas-col-billing">Vencimento</th>
                  <th className="saas-col-tipo">Tipo</th>
                  <th className="saas-col-conta">Conta</th>
                  <th className="saas-col-access">Acesso</th>
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
                        title="Ver detalhes"
                      >
                        <strong className="saas-cliente-nome">{u.nome}</strong>
                      </button>
                      <div className="saas-cliente-meta" title={u.email}>{u.email}</div>
                      <div className="saas-cliente-meta">{u.nome_perfil || "—"}</div>
                    </td>
                    <td className="saas-col-plan"><PlanBadge slug={u.plano_slug} nome={u.plano_nome} /></td>
                    <td className="saas-col-status"><SubscriptionStatusBadge status={u.assinatura_status} /></td>
                    <td className="saas-col-billing">
                      <div className="saas-billing-compact" title={`Trial: ${fmt(u.trial_ate)} · Cobrança: ${fmt(u.proxima_cobranca)}`}>
                        <span>T: {fmtShort(u.trial_ate)}</span>
                        <span>C: {fmtShort(u.proxima_cobranca)}</span>
                        <strong className="saas-billing-dias">{diasLabel(u.dias_para_vencimento)}</strong>
                      </div>
                    </td>
                    <td className="saas-col-tipo"><Badge tipo={u.tipo_perfil} /></td>
                    <td className="saas-col-conta"><StatusBadge ativo={u.ativo} /></td>
                    <td className="saas-col-access td-mono" title={fmtDt(u.ultimo_acesso)}>{fmtAccess(u.ultimo_acesso)}</td>
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
                          title="Editar plano"
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
    </>
  );
}
