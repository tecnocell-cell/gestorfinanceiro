import { useMemo } from "react";
import { useGestor } from "../GestorContext.jsx";
import { isPessoaFisica } from "../profileLabels.js";
import { getResultadoPorCliente } from "../projetoFinanceiro.js";
import PfPageShell from "../components/pf/PfPageShell.jsx";
import { Users } from "../components/icons.jsx";
import { PeriodoHint, ResultadoFinanceiroTable } from "../components/ResultadoFinanceiroTable.jsx";

function Conteudo({ pfMode }) {
  const { lancamentos, planoContas, clientes, filterPeriodo, tipo } = useGestor();
  const isPF = pfMode || isPessoaFisica(tipo);

  const { rows, totais } = useMemo(
    () =>
      getResultadoPorCliente(lancamentos, planoContas, clientes, {
        ano: filterPeriodo.ano,
        mes: filterPeriodo.mes,
        isPF,
      }),
    [lancamentos, planoContas, clientes, filterPeriodo, isPF]
  );

  return (
    <div>
      <PeriodoHint
        filterPeriodo={filterPeriodo}
        hint="Cliente no lançamento é opcional. Cadastre clientes em Clientes (PJ) ou use os já existentes."
      />
      <div className="card">
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={18} strokeWidth={2} aria-hidden />
          Resultado por Cliente
        </div>
        <ResultadoFinanceiroTable rows={rows} totais={totais} />
      </div>
    </div>
  );
}

export default function ResultadoClientePage({ pfMode = false }) {
  if (pfMode) {
    return (
      <PfPageShell title="Resultado por Cliente" subtitle="Receitas, despesas e resultado por cliente">
        <Conteudo pfMode />
      </PfPageShell>
    );
  }
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Resultado por Cliente</h1>
        <p className="page-subtitle">Consolidação de receitas e despesas por cliente no período filtrado</p>
      </div>
      <Conteudo />
    </div>
  );
}
