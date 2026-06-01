/**
 * IntegracaoPfPjPage — Vínculo único PJ ↔ PF (Etapa 5.0B)
 */
import { useState, useEffect, useCallback } from "react";
import { useGestor } from "../GestorContext.jsx";
import { integracaoPfPjApi } from "../api.js";
import { Link2, User, CheckCircle, Clock, XCircle, AlertCircle } from "../components/icons.jsx";

function statusBadge(status) {
  if (status === "ativo") return { label: "Ativo", cls: "badge-cp-pago", Icon: CheckCircle };
  if (status === "pendente") return { label: "Aguardando PF", cls: "badge-cp-pendente", Icon: Clock };
  return { label: status, cls: "badge-cp-atrasado", Icon: XCircle };
}

export default function IntegracaoPfPjPage() {
  const { viewOnly } = useGestor();
  const [email, setEmail] = useState("");
  const [vinculo, setVinculo] = useState(null);
  const [pfPreview, setPfPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await integracaoPfPjApi.getVinculo();
      setVinculo(data.vinculo || null);
    } catch (err) {
      setErro(err.message || "Erro ao carregar vínculo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleBuscar = async () => {
    const e = email.trim();
    if (!e) { setErro("Informe o e-mail da conta PF."); return; }
    setBuscando(true);
    setErro(null);
    setPfPreview(null);
    try {
      const pf = await integracaoPfPjApi.buscarPf(e);
      setPfPreview(pf);
    } catch (err) {
      setErro(err.message || "Conta PF não encontrada.");
    } finally {
      setBuscando(false);
    }
  };

  const handleVincular = async () => {
    const e = email.trim();
    if (!e) return;
    setSalvando(true);
    setErro(null);
    setMsg(null);
    try {
      const { vinculo: v } = await integracaoPfPjApi.criarVinculo(e);
      setVinculo(v);
      setPfPreview(null);
      setMsg("Convite enviado. A pessoa física precisa aceitar em Perfil.");
    } catch (err) {
      setErro(err.message || "Erro ao vincular.");
    } finally {
      setSalvando(false);
    }
  };

  const handleRevogar = async () => {
    if (!window.confirm("Revogar o vínculo com esta conta PF?")) return;
    setSalvando(true);
    setErro(null);
    setMsg(null);
    try {
      await integracaoPfPjApi.revogarVinculo();
      setVinculo(null);
      setPfPreview(null);
      setEmail("");
      setMsg("Vínculo revogado.");
    } catch (err) {
      setErro(err.message || "Erro ao revogar.");
    } finally {
      setSalvando(false);
    }
  };

  const badge = vinculo ? statusBadge(vinculo.status) : null;
  const temVinculo = vinculo && vinculo.status !== "revogado";

  return (
    <div className="of-page">
      <div className="of-hero">
        <div className="of-hero-inner">
          <div className="of-hero-badge">
            <Link2 size={13} strokeWidth={2} aria-hidden />
            Integração PF/PJ
          </div>
          <h2 className="of-hero-title">Vincule sua conta PF</h2>
          <p className="of-hero-sub">
            Você possui uma conta PF conosco? Vincule aqui.
            PF e PJ continuam separadas — nesta versão apenas o vínculo é registrado;
            repasses automáticos serão disponibilizados em breve.
          </p>
        </div>
      </div>

      <div className="of-section">
        {loading && (
          <div style={{ padding: 20, color: "var(--muted-foreground)", fontSize: 13 }}>
            Carregando...
          </div>
        )}

        {!loading && temVinculo && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <User size={18} strokeWidth={2} aria-hidden />
              Vínculo atual
            </div>
            <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
              <div>
                <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>Conta PF</span>
                <div style={{ fontWeight: 600 }}>{vinculo.nomePf || vinculo.emailPf}</div>
                <div style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{vinculo.emailPf}</div>
              </div>
              <div>
                <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>Status</span>
                <div style={{ marginTop: 4 }}>
                  {badge && (
                    <span className={`badge ${badge.cls}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <badge.Icon size={12} strokeWidth={2} aria-hidden />
                      {badge.label}
                    </span>
                  )}
                </div>
                {vinculo.status === "pendente" && (
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                    Aguardando aceite da PF em Perfil → Integração PJ.
                  </p>
                )}
              </div>
              {!viewOnly && (
                <button type="button" className="btn btn-secondary btn-sm" style={{ width: "fit-content" }}
                  disabled={salvando} onClick={handleRevogar}>
                  Revogar vínculo
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && !temVinculo && (
          <div className="card">
            <div className="card-title">Vincular minha conta PF</div>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55, margin: "0 0 16px" }}>
              Informe o e-mail da conta Pessoa Física já cadastrada no Fluxiva.
              Cada empresa PJ pode ter apenas <strong>uma</strong> PF vinculada.
            </p>

            {viewOnly ? (
              <div className="alert alert-info" style={{ margin: 0 }}>
                Modo visualização — vínculos não podem ser alterados.
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">E-mail da conta PF</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input className="form-input" type="email" placeholder="pf@email.com"
                      value={email} onChange={(e) => { setEmail(e.target.value); setPfPreview(null); }}
                      style={{ flex: "1 1 220px" }} />
                    <button type="button" className="btn btn-secondary" disabled={buscando || !email.trim()}
                      onClick={handleBuscar}>
                      {buscando ? "Buscando..." : "Verificar"}
                    </button>
                  </div>
                </div>

                {pfPreview && (
                  <div className="alert alert-info" style={{ marginTop: 12 }}>
                    <strong>{pfPreview.nome}</strong>
                    <span style={{ display: "block", fontSize: 12, marginTop: 4 }}>{pfPreview.email}</span>
                  </div>
                )}

                <div style={{ marginTop: 16 }}>
                  <button type="button" className="btn btn-primary"
                    disabled={salvando || !pfPreview}
                    onClick={handleVincular}>
                    {salvando ? "Vinculando..." : "Vincular minha conta PF"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {erro && (
          <div className="alert alert-warn" style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertCircle size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
            {erro}
          </div>
        )}
        {msg && (
          <div className="alert alert-info" style={{ marginTop: 14 }}>{msg}</div>
        )}
      </div>
    </div>
  );
}
