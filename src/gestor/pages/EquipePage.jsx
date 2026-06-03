import { useCallback, useEffect, useState } from "react";
import { billingApi, empresaApi } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useEmpresaPermissions } from "../hooks/useEmpresaPermissions.js";
import useConfigStatus from "../hooks/useConfigStatus.js";
import PlanLimitNotice from "../components/PlanLimitNotice.jsx";
import ConfigStatusBanner from "../components/ConfigStatusBanner.jsx";
import { AlertTriangle } from "../components/icons.jsx";

const PERFIL_LABEL = {
  owner: "Proprietário",
  admin: "Administrador",
  financeiro: "Financeiro",
  operador: "Operador",
  leitura: "Somente leitura",
};

const PERFIL_BADGE = {
  owner: "eq-badge eq-badge--owner",
  admin: "eq-badge eq-badge--admin",
  financeiro: "eq-badge eq-badge--fin",
  operador: "eq-badge eq-badge--op",
  leitura: "eq-badge eq-badge--read",
};

const PERFIS_CONVIDEIS = [
  { value: "admin", label: "Administrador" },
  { value: "financeiro", label: "Financeiro" },
  { value: "operador", label: "Operador" },
  { value: "leitura", label: "Somente leitura" },
];

const PAGE_CSS = `
.eq-summary {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;
  margin-bottom: 16px;
}
.eq-summary-item {
  background: linear-gradient(145deg, oklch(0.98 0.01 150), oklch(0.96 0.02 155));
  border: 1px solid oklch(0.92 0.02 150); border-radius: 14px; padding: 14px 16px;
}
.eq-summary-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted-foreground); }
.eq-summary-value { font-size: 18px; font-weight: 700; color: var(--text, #0f172a); margin-top: 4px; }
.eq-card { border-radius: 14px; border: 1px solid oklch(0.92 0.01 150); padding: 16px 18px; background: #fff; margin-bottom: 14px; box-shadow: 0 4px 14px oklch(0.45 0.03 155 / 0.05); }
.eq-badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; }
.eq-badge--owner { background: oklch(0.92 0.04 260); color: oklch(0.35 0.08 260); }
.eq-badge--admin { background: oklch(0.94 0.03 155); color: var(--green-dark, #166534); }
.eq-badge--fin { background: oklch(0.95 0.04 85); color: oklch(0.45 0.08 75); }
.eq-badge--op { background: oklch(0.96 0.02 250); color: #475569; }
.eq-badge--read { background: oklch(0.96 0.01 250); color: #64748b; }
.eq-invite-hint { font-size: 12px; color: var(--muted-foreground); line-height: 1.5; margin: 0 0 12px; }
.eq-token-box {
  margin-top: 12px; padding: 12px; border-radius: 10px;
  background: oklch(0.97 0.02 85); border: 1px dashed oklch(0.85 0.05 85);
  font-size: 12px; word-break: break-all; color: var(--text, #0f172a);
}
`;

export default function EquipePage() {
  const { user } = useAuth();
  const { hasPermission } = useEmpresaPermissions();
  const { status: configStatus } = useConfigStatus();
  const canManage = hasPermission("equipe.manage");

  const [membros, setMembros] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePerfil, setInvitePerfil] = useState("operador");
  const [busy, setBusy] = useState(false);
  const [aceiteToken, setAceiteToken] = useState("");
  const [manualToken, setManualToken] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [{ membros: list }, usageData] = await Promise.all([
        empresaApi.membros(),
        billingApi.usage().catch(() => null),
      ]);
      setMembros(list || []);
      setUsage(usageData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    const t = params.get("aceitar_convite");
    if (t) setAceiteToken(t);
  }, [load]);

  const usuariosUsados = usage?.uso?.usuarios?.usado ?? membros.filter((m) => m.status === "ativo").length;
  const usuariosLimite = usage?.uso?.usuarios?.limite ?? usage?.limites?.usuarios;

  const handleConvidar = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMsg("");
    setError("");
    setManualToken("");
    try {
      const res = await empresaApi.convidar({ email: inviteEmail, perfil: invitePerfil });
      if (res.email_sent) {
        setMsg(res.message || "Convite enviado por e-mail.");
      } else {
        setMsg(res.message || "Convite gerado, copie o token manualmente.");
        setManualToken(res.manual_token || res.dev_token || "");
      }
      setInviteEmail("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAceitar = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await empresaApi.aceitarConvite(aceiteToken.trim());
      setMsg("Convite aceito! Você já faz parte da equipe.");
      setAceiteToken("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePerfilChange = async (id, perfil) => {
    if (!canManage) return;
    setBusy(true);
    try {
      await empresaApi.atualizarMembro(id, { perfil });
      await load();
      setMsg("Perfil atualizado.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemover = async (id) => {
    if (!canManage) return;
    if (!window.confirm("Remover este membro da equipe?")) return;
    setBusy(true);
    try {
      await empresaApi.removerMembro(id);
      await load();
      setMsg("Membro removido.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="equipe-page">
      <style>{PAGE_CSS}</style>
      <PlanLimitNotice />

      <div className="page-header">
        <h1 className="page-title">Equipe</h1>
        <p className="page-sub">
          Gerencie quem acessa a conta da empresa e com qual perfil de permissões.
        </p>
      </div>

      <ConfigStatusBanner status={configStatus} keys={["email"]} compact />

      <div className="eq-summary">
        <div className="eq-summary-item">
          <div className="eq-summary-label">Membros</div>
          <div className="eq-summary-value">
            {usuariosLimite != null ? `${usuariosUsados} / ${usuariosLimite}` : usuariosUsados}
          </div>
        </div>
        <div className="eq-summary-item">
          <div className="eq-summary-label">Convites pendentes</div>
          <div className="eq-summary-value">
            {membros.filter((m) => m.status === "pendente").length}
          </div>
        </div>
        <div className="eq-summary-item">
          <div className="eq-summary-label">E-mail</div>
          <div className="eq-summary-value" style={{ fontSize: 13 }}>
            {configStatus?.email?.configured ? "Configurado" : "Manual"}
          </div>
        </div>
      </div>

      {loading && <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Carregando…</p>}
      {error && (
        <div className="login-error" style={{ marginBottom: 12 }}>
          <AlertTriangle size={15} strokeWidth={2} aria-hidden />
          <span>{error}</span>
        </div>
      )}
      {msg && <p style={{ fontSize: 13, color: "var(--green-dark)", marginBottom: 12 }}>{msg}</p>}

      <div className="eq-card">
        <div className="card-title">Membros da equipe</div>
        <table className="data-table" style={{ width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>Status</th>
              {canManage && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {membros.map((m) => (
              <tr key={m.id}>
                <td>{m.nome || "—"}</td>
                <td>{m.email}</td>
                <td>
                  {canManage && m.perfil !== "owner" ? (
                    <select
                      className="form-input"
                      value={m.perfil}
                      disabled={busy || m.membroUsuarioId === user?.id}
                      onChange={(e) => handlePerfilChange(m.id, e.target.value)}
                      style={{ maxWidth: 160 }}
                    >
                      {PERFIS_CONVIDEIS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={PERFIL_BADGE[m.perfil] || "eq-badge"}>
                      {PERFIL_LABEL[m.perfil] || m.perfil}
                    </span>
                  )}
                </td>
                <td>{m.status}</td>
                {canManage && (
                  <td>
                    {m.perfil !== "owner" && m.membroUsuarioId !== user?.id && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busy}
                        onClick={() => handleRemover(m.id)}
                      >
                        Remover
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="eq-card">
          <div className="card-title">Convidar membro</div>
          <p className="eq-invite-hint">
            Enviamos um e-mail com link e token. Se o envio não estiver configurado no servidor,
            copie o token gerado e compartilhe manualmente com o convidado.
          </p>
          {!configStatus?.email?.configured && (
            <p className="eq-invite-hint" style={{ color: "oklch(0.45 0.08 75)" }}>
              E-mail não configurado — após convidar, copie o token manualmente.
            </p>
          )}
          <form onSubmit={handleConvidar} className="form-grid" style={{ maxWidth: 520, gap: 12 }}>
            <div>
              <label className="form-label">E-mail do convidado</label>
              <input
                className="form-input"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Perfil</label>
              <select
                className="form-input"
                value={invitePerfil}
                onChange={(e) => setInvitePerfil(e.target.value)}
              >
                {PERFIS_CONVIDEIS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ alignSelf: "end" }}>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Enviando…" : "Enviar convite"}
              </button>
            </div>
          </form>
          {manualToken && (
            <div className="eq-token-box">
              <strong>Token do convite (copie e envie manualmente):</strong>
              <div style={{ marginTop: 6, fontFamily: "monospace" }}>{manualToken}</div>
            </div>
          )}
        </div>
      )}

      <div className="eq-card">
        <div className="card-title">Aceitar convite</div>
        <p className="eq-invite-hint">
          Recebeu um convite? Faça login com o <strong>mesmo e-mail</strong> do convite, cole o
          token abaixo ou use o link recebido por e-mail.
        </p>
        <form onSubmit={handleAceitar} className="form-grid" style={{ maxWidth: 520, gap: 12 }}>
          <div>
            <label className="form-label">Token do convite</label>
            <input
              className="form-input"
              value={aceiteToken}
              onChange={(e) => setAceiteToken(e.target.value)}
              placeholder="Cole o token recebido"
            />
          </div>
          <div style={{ alignSelf: "end" }}>
            <button type="submit" className="btn btn-primary" disabled={busy || !aceiteToken.trim()}>
              {busy ? "Aceitando…" : "Aceitar convite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
