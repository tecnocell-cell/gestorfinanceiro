import { fmtBRL } from "../finance.js";
import { PROJETO_STATUS } from "../projetoFinanceiro.js";
import { CENTRO_CUSTO_STATUS } from "../centroCusto.js";

export function ResultadoFinanceiroTable({ rows, totais, showClienteColumn = false }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            {showClienteColumn && <th>Cliente</th>}
            <th style={{ textAlign: "right" }}>Receitas</th>
            <th style={{ textAlign: "right" }}>Despesas</th>
            <th style={{ textAlign: "right" }}>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const key = r.clienteId ?? r.projetoId ?? r.centroCustoId ?? "__none__";
            const inativo =
              r.status === PROJETO_STATUS.INATIVO || r.status === CENTRO_CUSTO_STATUS.INATIVO;
            return (
              <tr key={key}>
                <td style={{ fontWeight: 600 }}>
                  {r.nome}
                  {inativo && (
                    <span className="badge badge-cp-atrasado" style={{ marginLeft: 6, fontSize: 10 }}>
                      Inativo
                    </span>
                  )}
                </td>
                {showClienteColumn && (
                  <td style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{r.clienteNome || "—"}</td>
                )}
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
            );
          })}
          {rows.length > 0 && (
            <tr style={{ borderTop: "2px solid var(--border)" }}>
              <td style={{ fontWeight: 700 }} colSpan={showClienteColumn ? 2 : 1}>
                Total
              </td>
              <td className="td-mono" style={{ textAlign: "right", fontWeight: 700 }}>
                {fmtBRL(totais.receitas)}
              </td>
              <td className="td-mono" style={{ textAlign: "right", fontWeight: 700 }}>
                {fmtBRL(totais.despesas)}
              </td>
              <td className="td-mono" style={{ textAlign: "right", fontWeight: 700 }}>
                {fmtBRL(totais.resultado)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {!rows.length && (
        <p style={{ padding: 12, fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
          Nenhum lançamento classificável no período.
        </p>
      )}
    </div>
  );
}

export function PeriodoHint({ filterPeriodo, hint }) {
  const { ano, mes } = filterPeriodo || {};
  const label = mes ? `${ano} — mês ${mes}` : ano || "todos os períodos";
  return (
    <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 16px", lineHeight: 1.5 }}>
      Período do filtro global: <strong>{label}</strong>. {hint}
    </p>
  );
}
