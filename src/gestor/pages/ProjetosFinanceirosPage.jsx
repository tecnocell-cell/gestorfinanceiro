/**
 * Etapa 5.9 — CRUD de projetos financeiros (associados a clientes).
 */
import { useMemo, useState } from "react";
import { useGestor } from "../GestorContext.jsx";
import { isPessoaJuridica } from "../profileLabels.js";
import { createProjeto, PROJETO_STATUS } from "../projetoFinanceiro.js";
import { fmtDate } from "../finance.js";
import PfPageShell from "../components/pf/PfPageShell.jsx";
import { Briefcase, PenLine, Pause } from "../components/icons.jsx";

const VAZIO = {
  nome: "",
  clienteId: "",
  descricao: "",
  dataInicio: "",
  dataFim: "",
  status: PROJETO_STATUS.ATIVO,
};

function Conteudo() {
  const { viewOnly, projetos, projetoCrud, clientes } = useGestor();
  const [form, setForm] = useState({ ...VAZIO });
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [erro, setErro] = useState(null);

  const sorted = useMemo(
    () => [...(projetos || [])].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")),
    [projetos]
  );

  const clienteNome = (id) => (clientes || []).find((c) => c.id === id)?.nome || "—";

  const reset = () => {
    setEditId(null);
    setForm({ ...VAZIO });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (viewOnly) return;
    const nome = form.nome.trim();
    if (!nome) {
      setErro("Informe o nome do projeto.");
      return;
    }
    setErro(null);
    const payload = {
      nome,
      clienteId: form.clienteId || null,
      descricao: form.descricao.trim(),
      dataInicio: form.dataInicio || "",
      dataFim: form.dataFim || "",
      ...(editId ? { status: form.status } : {}),
    };
    if (editId) {
      projetoCrud.update(editId, payload);
      setMsg("Projeto atualizado.");
    } else {
      projetoCrud.add(createProjeto(payload));
      setMsg("Projeto cadastrado.");
    }
    reset();
  };

  const handleEdit = (p) => {
    setEditId(p.id);
    setForm({
      nome: p.nome,
      clienteId: p.clienteId || "",
      descricao: p.descricao || "",
      dataInicio: p.dataInicio || "",
      dataFim: p.dataFim || "",
      status: p.status,
    });
  };

  const handleInativar = (p) => {
    if (viewOnly || p.status === PROJETO_STATUS.INATIVO) return;
    if (!window.confirm(`Inativar projeto "${p.nome}"?`)) return;
    projetoCrud.update(p.id, { status: PROJETO_STATUS.INATIVO });
    if (editId === p.id) reset();
    setMsg("Projeto inativado.");
  };

  const handleReativar = (p) => {
    if (viewOnly) return;
    projetoCrud.update(p.id, { status: PROJETO_STATUS.ATIVO });
    setMsg("Projeto reativado.");
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 16px", lineHeight: 1.5 }}>
        Projetos podem ser vinculados a um cliente e referenciados opcionalmente nos lançamentos.
      </p>

      {!viewOnly && (
        <div className="card" style={{ marginBottom: 16, padding: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            {editId ? "Editar projeto" : "Novo projeto"}
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
              <label style={{ fontSize: 12 }}>
                <span style={{ color: "var(--muted-foreground)" }}>Nome *</span>
                <input className="input" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
              </label>
              <label style={{ fontSize: 12 }}>
                <span style={{ color: "var(--muted-foreground)" }}>Cliente</span>
                <select className="input" value={form.clienteId} onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}>
                  <option value="">— Nenhum —</option>
                  {(clientes || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 12 }}>
                <span style={{ color: "var(--muted-foreground)" }}>Início</span>
                <input className="input" type="date" value={form.dataInicio} onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))} />
              </label>
              <label style={{ fontSize: 12 }}>
                <span style={{ color: "var(--muted-foreground)" }}>Fim</span>
                <input className="input" type="date" value={form.dataFim} onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))} />
              </label>
              {editId && (
                <label style={{ fontSize: 12 }}>
                  <span style={{ color: "var(--muted-foreground)" }}>Status</span>
                  <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value={PROJETO_STATUS.ATIVO}>Ativo</option>
                    <option value={PROJETO_STATUS.INATIVO}>Inativo</option>
                  </select>
                </label>
              )}
              <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Descrição</span>
                <input className="input" value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="submit" className="btn btn-primary btn-sm">{editId ? "Salvar" : "Cadastrar"}</button>
              {editId && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>Cancelar</button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Briefcase size={18} strokeWidth={2} aria-hidden />
          Projetos cadastrados ({sorted.length})
        </div>
        {!sorted.length ? (
          <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Nenhum projeto cadastrado.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Cliente</th>
                  <th>Período</th>
                  <th>Status</th>
                  {!viewOnly && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.nome}</td>
                    <td style={{ fontSize: 12 }}>{p.clienteId ? clienteNome(p.clienteId) : "—"}</td>
                    <td style={{ fontSize: 12 }}>
                      {p.dataInicio ? fmtDate(p.dataInicio) : "—"}
                      {p.dataFim ? ` → ${fmtDate(p.dataFim)}` : ""}
                    </td>
                    <td>
                      <span className={`badge ${p.status === PROJETO_STATUS.ATIVO ? "badge-cp-pago" : "badge-cp-atrasado"}`}>
                        {p.status === PROJETO_STATUS.ATIVO ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    {!viewOnly && (
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleEdit(p)}>
                            <PenLine size={12} strokeWidth={2} aria-hidden />
                          </button>
                          {p.status === PROJETO_STATUS.ATIVO ? (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleInativar(p)}>
                              <Pause size={12} strokeWidth={2} aria-hidden />
                            </button>
                          ) : (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleReativar(p)}>
                              Reativar
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {erro && <div className="alert alert-warn" style={{ marginTop: 14 }}>{erro}</div>}
      {msg && <div className="alert alert-info" style={{ marginTop: 14 }}>{msg}</div>}
    </div>
  );
}

export default function ProjetosFinanceirosPage({ pfMode = false }) {
  const { tipo } = useGestor();
  const isPJ = isPessoaJuridica(tipo) && !pfMode;

  if (pfMode) {
    return (
      <PfPageShell title="Projetos" subtitle="Cadastro de projetos vinculados a clientes">
        <Conteudo />
      </PfPageShell>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Projetos</h1>
        <p className="page-subtitle">
          {isPJ
            ? "Cadastre projetos e associe a clientes; use nos lançamentos de forma opcional."
            : "Projetos para classificar receitas e despesas (cliente opcional)."}
        </p>
      </div>
      <Conteudo />
    </div>
  );
}
