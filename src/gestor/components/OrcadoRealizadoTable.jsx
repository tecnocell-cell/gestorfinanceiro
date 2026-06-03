import { fmtBRL } from "../finance.js";
import { PROJETO_STATUS } from "../projetoFinanceiro.js";
import { CENTRO_CUSTO_STATUS } from "../centroCusto.js";

function VarCell({ valor, alerta, tipo }) {
  const isReceita = tipo === "receita";
  let color;
  if (alerta === "acima") {
    color = isReceita ? "var(--success, #15803d)" : "var(--destructive, #b91c1c)";
  } else if (alerta === "abaixo") {
    color = isReceita ? "var(--destructive, #b91c1c)" : "var(--success, #15803d)";
  }
  return (
    <td className="td-mono" style={{ textAlign: "right", color }}>
      {fmtBRL(valor)}
      {alerta && (
        <span
          className={`badge ${alerta === "acima" ? "badge-cp-atrasado" : "badge-cp-pago"}`}
          style={{ marginLeft: 6, fontSize: 10 }}
          title={alerta === "acima" ? "Acima do orçamento" : "Abaixo do orçamento"}
        >
          {alerta === "acima" ? "↑" : "↓"}
        </span>
      )}
    </td>
  );
}

export function OrcadoRealizadoTable({ rows, totais, showClienteColumn = false }) {
  return (
    <div className="table-wrap" style={{ overflowX: "auto" }}>
      <table className="orc-realizado-table">
        <thead>
          <tr>
            <th rowSpan={2}>Nome</th>
            {showClienteColumn && <th rowSpan={2}>Cliente</th>}
            <th colSpan={3} style={{ textAlign: "center" }}>
              Receita
            </th>
            <th colSpan={3} style={{ textAlign: "center" }}>
              Despesa
            </th>
            <th colSpan={3} style={{ textAlign: "center" }}>
              Resultado
            </th>
          </tr>
          <tr>
            <th style={{ textAlign: "right" }}>Prevista</th>
            <th style={{ textAlign: "right" }}>Realizada</th>
            <th style={{ textAlign: "right" }}>Var.</th>
            <th style={{ textAlign: "right" }}>Prevista</th>
            <th style={{ textAlign: "right" }}>Realizada</th>
            <th style={{ textAlign: "right" }}>Var.</th>
            <th style={{ textAlign: "right" }}>Previsto</th>
            <th style={{ textAlign: "right" }}>Realizado</th>
            <th style={{ textAlign: "right" }}>Var.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const key = r.referenciaId || "__none__";
            const inativo =
              r.status === PROJETO_STATUS.INATIVO || r.status === CENTRO_CUSTO_STATUS.INATIVO;
            return (
              <tr key={key}>
                <td style={{ fontWeight: 600, minWidth: 140 }}>
                  {r.nome}
                  {inativo && (
                    <span className="badge badge-cp-atrasado" style={{ marginLeft: 6, fontSize: 10 }}>
                      Inativo
                    </span>
                  )}
                </td>
                {showClienteColumn && (
                  <td style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    {r.clienteNome || "—"}
                  </td>
                )}
                <td className="td-mono" style={{ textAlign: "right" }}>
                  {fmtBRL(r.receitaPrevista)}
                </td>
                <td className="td-mono" style={{ textAlign: "right", color: "var(--success, #15803d)" }}>
                  {fmtBRL(r.receitaRealizada)}
                </td>
                <VarCell valor={r.variacaoReceita} alerta={r.alertaReceita} tipo="receita" />
                <td className="td-mono" style={{ textAlign: "right" }}>
                  {fmtBRL(r.despesaPrevista)}
                </td>
                <td className="td-mono" style={{ textAlign: "right", color: "var(--destructive, #b91c1c)" }}>
                  {fmtBRL(r.despesaRealizada)}
                </td>
                <VarCell valor={r.variacaoDespesa} alerta={r.alertaDespesa} tipo="despesa" />
                <td className="td-mono" style={{ textAlign: "right" }}>
                  {fmtBRL(r.resultadoPrevisto)}
                </td>
                <td className="td-mono" style={{ textAlign: "right", fontWeight: 600 }}>
                  {fmtBRL(r.resultadoRealizado)}
                </td>
                <td className="td-mono" style={{ textAlign: "right", fontWeight: 600 }}>
                  {fmtBRL(r.variacaoResultado)}
                </td>
              </tr>
            );
          })}
          {rows.length > 0 && (
            <tr style={{ borderTop: "2px solid var(--border)" }}>
              <td style={{ fontWeight: 700 }} colSpan={showClienteColumn ? 2 : 1}>
                Total
              </td>
              <td className="td-mono" style={{ textAlign: "right", fontWeight: 700 }}>
                {fmtBRL(totais.receitaPrevista)}
              </td>
              <td className="td-mono" style={{ textAlign: "right", fontWeight: 700 }}>
                {fmtBRL(totais.receitaRealizada)}
              </td>
              <td className="td-mono" style={{ textAlign: "right", fontWeight: 700 }}>
                {fmtBRL(totais.variacaoReceita)}
              </td>
              <td className="td-mono" style={{ textAlign: "right", fontWeight: 700 }}>
                {fmtBRL(totais.despesaPrevista)}
              </td>
              <td className="td-mono" style={{ textAlign: "right", fontWeight: 700 }}>
                {fmtBRL(totais.despesaRealizada)}
              </td>
              <td className="td-mono" style={{ textAlign: "right", fontWeight: 700 }}>
                {fmtBRL(totais.variacaoDespesa)}
              </td>
              <td className="td-mono" style={{ textAlign: "right", fontWeight: 700 }}>
                {fmtBRL(totais.resultadoPrevisto)}
              </td>
              <td className="td-mono" style={{ textAlign: "right", fontWeight: 700 }}>
                {fmtBRL(totais.resultadoRealizado)}
              </td>
              <td className="td-mono" style={{ textAlign: "right", fontWeight: 700 }}>
                {fmtBRL(totais.variacaoResultado)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {!rows.length && (
        <p style={{ padding: 12, fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
          Nenhum dado no período. Cadastre orçamento mensal ou lance movimentações com centro/projeto/cliente.
        </p>
      )}
    </div>
  );
}
