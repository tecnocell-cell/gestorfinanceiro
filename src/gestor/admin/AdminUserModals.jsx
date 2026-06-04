import { useState } from "react";
import { adminApi } from "../api.js";

export function ModalNovoUsuario({ onClose, onCreated }) {
  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    tipo_perfil: "juridica",
    nome_perfil: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome_perfil.trim()) {
      setError(
        form.tipo_perfil === "juridica" ? "Informe o nome da empresa." : "Informe o nome do perfil."
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { user } = await adminApi.createUser(form);
      onCreated(user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header modal-header-forest">
          <div>
            <h2 className="modal-title" style={{ color: "var(--primary-foreground)" }}>
              ➕ Novo Cliente
            </h2>
            <p
              style={{
                color: "color-mix(in oklab, var(--primary-foreground) 75%, transparent)",
                margin: "4px 0 0",
                fontSize: 12,
              }}
            >
              Cria uma conta de acesso ao sistema
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div style={{ marginBottom: 18 }}>
            <label className="form-label">Tipo de perfil</label>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {[
                ["juridica", "🏢", "Pessoa Jurídica", "Empresa, MEI"],
                ["fisica", "👤", "Pessoa Física", "Finanças pessoais"],
              ].map(([v, icon, title, sub]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set("tipo_perfil", v)}
                  className={`profile-item ${form.tipo_perfil === v ? "active" : ""}`}
                  style={{ flex: 1, flexDirection: "column", textAlign: "center", marginBottom: 0 }}
                >
                  <div style={{ fontSize: 20 }}>{icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{title}</div>
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div className="form-group">
              <label className="form-label">Nome completo do responsável</label>
              <input
                className="form-input"
                type="text"
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                {form.tipo_perfil === "juridica" ? "Nome da empresa" : "Nome do perfil"}
              </label>
              <input
                className="form-input"
                type="text"
                value={form.nome_perfil}
                onChange={(e) => set("nome_perfil", e.target.value)}
                required
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input
                  className="form-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Senha inicial</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.senha}
                  onChange={(e) => set("senha", e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>
          </div>
          {error && <div className="alert alert-warn" style={{ marginTop: 14 }}>⚠ {error}</div>}
          <div className="modal-footer" style={{ margin: "20px -1.25rem -1.25rem", borderRadius: 0 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
              {loading ? "Criando…" : "✓ Criar conta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ModalResetSenha({ user, onClose }) {
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await adminApi.resetPassword(user.id, senha);
      setOk(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3 className="modal-title">🔑 Redefinir Senha</h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>{user.email}</p>
        </div>
        <div className="modal-body">
          {ok ? (
            <>
              <div className="alert alert-success">✅ Senha redefinida!</div>
              <button type="button" onClick={onClose} className="btn btn-secondary" style={{ width: "100%" }}>
                Fechar
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nova senha</label>
                <input
                  className="form-input"
                  type="text"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                />
              </div>
              {error && <div className="alert alert-warn" style={{ marginBottom: 12 }}>⚠ {error}</div>}
              <div className="modal-footer" style={{ margin: "16px -1.25rem -1.25rem", borderRadius: 0 }}>
                <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
                  {loading ? "Aguarde…" : "Redefinir"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
