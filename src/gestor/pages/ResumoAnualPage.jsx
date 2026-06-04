import { useEffect, useMemo, useState } from "react";
import { useGestor } from "../GestorContext.jsx";
import { addMoney, fmtBRL } from "../finance.js";
import { MESES } from "../constants.js";
import { buildResumoAnual } from "../resumoAnual.js";
import PfPageShell from "../components/pf/PfPageShell.jsx";
import { useAuth } from "../AuthContext.jsx";
import { exportResumoAnualPdf } from "../export/pdfExport.js";
import {
  LineChart,
  Target,
  Heart,
  Smile,
  Wallet,
  TrendingUp,
  BarChart3,
  Info,
} from "../components/icons.jsx";

function AnnualMatrix({ labelCol, rows, totais, emptyLabel, tone = "default", totalLabel = "TOTAL" }) {
  return (
    <div className="ra-matrix-wrap">
      <table className="ra-matrix">
        <thead>
          <tr>
            <th className="ra-matrix-sticky">{labelCol}</th>
            {MESES.map((m) => (
              <th key={m}>{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="ra-matrix-sticky ra-matrix-empty" colSpan={13}>
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className="ra-matrix-sticky ra-matrix-label">{row.label}</td>
                {row.meses.map((v, i) => (
                  <td key={i} className="ra-matrix-num">{fmtBRL(v)}</td>
                ))}
              </tr>
            ))
          )}
          {totais && (
            <tr className={`ra-matrix-total ra-matrix-total--${tone}`}>
              <td className="ra-matrix-sticky ra-matrix-total-label">{totalLabel}</td>
              {totais.map((v, i) => (
                <td key={i} className="ra-matrix-num ra-matrix-num--bold">{fmtBRL(v)}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AnnualSection({ title, subtitle, icon: Icon, tone = "default", children }) {
  return (
    <section className={`ra-section ra-section--${tone}`}>
      <header className="ra-section-head">
        <span className={`ra-section-icon ra-section-icon--${tone}`} aria-hidden>
          <Icon size={18} strokeWidth={2} />
        </span>
        <div>
          <h2 className="ra-section-title">{title}</h2>
          {subtitle && <p className="ra-section-sub">{subtitle}</p>}
        </div>
      </header>
      <div className="ra-section-body">{children}</div>
    </section>
  );
}

function KpiStrip({ items }) {
  return (
    <div className="ra-kpi-grid">
      {items.map((k) => (
        <div key={k.label} className={`ra-kpi ra-kpi--${k.tone}`}>
          <div className="ra-kpi-label">{k.label}</div>
          <div className="ra-kpi-value">{k.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function ResumoAnualPage({ variant = "pf" }) {
  const isPF = variant === "pf";
  const { user } = useAuth();
  const {
    lancamentos,
    planoContas,
    contas,
    metas,
    filterPeriodo,
    setFilterPeriodo,
  } = useGestor();

  const [contaId, setContaId] = useState("");

  useEffect(() => {
    setFilterPeriodo((p) => ({ ...p, mes: "" }));
  }, [setFilterPeriodo]);

  const ano = filterPeriodo.ano || new Date().getFullYear().toString();

  const data = useMemo(
    () =>
      buildResumoAnual({
        lancamentos,
        planoContas,
        contas,
        metas: isPF ? metas : [],
        ano,
        contaId,
        isPF,
      }),
    [lancamentos, planoContas, contas, metas, ano, contaId, isPF]
  );

  const kpis = isPF
    ? [
        { label: "Receita", value: fmtBRL(data.kpis.receita), tone: "in" },
        { label: "Investido (SER)", value: fmtBRL(data.kpis.ser), tone: "ser" },
        { label: "Gasto (VBSP)", value: fmtBRL(data.kpis.vbsp), tone: "vbsp" },
        { label: "Gastei Sem Culpa (GSC)", value: fmtBRL(data.kpis.gsc), tone: "gsc" },
        { label: "Saldo Atual", value: fmtBRL(data.kpis.saldoAtual), tone: "saldo" },
      ]
    : [
        { label: "Receita", value: fmtBRL(data.kpis.receita), tone: "in" },
        { label: "Custos + Impostos", value: fmtBRL(data.pjSections?.custos.totais.reduce((a, b) => addMoney(a, b), 0) ?? 0), tone: "out" },
        { label: "Despesas", value: fmtBRL(data.pjSections?.despesas.totais.reduce((a, b) => addMoney(a, b), 0) ?? 0), tone: "vbsp" },
        { label: "Lucro (ano)", value: fmtBRL((data.pjSections?.lucroMeses ?? []).reduce((a, b) => addMoney(a, b), 0)), tone: "ser" },
        { label: "Saldo Atual", value: fmtBRL(data.kpis.saldoAtual), tone: "saldo" },
      ];

  const resumoRows = [
    { label: "Receita", meses: data.resumo.receitaMeses, tone: "in" },
    { label: "Total Investido (SER)", meses: data.resumo.serMeses, tone: "ser" },
    {
      label: isPF ? "Total Gasto (VBSP + GSC)" : "Total Despesas + Custos",
      meses: data.resumo.gastoTotalMeses,
      tone: "out",
    },
    { label: "Fechamento do mês", meses: data.resumo.fechamentoMeses, tone: "fechamento", highlight: true },
    { label: "Saldo em contas", meses: data.resumo.saldoContaMeses, tone: "saldo", highlight: true },
    { label: "Saldo projetado", meses: data.resumo.saldoProjetadoMeses, tone: "proj", highlight: true },
  ];

  const content = (
    <div className="ra-root">
      <header className="ra-hero">
        <div className="ra-hero-text">
          <h1 className="ra-hero-title">Resumo Anual</h1>
          <p className="ra-hero-sub">Visualize para onde vai e de onde vem seu dinheiro</p>
        </div>
        <div className="ra-hero-filters">
          <label className="ra-filter">
            <span>Banco</span>
            <select value={contaId} onChange={(e) => setContaId(e.target.value)} aria-label="Filtrar por conta">
              <option value="">Todos os bancos</option>
              {contas.filter((c) => !c.inativo).map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>
          <label className="ra-filter">
            <span>Ano</span>
            <select
              value={ano}
              onChange={(e) => setFilterPeriodo((p) => ({ ...p, ano: e.target.value }))}
              aria-label="Ano"
            >
              {["2023", "2024", "2025", "2026", "2027"].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const headers = ["", ...MESES];
              const sections = [
                {
                  title: "Resumo",
                  headers,
                  rows: resumoRows.map((r) => [r.label, ...r.meses.map((v) => fmtBRL(v))]),
                },
              ];
              exportResumoAnualPdf({
                ano,
                usuario: user?.email || user?.nome || "",
                kpis: kpis.map((k) => ({ label: k.label, value: k.value })),
                sections,
                filename: `resumo_anual_${ano}.pdf`,
              });
            }}
          >
            Exportar PDF
          </button>
        </div>
      </header>

      <KpiStrip items={kpis} />

      <AnnualSection title="Saldo Atual Mensal" icon={Wallet} tone="saldo">
        <AnnualMatrix
          labelCol="Contas Bancárias"
          rows={data.saldoContas.rows}
          totais={data.saldoContas.totais}
          totalLabel="SALDO ATUAL TOTAL"
          emptyLabel="Nenhuma conta cadastrada"
          tone="saldo"
        />
      </AnnualSection>

      <AnnualSection title="Origem das Receitas" icon={TrendingUp} tone="in">
        <AnnualMatrix
          labelCol="Categoria"
          rows={data.receitas.rows}
          totais={data.receitas.totais}
          emptyLabel="Nenhuma categoria de receita encontrada"
          tone="in"
        />
      </AnnualSection>

      {isPF && (
        <>
          <AnnualSection
            title="Sonhar e Realizar (SER)"
            subtitle="Metas e categorias de investimento / poupança"
            icon={Target}
            tone="ser"
          >
            <AnnualMatrix
              labelCol="Categoria"
              rows={data.ser.rows}
              totais={data.ser.totais}
              emptyLabel="Nenhuma meta ou categoria SER — cadastre em Metas ou use classificação SER na categoria"
              tone="ser"
            />
          </AnnualSection>

          <AnnualSection title="Viver Bem Sem se Privar (VBSP)" icon={Heart} tone="vbsp">
            <AnnualMatrix
              labelCol="Categoria"
              rows={data.vbsp.rows}
              totais={data.vbsp.totais}
              emptyLabel="Nenhuma categoria VBSP"
              tone="vbsp"
            />
          </AnnualSection>

          <AnnualSection title="Gastei Sem Culpa (GSC)" icon={Smile} tone="gsc">
            <AnnualMatrix
              labelCol="Categoria"
              rows={data.gsc.rows}
              totais={data.gsc.totais}
              emptyLabel="Nenhuma categoria GSC — ex.: Lazer, Vestuário"
              tone="gsc"
            />
          </AnnualSection>
        </>
      )}

      {!isPF && data.pjSections && (
        <>
          <AnnualSection title="Custos e Impostos" icon={BarChart3} tone="out">
            <AnnualMatrix
              labelCol="Categoria"
              rows={data.pjSections.custos.rows}
              totais={data.pjSections.custos.totais}
              emptyLabel="Nenhum custo/imposto no plano de contas"
              tone="out"
            />
          </AnnualSection>
          <AnnualSection title="Despesas Operacionais" icon={BarChart3} tone="vbsp">
            <AnnualMatrix
              labelCol="Categoria"
              rows={data.pjSections.despesas.rows}
              totais={data.pjSections.despesas.totais}
              emptyLabel="Nenhuma despesa cadastrada"
              tone="vbsp"
            />
          </AnnualSection>
        </>
      )}

      <AnnualSection title="Resumo Final do Orçamento" icon={LineChart} tone="fechamento">
        <div className="ra-matrix-wrap">
          <table className="ra-matrix">
            <thead>
              <tr>
                <th className="ra-matrix-sticky">Resumo</th>
                {MESES.map((m) => (
                  <th key={m}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resumoRows.map((row) => (
                <tr
                  key={row.label}
                  className={row.highlight ? "ra-matrix-highlight" : ""}
                >
                  <td className="ra-matrix-sticky ra-matrix-label">
                    {row.highlight && <Info size={12} strokeWidth={2} className="ra-info-icon" aria-hidden />}
                    {row.label}
                  </td>
                  {row.meses.map((v, i) => (
                    <td
                      key={i}
                      className={`ra-matrix-num${row.highlight ? " ra-matrix-num--highlight" : ""}${v < 0 ? " ra-matrix-num--neg" : ""}`}
                    >
                      {fmtBRL(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AnnualSection>
    </div>
  );

  if (isPF) {
    return <PfPageShell pageId="resumo-anual">{content}</PfPageShell>;
  }
  return content;
}
