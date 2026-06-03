/**
 * Etapa 5.8 — Centros de custo / projetos + resultado por centro.
 */
import { useMemo, useState } from "react";
import { useGestor } from "../GestorContext.jsx";
import { isPessoaFisica } from "../profileLabels.js";
import { fmtBRL } from "../finance.js";
import {
  CENTRO_CUSTO_STATUS,
  createCentroCusto,
  getResultadoPorCentroCusto,
} from "../centroCusto.js";
import PfPageShell from "../components/pf/PfPageShell.jsx";
import { Layers, PenLine, Pause } from "../components/icons.jsx";

const VAZIO_FORM = { nome: "", descricao: "" };

function PeriodoHint({ filterPeriodo }) {
  const { ano, mes } = filterPeriodo || {};
  const label = mes ? `${ano} — mês ${mes}` : ano || "todos os períodos";
  return (
    <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 16px", lineHeight: 1.5 }}>
      Período do filtro global: <strong>{label}</strong>. Centro de custo no lançamento é opcional.
    </p>
  );
}

function CadastroCentros({ viewOnly, centroCustos, centroCustoCrud, onMsg, onErro }) {
  const [form, setForm] = useState({ ...VAZIO_FORM });
  const [editId, setEditId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const reset = () => {
    setEditId(null);
    setForm({ ...VAZIO_FORM });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (viewOnly) return;
    const nome = form.nome.trim();
    if (!nome) {
      onErro("Informe o nome do centro de custo / projeto.");
      return;
    }
    setSalvando(true);
    onErro(null);
    try {
      if (editId) {
        centroCustoCrud.update(editId, {
          nome,
          descricao: form.descricao.trim(),
        });
        onMsg("Centro de custo atualizado.");
      } else {
        centroCustoCrud.add(createCentroCusto({ nome, descricao: form.descricao }));
        onMsg("Centro de custo cadastrado.");
      }
      reset();
    } catch (err) {
      onErro(err.message || "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const handleEdit = (cc) => {
    setEditId(cc.id);
    setForm({ nome: cc.nome, descricao: cc.descricao || "" });
  };

  const handleInativar = (cc) => {
    if (viewOnly || cc.status === CENTRO_CUSTO_STATUS.INATIVO) return;
    if (!window.confirm(`Inativar "${cc.nome}"? Lançamentos antigos mantêm a referência.`)) return;
    centroCustoCrud.update(cc.id, { status: CENTRO_CUSTO_STATUS.INATIVO });
    if (editId === cc.id) reset();
    onMsg("Centro de custo inativado.");
  };

  const handleReativar = (cc) => {
    if (viewOnly) return;
    centroCustoCrud.update(cc.id, { status: CENTRO_CUSTO_STATUS.ATIVO });
    onMsg("Centro de custo reativado.");
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Layers size={18} strokeWidth={2} aria-hidden />
        Centros de custo / projetos
      </div>

      {!viewOnly && (
        <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            <label style={{ fontSize: 12 }}>
              <span style={{ color: "var(--muted-foreground)" }}>Nome *</span>
              <input
                className="input"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex.: Projeto Alpha"
              />
            </label>
            <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
              <span style={{ color: "var(--muted-foreground)" }}>Descrição</span>
              <input
                className="input"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Opcional"
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
              {salvando ? "Salvando..." : editId ? "Salvar alterações" : "Cadastrar"}
            </button>
            {editId && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {!centroCustos.length ? (
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
          Nenhum centro cadastrado. Crie um para classificar lançamentos e ver o resultado abaixo.
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Descrição</th>
                <th>Status</th>
                {!viewOnly && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {centroCustos.map((cc) => (
                <tr key={cc.id}>
                  <td style={{ fontWeight: 600 }}>{cc.nome}</td>
                  <td style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{cc.descricao || "—"}</td>
                  <td>
                    <span className={`badge ${cc.status === CENTRO_CUSTO_STATUS.ATIVO ? "badge-cp-pago" : "badge-cp-atrasado"}`}>
                      {cc.status === CENTRO_CUSTO_STATUS.ATIVO ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  {!viewOnly && (
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button type="button" className="btn btn-secondary btn-sm" title="Editar" onClick={() => handleEdit(cc)}>
                          <PenLine size={12} strokeWidth={2} aria-hidden />
                        </button>
                        {cc.status === CENTRO_CUSTO_STATUS.ATIVO ? (
                          <button type="button" className="btn btn-secondary btn-sm" title="Inativar" onClick={() => handleInativar(cc)}>
                            <Pause size={12} strokeWidth={2} aria-hidden />
                          </button>
                        ) : (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleReativar(cc)}>
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
  );
}

function TabelaResultado({ rows, totais }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Centro / Projeto</th>
            <th style={{ textAlign: "right" }}>Receitas</th>
            <th style={{ textAlign: "right" }}>Despesas</th>
            <th style={{ textAlign: "right" }}>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.centroCustoId || "__none__"}>
              <td style={{ fontWeight: 600 }}>
                {r.nome}
                {r.status === CENTRO_CUSTO_STATUS.INATIVO && (
                  <span className="badge badge-cp-atrasado" style={{ marginLeft: 6, fontSize: 10 }}>Inativo</span>
                )}
              </td>
              <td className="td-mono" style={{ textAlign: "right", color: "var(--success, #15803d)" }}>
                {fmtBRL(r.receitas)}
              </td>
              <td className="td-mono" style={{ textAlign: "right", color: "var(--destructive, #b91c1c)" }}>
                {fmtBRL(r.despesas)}
              </td>
              <td className="td-mono" style={{ textAlign: "right", fontWeight: 700 }}>
                {fmtBRL(r.resultado)}
              </td>
            </tr>
          ))}
          {rows.length > 0 && (
            <tr style={{ borderTop: "2px solid var(--border)" }}>
              <td style={{ fontWeight: 700 }}>Total</td>
              <td className="td-mono" style={{ textAlign: "right", fontWeight: 700 }}>{fmtBRL(totais.receitas)}</td>
              <td className="td-mono" style={{ textAlign: "right", fontWeight: 700 }}>{fmtBRL(totais.despesas)}</td>
              <td className="td-mono" style={{ textAlign: "right", fontWeight: 700 }}>{fmtBRL(totais.resultado)}</td>
            </tr>
          )}
        </tbody>
      </table>
      {!rows.length && (
        <p style={{ padding: 12, fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
          Nenhum lançamento classificável no período (receitas/despesas com plano de contas).
        </p>
      )}
    </div>
  );
}

function Conteudo({ pfMode = false }) {
  const {
    viewOnly,
    tipo,
    lancamentos,
    planoContas,
    centroCustos,
    centroCustoCrud,
    filterPeriodo,
  } = useGestor();
  const [msg, setMsg] = useState(null);
  const [erro, setErro] = useState(null);
  const isPF = pfMode || isPessoaFisica(tipo);

  const { rows, totais } = useMemo(
    () =>
      getResultadoPorCentroCusto(lancamentos, planoContas, centroCustos, {
        ano: filterPeriodo.ano,
        mes: filterPeriodo.mes,
        isPF,
      }),
    [lancamentos, planoContas, centroCustos, filterPeriodo, isPF]
  );

  const sortedCentros = useMemo(
    () => [...(centroCustos || [])].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")),
    [centroCustos]
  );

  return (
    <div>
      <PeriodoHint filterPeriodo={filterPeriodo} />
      <CadastroCentros
        viewOnly={viewOnly}
        centroCustos={sortedCentros}
        centroCustoCrud={centroCustoCrud}
        onMsg={setMsg}
        onErro={setErro}
      />
      <div className="card">
        <div className="card-title">Resultado por Centro de Custo</div>
        <TabelaResultado rows={rows} totais={totais} />
      </div>
      {erro && <div className="alert alert-warn" style={{ marginTop: 14 }}>{erro}</div>}
      {msg && <div className="alert alert-info" style={{ marginTop: 14 }}>{msg}</div>}
    </div>
  );
}

export default function ResultadoCentroCustoPage({ pfMode = false }) {
  if (pfMode) {
    return (
      <PfPageShell title="Resultado por Centro de Custo" subtitle="Receitas, despesas e resultado por projeto">
        <Conteudo pfMode />
      </PfPageShell>
    );
  }
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Resultado por Centro de Custo</h1>
        <p className="page-subtitle">Classifique lançamentos e acompanhe receitas, despesas e resultado por centro ou projeto</p>
      </div>
      <Conteudo />
    </div>
  );
}
