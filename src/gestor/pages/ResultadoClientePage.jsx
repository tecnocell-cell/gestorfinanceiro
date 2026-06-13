import { useMemo } from "react";
import { useGestor } from "../GestorContext.jsx";
import { isPessoaFisica } from "../profileLabels.js";
import { getResultadoPorCliente } from "../projetoFinanceiro.js";
import PfPageShell from "../components/pf/PfPageShell.jsx";
import { Users } from "../components/icons.jsx";
import { PeriodoHint, ResultadoFinanceiroTable } from "../components/ResultadoFinanceiroTable.jsx";
import ExportPdfButton from "../components/ExportPdfButton.jsx";
import { useAuth } from "../AuthContext.jsx";
import { fmtBRL } from "../finance.js";

function Conteudo({ pfMode }) {
  const { user } = useAuth();
  const { lancamentos, planoContas, clientes, filterPeriodo, tipo, company, pessoa } = useGestor();
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
        hint="Cliente no lançamento é opcional. Cadastre clientes na seção Clientes ou use os já existentes."
      />
      <div className="card">
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={18} strokeWidth={2} aria-hidden />
          Resultado por Cliente
        </div>
        <ResultadoFinanceiroTable rows={rows} totais={totais} />
        <div style={{ marginTop: 12 }}>
          <ExportPdfButton
            getExportData={() => ({
              title: "Resultado por Cliente",
              periodo: [filterPeriodo.mes, filterPeriodo.ano].filter(Boolean).join("/"),
              usuario: user?.email || "",
              empresa: company?.nomeFantasia || pessoa?.nome || "",
              columns: [
                { header: "Cliente", dataKey: "cliente" },
                { header: "Receitas", dataKey: "receitas" },
                { header: "Despesas", dataKey: "despesas" },
                { header: "Resultado", dataKey: "resultado" },
              ],
              rows: rows.map((r) => ({
                cliente: r.nome,
                receitas: fmtBRL(r.receitas),
                despesas: fmtBRL(r.despesas),
                resultado: fmtBRL(r.resultado),
              })),
              totals: [
                { label: "Receitas", value: fmtBRL(totais.receitas) },
                { label: "Despesas", value: fmtBRL(totais.despesas) },
                { label: "Resultado", value: fmtBRL(totais.resultado) },
              ],
              filename: "resultado_cliente.pdf",
            })}
          />
        </div>
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
