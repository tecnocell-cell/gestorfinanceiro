/**
 * Etapa 6.0 — Orçado x Realizado (centro, cliente, projeto).
 */
import { useMemo, useState } from "react";
import { useGestor } from "../GestorContext.jsx";
import { isPessoaFisica } from "../profileLabels.js";
import { MESES } from "../constants.js";
import PfPageShell from "../components/pf/PfPageShell.jsx";
import { GitCompare } from "../components/icons.jsx";
import { PeriodoHint } from "../components/ResultadoFinanceiroTable.jsx";
import { OrcadoRealizadoTable } from "../components/OrcadoRealizadoTable.jsx";
import {
  getOrcadoRealizadoPorCentro,
  getOrcadoRealizadoPorCliente,
  getOrcadoRealizadoPorProjeto,
} from "../orcamentoRealizado.js";

const TABS_RELATORIO = [
  { id: "centro", label: "Centro de Custo" },
  { id: "cliente", label: "Cliente" },
  { id: "projeto", label: "Projeto" },
];

const TABS_CADASTRO = [
  { id: "centro", label: "Por centro de custo" },
  { id: "projeto", label: "Por projeto" },
];

function PeriodToolbar() {
  const { filterPeriodo, setFilterPeriodo } = useGestor();
  return (
    <div className="period-selector">
      <span style={{ color: "var(--text2)", fontSize: 13 }}>Período:</span>
      <select
        value={filterPeriodo.ano}
        onChange={(e) => setFilterPeriodo((p) => ({ ...p, ano: e.target.value }))}
      >
        {["2022", "2023", "2024", "2025", "2026", "2027"].map((y) => (
          <option key={y}>{y}</option>
        ))}
      </select>
      <select
        value={filterPeriodo.mes}
        onChange={(e) => setFilterPeriodo((p) => ({ ...p, mes: e.target.value }))}
      >
        <option value="">Todos os meses</option>
        {MESES.map((m, i) => (
          <option key={m} value={(i + 1).toString().padStart(2, "0")}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}

function Conteudo({ pfMode }) {
  const {
    viewOnly,
    lancamentos,
    planoContas,
    centroCustos,
    projetos,
    clientes,
    orcamentosCentros,
    orcamentosProjetos,
    filterPeriodo,
    tipo,
    openModal,
  } = useGestor();

  const isPF = pfMode || isPessoaFisica(tipo);
  const [tabRel, setTabRel] = useState("centro");
  const [tabCad, setTabCad] = useState("centro");
  const [msg, setMsg] = useState(null);
  const [erro, setErro] = useState(null);

  const opts = useMemo(
    () => ({
      lancamentos,
      planoContas,
      ano: filterPeriodo.ano,
      mes: filterPeriodo.mes,
      isPF,
    }),
    [lancamentos, planoContas, filterPeriodo, isPF]
  );

  const centroData = useMemo(
    () =>
      getOrcadoRealizadoPorCentro({
        ...opts,
        centroCustos,
        orcamentosCentros,
      }),
    [opts, centroCustos, orcamentosCentros]
  );

  const projetoData = useMemo(
    () =>
      getOrcadoRealizadoPorProjeto({
        ...opts,
        projetos,
        clientes,
        orcamentosProjetos,
      }),
    [opts, projetos, clientes, orcamentosProjetos]
  );

  const clienteData = useMemo(
    () =>
      getOrcadoRealizadoPorCliente({
        ...opts,
        clientes,
        projetos,
        orcamentosProjetos,
      }),
    [opts, clientes, projetos, orcamentosProjetos]
  );

  const relAtivo =
    tabRel === "centro" ? centroData : tabRel === "projeto" ? projetoData : clienteData;

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <PeriodToolbar />
      </div>

      {msg && (
        <div className="alert alert-success" style={{ marginBottom: 12 }}>
          {msg}
        </div>
      )}
      {erro && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          {erro}
        </div>
      )}

      {!filterPeriodo.mes && (
        <div className="alert alert-warn" style={{ marginBottom: 14 }}>
          Selecione um mês para cadastrar orçamento mensal. O relatório funciona com ano inteiro ou mês
          específico.
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div
          className="card-title"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
        >
          <span>Orçamento mensal previsto</span>
          {!viewOnly && (
            <button
              type="button"
              className="pp-btn-primary"
              disabled={!filterPeriodo.mes}
              title={!filterPeriodo.mes ? "Selecione um mês no filtro acima" : undefined}
              onClick={() => openModal("orcamento-mensal", { tipoCadastro: tabCad })}
            >
              + Definir orçamento
            </button>
          )}
        </div>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 12px", lineHeight: 1.5 }}>
          Cliente usa a soma dos orçamentos dos projetos vinculados. Centro de custo e projeto no lançamento
          continuam opcionais.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 0, flexWrap: "wrap" }}>
          {TABS_CADASTRO.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`btn btn-sm ${tabCad === t.id ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTabCad(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <GitCompare size={18} strokeWidth={2} aria-hidden />
          Orçado x Realizado
        </div>
        <PeriodoHint
          filterPeriodo={filterPeriodo}
          hint="Variação = realizado − previsto. Despesa acima do orçamento e receita abaixo são destacados."
        />
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {TABS_RELATORIO.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`btn btn-sm ${tabRel === t.id ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTabRel(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <OrcadoRealizadoTable
          rows={relAtivo.rows}
          totais={relAtivo.totais}
          showClienteColumn={tabRel === "projeto"}
        />
        {tabRel === "cliente" && (
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 12, marginBottom: 0 }}>
            Previsto por cliente agrega os orçamentos mensais dos projetos daquele cliente.
          </p>
        )}
      </div>
    </div>
  );
}

export default function OrcadoRealizadoPage({ pfMode = false }) {
  if (pfMode) {
    return (
      <PfPageShell
        title="Orçado x Realizado"
        subtitle="Compare orçamento previsto com receitas e despesas realizadas"
      >
        <Conteudo pfMode />
      </PfPageShell>
    );
  }
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Orçado x Realizado</h1>
        <p className="page-subtitle">
          Orçamento mensal por centro de custo e projeto; comparativo por cliente, projeto e centro
        </p>
      </div>
      <Conteudo />
    </div>
  );
}
