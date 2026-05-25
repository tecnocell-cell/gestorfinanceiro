import { useState, useEffect, useCallback } from "react";
import { adminApi, authApi } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

// ─── Utilitários ─────────────────────────────────────────────────────────────
const fmt = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "Nunca";
const fmtDt = (iso) => iso ? new Date(iso).toLocaleString("pt-BR") : "Nunca";

function Badge({ tipo }) {
  const isPF = tipo === "fisica";
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
      background: isPF ? "#eff6ff" : "#f0fdf4",
      color: isPF ? "#1d4ed8" : "#065f46",
      border: `1px solid ${isPF ? "#bfdbfe" : "#a7f3d0"}`,
    }}>
      {isPF ? "PF" : "PJ"}
    </span>
  );
}

function StatusBadge({ ativo }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
      background: ativo ? "#f0fdf4" : "#fef2f2",
      color: ativo ? "#16a34a" : "#dc2626",
      border: `1px solid ${ativo ? "#bbf7d0" : "#fecaca"}`,
    }}>
      {ativo ? "● Ativo" : "○ Inativo"}
    </span>
  );
}

// ─── Modal: Novo usuário ──────────────────────────────────────────────────────
function ModalNovoUsuario({ onClose, onCreated }) {
  const [form, setForm] = useState({
    nome: "", email: "", senha: "",
    tipo_perfil: "juridica", nome_perfil: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome_perfil.trim()) {
      setError(form.tipo_perfil === "juridica" ? "Informe o nome da empresa." : "Informe o nome do perfil.");
      return;
    }
    setLoading(true); setError(null);
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

  const inp = {
    width: "100%", padding: "10px 12px", borderRadius: 8, fontFamily: "inherit",
    border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none",
    color: "#0f172a", boxSizing: "border-box",
  };
  const lbl = { display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", marginBottom: 5 };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:500, boxShadow:"0 24px 60px rgba(0,0,0,0.15)", overflow:"hidden" }}>
        <div style={{ background:"linear-gradient(135deg,#10b981,#0d9488)", padding:"20px 24px" }}>
          <h2 style={{ color:"#fff", margin:0, fontSize:17, fontWeight:800 }}>➕ Novo Cliente</h2>
          <p style={{ color:"rgba(255,255,255,0.75)", margin:"4px 0 0", fontSize:12 }}>
            Cria uma conta de acesso ao sistema
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding:"24px" }}>
          {/* Tipo */}
          <div style={{ marginBottom:18 }}>
            <label style={lbl}>Tipo de perfil</label>
            <div style={{ display:"flex", gap:10 }}>
              {[["juridica","🏢","Pessoa Jurídica","Empresa, MEI"],["fisica","👤","Pessoa Física","Finanças pessoais"]].map(([v,icon,title,sub])=>(
                <button key={v} type="button" onClick={()=>set("tipo_perfil",v)} style={{
                  flex:1, padding:"10px 8px", borderRadius:10, cursor:"pointer",
                  border: form.tipo_perfil===v ? "2px solid #10b981" : "2px solid #e2e8f0",
                  background: form.tipo_perfil===v ? "#f0fdf4" : "#f8fafc",
                  textAlign:"center", fontFamily:"inherit",
                }}>
                  <div style={{ fontSize:20 }}>{icon}</div>
                  <div style={{ fontSize:12, fontWeight:700, color: form.tipo_perfil===v?"#065f46":"#334155", marginTop:2 }}>{title}</div>
                  <div style={{ fontSize:10, color:"#94a3b8" }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:"grid", gap:14 }}>
            <div>
              <label style={lbl}>Nome completo do responsável</label>
              <input style={inp} type="text" placeholder="João Silva" value={form.nome} onChange={e=>set("nome",e.target.value)} required />
            </div>
            <div>
              <label style={lbl}>{form.tipo_perfil==="juridica" ? "Nome da empresa / razão social" : "Nome do perfil"}</label>
              <input style={inp} type="text" placeholder={form.tipo_perfil==="juridica" ? "Minha Empresa Ltda" : "Finanças Pessoais"} value={form.nome_perfil} onChange={e=>set("nome_perfil",e.target.value)} required />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={lbl}>E-mail de acesso</label>
                <input style={inp} type="email" placeholder="cliente@email.com" value={form.email} onChange={e=>set("email",e.target.value)} required />
              </div>
              <div>
                <label style={lbl}>Senha inicial</label>
                <input style={inp} type="text" placeholder="Mínimo 6 caracteres" value={form.senha} onChange={e=>set("senha",e.target.value)} required minLength={6} />
              </div>
            </div>
          </div>

          {error && (
            <div style={{ marginTop:14, padding:"10px 14px", borderRadius:8, background:"#fef2f2", border:"1px solid #fecaca", color:"#dc2626", fontSize:13 }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ display:"flex", gap:10, marginTop:20 }}>
            <button type="button" onClick={onClose} style={{
              flex:1, padding:"11px", borderRadius:9, border:"1.5px solid #e2e8f0",
              background:"#f8fafc", color:"#64748b", fontWeight:600, fontSize:14,
              cursor:"pointer", fontFamily:"inherit",
            }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{
              flex:2, padding:"11px", borderRadius:9, border:"none",
              background: loading ? "#94a3b8" : "linear-gradient(135deg,#10b981,#0d9488)",
              color:"#fff", fontWeight:700, fontSize:14, cursor: loading?"not-allowed":"pointer",
              fontFamily:"inherit", boxShadow: loading?"none":"0 4px 14px rgba(16,185,129,0.3)",
            }}>
              {loading ? "Criando…" : "✓ Criar conta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Resetar senha ─────────────────────────────────────────────────────
function ModalResetSenha({ user, onClose }) {
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
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
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1001 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:400, padding:28, boxShadow:"0 24px 60px rgba(0,0,0,0.15)" }}>
        <h3 style={{ margin:"0 0 4px", fontSize:16, fontWeight:800 }}>🔑 Redefinir Senha</h3>
        <p style={{ margin:"0 0 20px", fontSize:13, color:"#64748b" }}>{user.email}</p>
        {ok ? (
          <>
            <div style={{ padding:"12px 16px", borderRadius:8, background:"#f0fdf4", border:"1px solid #a7f3d0", color:"#065f46", fontSize:14, marginBottom:16 }}>
              ✅ Senha redefinida com sucesso!
            </div>
            <button onClick={onClose} style={{ width:"100%", padding:"11px", borderRadius:9, border:"none", background:"#f1f5f9", color:"#334155", fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Fechar</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:"#64748b", marginBottom:6 }}>Nova senha</label>
            <input style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #e2e8f0", fontSize:14, outline:"none", boxSizing:"border-box", fontFamily:"inherit", marginBottom:14 }}
              type="text" placeholder="Mínimo 6 caracteres" value={senha} onChange={e=>setSenha(e.target.value)} required minLength={6} autoFocus />
            {error && <div style={{ padding:"8px 12px", borderRadius:8, background:"#fef2f2", color:"#dc2626", fontSize:13, marginBottom:12 }}>⚠ {error}</div>}
            <div style={{ display:"flex", gap:10 }}>
              <button type="button" onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:9, border:"1.5px solid #e2e8f0", background:"#f8fafc", color:"#64748b", fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
              <button type="submit" disabled={loading} style={{ flex:2, padding:"10px", borderRadius:9, border:"none", background:"#f59e0b", color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {loading ? "Aguarde…" : "Redefinir"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Painel Admin principal ───────────────────────────────────────────────────
export default function AdminPage() {
  const { user: adminUser, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNovo, setShowNovo] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  const loadUsers = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { users } = await adminApi.listUsers();
      setUsers(users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleToggle = async (id) => {
    try {
      const { ativo } = await adminApi.toggleUser(id);
      setUsers(us => us.map(u => u.id === id ? { ...u, ativo } : u));
    } catch (err) {
      alert("Erro: " + err.message);
    }
  };

  const handleDelete = async (u) => {
    if (!confirm(`Excluir permanentemente a conta de ${u.nome} (${u.email})?\\nTodos os dados financeiros serão apagados!`)) return;
    try {
      await adminApi.deleteUser(u.id);
      setUsers(us => us.filter(x => x.id !== u.id));
    } catch (err) {
      alert("Erro: " + err.message);
    }
  };

  const tenants = users.filter(u => u.role !== "admin");
  const tenantsFiltrados = tenants.filter(u => {
    const ok_busca = !busca || u.nome.toLowerCase().includes(busca.toLowerCase()) || u.email.toLowerCase().includes(busca.toLowerCase()) || u.nome_perfil?.toLowerCase().includes(busca.toLowerCase());
    const ok_tipo = filtroTipo === "todos" || u.tipo_perfil === filtroTipo;
    return ok_busca && ok_tipo;
  });

  const totalAtivos = tenants.filter(u => u.ativo).length;
  const totalPJ = tenants.filter(u => u.tipo_perfil === "juridica").length;
  const totalPF = tenants.filter(u => u.tipo_perfil === "fisica").length;

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      {/* Topbar admin */}
      <div style={{ background:"linear-gradient(135deg,#10b981,#0d9488)", padding:"0 32px", display:"flex", alignItems:"center", justifyContent:"space-between", height:60, boxShadow:"0 2px 12px rgba(0,0,0,0.15)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:34, height:34, borderRadius:9, background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:"#fff" }}>GF</div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:"#fff", letterSpacing:"-0.02em" }}>Gestor Financeiro</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)" }}>Painel do Administrador</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:13, color:"rgba(255,255,255,0.85)" }}>{adminUser?.nome || adminUser?.email}</span>
          <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(255,255,255,0.2)", color:"#fff", border:"1px solid rgba(255,255,255,0.3)" }}>ADMIN</span>
          <button onClick={logout} title="Sair" style={{ background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.3)", borderRadius:8, color:"#fff", fontSize:13, cursor:"pointer", padding:"6px 12px", fontFamily:"inherit", fontWeight:600 }}>
            Sair ⏏
          </button>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"32px 24px" }}>
        {/* KPIs */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:28 }}>
          {[
            { label:"Total de clientes", value: tenants.length, icon:"👥", color:"#0ea5e9" },
            { label:"Contas ativas",     value: totalAtivos,    icon:"✅", color:"#10b981" },
            { label:"Pessoa Jurídica",   value: totalPJ,        icon:"🏢", color:"#8b5cf6" },
            { label:"Pessoa Física",     value: totalPF,        icon:"👤", color:"#f59e0b" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} style={{ background:"#fff", borderRadius:14, padding:"18px 20px", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", borderTop:`3px solid ${color}` }}>
              <div style={{ fontSize:24 }}>{icon}</div>
              <div style={{ fontSize:28, fontWeight:800, color:"#0f172a", marginTop:6, lineHeight:1 }}>{value}</div>
              <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Header da tabela */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, gap:12, flexWrap:"wrap" }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:"#0f172a" }}>Clientes / Tenants</h2>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            {/* Filtros */}
            <input
              placeholder="Buscar por nome, e-mail..."
              value={busca} onChange={e=>setBusca(e.target.value)}
              style={{ padding:"8px 12px", borderRadius:9, border:"1.5px solid #e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", width:220 }}
            />
            <select value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)} style={{ padding:"8px 10px", borderRadius:9, border:"1.5px solid #e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", background:"#fff" }}>
              <option value="todos">Todos os tipos</option>
              <option value="juridica">Pessoa Jurídica</option>
              <option value="fisica">Pessoa Física</option>
            </select>
            <button onClick={() => setShowNovo(true)} style={{
              padding:"9px 18px", borderRadius:9, border:"none",
              background:"linear-gradient(135deg,#10b981,#0d9488)",
              color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer",
              fontFamily:"inherit", boxShadow:"0 4px 12px rgba(16,185,129,0.3)",
              whiteSpace:"nowrap",
            }}>
              ➕ Novo Cliente
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div style={{ background:"#fff", borderRadius:16, boxShadow:"0 1px 4px rgba(0,0,0,0.06)", overflow:"hidden" }}>
          {loading ? (
            <div style={{ textAlign:"center", padding:"48px", color:"#94a3b8" }}>Carregando…</div>
          ) : error ? (
            <div style={{ textAlign:"center", padding:"48px", color:"#dc2626" }}>⚠ {error}</div>
          ) : tenantsFiltrados.length === 0 ? (
            <div style={{ textAlign:"center", padding:"48px" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
              <div style={{ fontSize:15, fontWeight:700, color:"#334155" }}>Nenhum cliente cadastrado</div>
              <div style={{ fontSize:13, color:"#94a3b8", marginTop:6 }}>Clique em "Novo Cliente" para adicionar o primeiro</div>
            </div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:"2px solid #f1f5f9" }}>
                  {["Cliente","E-mail","Perfil / Empresa","Tipo","Status","Último acesso","Criado em","Ações"].map(h => (
                    <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", color:"#94a3b8" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenantsFiltrados.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom:"1px solid #f8fafc", background: i%2===0 ? "#fff" : "#fafcff" }}>
                    <td style={{ padding:"14px 16px" }}>
                      <div style={{ fontWeight:700, fontSize:14, color:"#0f172a" }}>{u.nome}</div>
                    </td>
                    <td style={{ padding:"14px 16px", fontSize:13, color:"#475569" }}>{u.email}</td>
                    <td style={{ padding:"14px 16px", fontSize:13, color:"#334155", fontWeight:600 }}>{u.nome_perfil || "—"}</td>
                    <td style={{ padding:"14px 16px" }}><Badge tipo={u.tipo_perfil} /></td>
                    <td style={{ padding:"14px 16px" }}><StatusBadge ativo={u.ativo} /></td>
                    <td style={{ padding:"14px 16px", fontSize:12, color:"#94a3b8" }}>{fmtDt(u.ultimo_acesso)}</td>
                    <td style={{ padding:"14px 16px", fontSize:12, color:"#94a3b8" }}>{fmt(u.created_at)}</td>
                    <td style={{ padding:"14px 16px" }}>
                      <div style={{ display:"flex", gap:6 }}>
                        <button
                          onClick={() => handleToggle(u.id)}
                          title={u.ativo ? "Desativar acesso" : "Ativar acesso"}
                          style={{ padding:"5px 10px", borderRadius:7, border:"1.5px solid #e2e8f0", background: u.ativo ? "#fef2f2" : "#f0fdf4", color: u.ativo ? "#dc2626" : "#16a34a", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                          {u.ativo ? "Bloquear" : "Ativar"}
                        </button>
                        <button
                          onClick={() => setResetTarget(u)}
                          title="Redefinir senha"
                          style={{ padding:"5px 10px", borderRadius:7, border:"1.5px solid #e2e8f0", background:"#fffbeb", color:"#d97706", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                          🔑
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          title="Excluir conta"
                          style={{ padding:"5px 10px", borderRadius:7, border:"1.5px solid #fecaca", background:"#fef2f2", color:"#dc2626", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showNovo && (
        <ModalNovoUsuario
          onClose={() => setShowNovo(false)}
          onCreated={(u) => setUsers(prev => [...prev, u])}
        />
      )}
      {resetTarget && (
        <ModalResetSenha user={resetTarget} onClose={() => setResetTarget(null)} />
      )}
    </div>
  );
}
