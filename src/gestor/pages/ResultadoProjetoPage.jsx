import { useMemo } from "react";
import { useGestor } from "../GestorContext.jsx";
import { isPessoaFisica } from "../profileLabels.js";
import { getResultadoPorProjeto } from "../projetoFinanceiro.js";
import PfPageShell from "../components/pf/PfPageShell.jsx";
import { Briefcase } from "../components/icons.jsx";
import { PeriodoHint, ResultadoFinanceiroTable } from "../components/ResultadoFinanceiroTable.jsx";

function Conteudo({ pfMode }) {
  const { lancamentos, planoContas, projetos, clientes, filterPeriodo, tipo } = useGestor();
  const isPF = pfMode || isPessoaFisica(tipo);

  const { rows, totais } = useMemo(
    () =>
      getResultadoPorProjeto(lancamentos, planoContas, projetos, clientes, {
        ano: filterPeriodo.ano,
        mes: filterPeriodo.mes,
        isPF,
      }),
    [lancamentos, planoContas, projetos, clientes, filterPeriodo, isPF]
  );

  return (
    <div>
      <PeriodoHint
        filterPeriodo={filterPeriodo}
        hint="Projeto e cliente nos lançamentos são opcionais. Cadastre projetos na aba Projetos."
      />
      <div className="card">
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Briefcase size={18} strokeWidth={2} aria-hidden />
          Resultado por Projeto
        </div>
        <ResultadoFinanceiroTable rows={rows} totais={totais} showClienteColumn />
      </div>
    </div>
  );
}

export default function ResultadoProjetoPage({ pfMode = false }) {
  if (pfMode) {
    return (
      <PfPageShell title="Resultado por Projeto" subtitle="Receitas, despesas e resultado por projeto">
        <Conteudo pfMode />
      </PfPageShell>
    );
  }
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Resultado por Projeto</h1>
        <p className="page-subtitle">Consolidação por projeto (e cliente vinculado) no período filtrado</p>
      </div>
      <Conteudo />
    </div>
  );
}
