import { useCallback, useEffect, useState } from "react";
import { empresaApi } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useEmpresaPermissions } from "../hooks/useEmpresaPermissions.js";
import PlanLimitNotice from "../components/PlanLimitNotice.jsx";

const PERFIL_LABEL = {
  owner: "Proprietário",
  admin: "Administrador",
  financeiro: "Financeiro",
  operador: "Operador",
  leitura: "Somente leitura",
};

const PERFIS_CONVIDEIS = [
  { value: "admin", label: "Administrador" },
  { value: "financeiro", label: "Financeiro" },
  { value: "operador", label: "Operador" },
  { value: "leitura", label: "Somente leitura" },
];

export default function EquipePage() {
  const { user } = useAuth();
  const { hasPermission } = useEmpresaPermissions();
  const canManage = hasPermission("equipe.manage");

  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePerfil, setInvitePerfil] = useState("operador");
  const [busy, setBusy] = useState(false);
  const [aceiteToken, setAceiteToken] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const { membros: list } = await empresaApi.membros();
      setMembros(list || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleConvidar = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setMsg("");
    setError("");
    try {
      const res = await empresaApi.convidar({ email: inviteEmail, perfil: invitePerfil });
      setMsg(res.message || "Convite enviado.");
      if (res.dev_token) {
        setMsg(`${res.message} Token (dev): ${res.dev_token}`);
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
    try {
      await empresaApi.aceitarConvite(aceiteToken);
      setMsg("Convite aceito. Recarregue a página se o menu não atualizar.");
      setAceiteToken("");
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
    <div>
      <PlanLimitNotice />
      <div className="page-header">
        <h1 className="page-title">Equipe</h1>
        <p className="page-sub">
          Gerencie quem acessa a conta da empresa e com qual perfil de permissões.
        </p>
      </div>

      {loading && <p style={{ fontSize: 13, color: "var(--muted)" }}>Carregando…</p>}
      {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
      {msg && <p style={{ fontSize: 13, color: "var(--green-dark)", marginBottom: 12 }}>{msg}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Membros</div>
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
                    >
                      {PERFIS_CONVIDEIS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    PERFIL_LABEL[m.perfil] || m.perfil
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
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Convidar membro</div>
          <form onSubmit={handleConvidar} className="form-grid" style={{ maxWidth: 480 }}>
            <div>
              <label className="form-label">E-mail</label>
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
            <div>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                Enviar convite
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title">Aceitar convite</div>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 12px" }}>
          Se você recebeu um convite por e-mail, cole o token abaixo (logado com o mesmo e-mail do convite).
        </p>
        <form onSubmit={handleAceitar} className="form-grid" style={{ maxWidth: 480 }}>
          <div>
            <label className="form-label">Token do convite</label>
            <input
              className="form-input"
              value={aceiteToken}
              onChange={(e) => setAceiteToken(e.target.value)}
              placeholder="Cole o token recebido"
            />
          </div>
          <div>
            <button type="submit" className="btn btn-secondary" disabled={busy}>
              Aceitar convite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
