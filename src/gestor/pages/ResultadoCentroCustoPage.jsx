/**
 * Etapa 5.8 — Centros de custo / projetos + resultado por centro.
 */
import { useMemo, useState } from "react";
import { useGestor } from "../GestorContext.jsx";
import { isPessoaFisica } from "../profileLabels.js";
import { fmtBRL } from "../finance.js";
import {
  CENTRO_CUSTO_STATUS,
  getResultadoPorCentroCusto,
} from "../centroCusto.js";
import PfPageShell from "../components/pf/PfPageShell.jsx";
import { Layers, PenLine, Pause } from "../components/icons.jsx";

function PeriodoHint({ filterPeriodo }) {
  const { ano, mes } = filterPeriodo || {};
  const label = mes ? `${ano} — mês ${mes}` : ano || "todos os períodos";
  return (
    <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 16px", lineHeight: 1.5 }}>
      Período do filtro global: <strong>{label}</strong>. Centro de custo no lançamento é opcional.
    </p>
  );
}

function CadastroCentros({ viewOnly, centroCustos, centroCustoCrud, openModal, onMsg }) {
  const handleInativar = (cc) => {
    if (viewOnly || cc.status === CENTRO_CUSTO_STATUS.INATIVO) return;
    if (!window.confirm(`Inativar "${cc.nome}"? Lançamentos antigos mantêm a referência.`)) return;
    centroCustoCrud.update(cc.id, { status: CENTRO_CUSTO_STATUS.INATIVO });
    onMsg("Centro de custo inativado.");
  };

  const handleReativar = (cc) => {
    if (viewOnly) return;
    centroCustoCrud.update(cc.id, { status: CENTRO_CUSTO_STATUS.ATIVO });
    onMsg("Centro de custo reativado.");
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div
        className="card-title"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Layers size={18} strokeWidth={2} aria-hidden />
          Centros de custo / projetos
        </span>
        {!viewOnly && (
          <button type="button" className="pp-btn-primary" onClick={() => openModal("centro-custo")}>
            + Novo centro de custo
          </button>
        )}
      </div>

      {!centroCustos.length ? (
        <div className="pp-empty" style={{ padding: "24px 16px" }}>
          <div className="pp-empty-text">Nenhum centro cadastrado.</div>
          {!viewOnly && (
            <button
              type="button"
              className="pp-btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => openModal("centro-custo")}
            >
              Cadastrar primeiro centro
            </button>
          )}
        </div>
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
                        <button
                          type="button"
                          className="pp-icon-btn"
                          title="Editar"
                          onClick={() => openModal("centro-custo", cc)}
                        >
                          <PenLine size={14} strokeWidth={2} aria-hidden />
                        </button>
                        {cc.status === CENTRO_CUSTO_STATUS.ATIVO ? (
                          <button
                            type="button"
                            className="pp-icon-btn"
                            title="Inativar"
                            onClick={() => handleInativar(cc)}
                          >
                            <Pause size={14} strokeWidth={2} aria-hidden />
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
    openModal,
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
        openModal={openModal}
        onMsg={setMsg}
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
