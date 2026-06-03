/**
 * Etapa 5.9 — CRUD de projetos financeiros (associados a clientes).
 */
import { useMemo, useState } from "react";
import { useGestor } from "../GestorContext.jsx";
import { isPessoaJuridica } from "../profileLabels.js";
import { PROJETO_STATUS } from "../projetoFinanceiro.js";
import { fmtDate } from "../finance.js";
import PfPageShell from "../components/pf/PfPageShell.jsx";
import { Briefcase, PenLine, Pause } from "../components/icons.jsx";
import PlanLimitNotice from "../components/PlanLimitNotice.jsx";

function Conteudo() {
  const { viewOnly, projetos, projetoCrud, clientes, openModal } = useGestor();
  const [msg, setMsg] = useState(null);
  const [erro, setErro] = useState(null);

  const sorted = useMemo(
    () => [...(projetos || [])].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")),
    [projetos]
  );

  const clienteNome = (id) => (clientes || []).find((c) => c.id === id)?.nome || "—";

  const handleInativar = (p) => {
    if (viewOnly || p.status === PROJETO_STATUS.INATIVO) return;
    if (!window.confirm(`Inativar projeto "${p.nome}"?`)) return;
    projetoCrud.update(p.id, { status: PROJETO_STATUS.INATIVO });
    setMsg("Projeto inativado.");
  };

  const handleReativar = (p) => {
    if (viewOnly) return;
    projetoCrud.update(p.id, { status: PROJETO_STATUS.ATIVO });
    setMsg("Projeto reativado.");
  };

  return (
    <div>
      <PlanLimitNotice feature="projetos" limitKey="projetos" />
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 16px", lineHeight: 1.5 }}>
        Projetos podem ser vinculados a um cliente e referenciados opcionalmente nos lançamentos.
      </p>

      <div className="card">
        <div
          className="card-title"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Briefcase size={18} strokeWidth={2} aria-hidden />
            Projetos cadastrados ({sorted.length})
          </span>
          {!viewOnly && (
            <button type="button" className="pp-btn-primary" onClick={() => openModal("projeto-financeiro")}>
              + Novo projeto
            </button>
          )}
        </div>

        {!sorted.length ? (
          <div className="pp-empty" style={{ padding: "24px 16px" }}>
            <div className="pp-empty-text">Nenhum projeto cadastrado.</div>
            {!viewOnly && (
              <button
                type="button"
                className="pp-btn-primary"
                style={{ marginTop: 12 }}
                onClick={() => openModal("projeto-financeiro")}
              >
                Cadastrar primeiro projeto
              </button>
            )}
          </div>
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
                          <button
                            type="button"
                            className="pp-icon-btn"
                            title="Editar"
                            onClick={() => openModal("projeto-financeiro", p)}
                          >
                            <PenLine size={14} strokeWidth={2} aria-hidden />
                          </button>
                          {p.status === PROJETO_STATUS.ATIVO ? (
                            <button
                              type="button"
                              className="pp-icon-btn"
                              title="Inativar"
                              onClick={() => handleInativar(p)}
                            >
                              <Pause size={14} strokeWidth={2} aria-hidden />
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
