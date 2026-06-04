import { useState, useEffect, useCallback } from "react";
import { adminApi } from "../api.js";
import { CHART } from "../constants.js";

export function WhatsAppAdminPanel() {
  const [config, setConfig]         = useState({ admin_instance: "", admin_phone: "" });
  const [loadingCfg, setLoadingCfg] = useState(true);
  const [savingCfg, setSavingCfg]   = useState(false);
  const [cfgError, setCfgError]     = useState(null);
  const [cfgSaved, setCfgSaved]     = useState(false);

  // Instance connection state
  const [inst, setInst]             = useState({ status: "disconnected", qrcode: null, phoneNumber: null, instanceName: null });
  const [loadingInst, setLoadingInst] = useState(true);
  const [connecting, setConnecting]   = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [instError, setInstError]     = useState(null);

  // ── Config ──────────────────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    try {
      const d = await adminApi.waConfig();
      setConfig({ admin_instance: d.admin_instance || "", admin_phone: d.admin_phone || "" });
    } catch { /* ignore */ } finally { setLoadingCfg(false); }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const saveConfig = async () => {
    setSavingCfg(true); setCfgError(null); setCfgSaved(false);
    try {
      await adminApi.waSetConfig({ admin_instance: config.admin_instance, admin_phone: config.admin_phone });
      setCfgSaved(true);
      setTimeout(() => setCfgSaved(false), 3000);
    } catch (e) { setCfgError(e.message); } finally { setSavingCfg(false); }
  };

  // ── Instance Status ─────────────────────────────────────────────────────────
  const refreshInst = useCallback(async () => {
    try {
      const d = await adminApi.waInstanceStatus();
      setInst({
        status:       d.status       || "disconnected",
        qrcode:       d.qrcode       || null,
        phoneNumber:  d.phoneNumber  || null,
        instanceName: d.instanceName || null,
      });
    } catch { /* ignore */ } finally { setLoadingInst(false); }
  }, []);

  useEffect(() => { refreshInst(); }, [refreshInst]);

  // Poll while connecting
  useEffect(() => {
    if (inst.status !== "connecting") return;
    const t = setInterval(refreshInst, 4000);
    return () => clearInterval(t);
  }, [inst.status, refreshInst]);

  const handleConnect = async () => {
    setConnecting(true); setInstError(null);
    try {
      await adminApi.waConnect();
      setInst(i => ({ ...i, status: "connecting", qrcode: null }));
      setTimeout(refreshInst, 1500);
      setTimeout(refreshInst, 4000);
    } catch (e) { setInstError(e.message); } finally { setConnecting(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar a instancia global? Usuarios PF nao receberao mensagens.")) return;
    setDisconnecting(true); setInstError(null);
    try {
      await adminApi.waDisconnect();
      setInst({ status: "disconnected", qrcode: null, phoneNumber: null, instanceName: inst.instanceName });
    } catch (e) { setInstError(e.message); } finally { setDisconnecting(false); }
  };

  // Status badge
  const statusClass = {
    connected: "admin-wa-pill--ok",
    connecting: "admin-wa-pill--pending",
    disconnected: "admin-wa-pill--off",
  };

  return (
    <div className="admin-wa-stack">
      <div className="card admin-inner-card">
        <div className="card-title">Configuração</div>
        <p className="admin-card-hint">Identificador da instância global e número oficial do produto.</p>
        {cfgError && <div className="alert alert-warn">{cfgError}</div>}
        {cfgSaved && <div className="alert alert-success">Configuração salva.</div>}
        {loadingCfg ? (
          <p className="admin-loading">Carregando…</p>
        ) : (
          <div className="admin-form-grid-2">
            <div className="form-group">
              <label className="form-label">Nome da instância</label>
              <input
                className="form-input"
                value={config.admin_instance}
                onChange={(e) => setConfig((c) => ({ ...c, admin_instance: e.target.value }))}
                placeholder="cf-admin"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone oficial</label>
              <input
                className="form-input"
                value={config.admin_phone}
                onChange={(e) => setConfig((c) => ({ ...c, admin_phone: e.target.value }))}
                placeholder="5511999999999"
              />
            </div>
          </div>
        )}
        <div className="admin-card-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={saveConfig}
            disabled={savingCfg || loadingCfg}
          >
            {savingCfg ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      <div className="card admin-inner-card">
        <div className="card-title">Conexão</div>
        {instError && <div className="alert alert-warn">{instError}</div>}
        {loadingInst ? (
          <p className="admin-loading">Carregando status…</p>
        ) : (
          <>
            <div className="admin-wa-status-row">
              <span className={`admin-wa-pill ${statusClass[inst.status] || statusClass.disconnected}`}>
                {inst.status === "connected"
                  ? "Conectado"
                  : inst.status === "connecting"
                    ? "Aguardando QR"
                    : "Desconectado"}
              </span>
              {inst.phoneNumber && inst.status === "connected" && (
                <span className="admin-wa-phone">+{inst.phoneNumber}</span>
              )}
              {inst.instanceName && (
                <span className="admin-wa-meta">Instância: {inst.instanceName}</span>
              )}
            </div>

            {inst.status === "connecting" && inst.qrcode && (
              <div className="admin-wa-qr-wrap">
                <p className="admin-card-hint">Escaneie com o WhatsApp do número oficial:</p>
                <img src={inst.qrcode} alt="QR Code WhatsApp" className="admin-wa-qr" />
              </div>
            )}

            {inst.status === "connecting" && !inst.qrcode && (
              <p className="admin-card-hint">Gerando QR code… aguarde alguns segundos.</p>
            )}

            <div className="admin-card-actions">
              {inst.status !== "connected" && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleConnect}
                  disabled={connecting || !config.admin_instance}
                >
                  {connecting ? "Conectando…" : inst.status === "connecting" ? "Reconectar" : "Conectar"}
                </button>
              )}
              {(inst.status === "connected" || inst.status === "connecting") && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? "Desconectando…" : "Desconectar"}
                </button>
              )}
              <button type="button" className="btn btn-secondary btn-sm" onClick={refreshInst}>
                Atualizar
              </button>
            </div>

            {!config.admin_instance && (
              <p className="admin-card-hint admin-card-hint--warn">
                Defina o nome da instância antes de conectar.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function OperacoesOverview() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    adminApi
      .overview()
      .then(setOverview)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Carregando operações…</p>;
  if (err) return <div className="login-error" style={{ marginBottom: 12 }}>{err}</div>;
  if (!overview) return null;

  const grupos = [
    {
      title: "Usuários e suporte",
      cards: [
        { label: "Novos (7 dias)", value: overview.usuarios?.novos_7d },
        { label: "Novos (30 dias)", value: overview.usuarios?.novos_30d },
        { label: "Ativos (30 dias)", value: overview.usuarios?.ativos_30d },
        { label: "Tickets abertos", value: overview.suporte?.tickets_abertos },
      ],
    },
    {
      title: "Planos e assinaturas (resumo)",
      cards: [
        { label: "Contas PF", value: overview.planos?.pf_ativos },
        { label: "Contas PJ", value: overview.planos?.pj_ativos },
        { label: "Assinaturas ativas", value: overview.assinaturas?.ativas },
        { label: "Em trial", value: overview.assinaturas?.trials },
        { label: "Em atraso", value: overview.assinaturas?.atrasadas },
        { label: "Receita estimada", value: overview.receita_estimada_formatado },
      ],
    },
  ];

  return (
    <div className="admin-kpi-groups">
      {grupos.map((g) => (
        <div key={g.title} className="admin-kpi-group">
          <div className="admin-kpi-group-title">{g.title}</div>
          <div className="admin-kpi-grid">
            {g.cards.map(({ label, value }) => (
              <div key={label} className="admin-kpi" style={{ "--admin-kpi-color": CHART.receita }}>
                <div className="admin-kpi-value">{value ?? "—"}</div>
                <div className="admin-kpi-label">{label}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function BillingHealthPanel() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .billingHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Diagnóstico cobrança…</p>;
  if (!health) return null;

  const envLabel =
    health.environment === "production"
      ? "Produção"
      : health.environment === "sandbox"
        ? "Testes"
        : health.environment || "—";

  const rows = [
    ["Cobrança online", health.configured ? "Ativa" : "Pendente"],
    ["Ambiente", envLabel],
    ["Notificações de pagamento", health.webhookConfigured ? "Ativas" : "Pendentes"],
    ["Assinaturas ativas", health.activeSubscriptions],
    ["Faturas em aberto", health.pendingInvoices],
  ];

  return (
    <div className="card admin-inner-card admin-inner-card--narrow">
      <table className="admin-kv-table">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td>{String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


