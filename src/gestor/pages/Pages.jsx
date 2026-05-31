import { useState, useRef, useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart, Line,
} from "recharts";
import { MESES, CHART } from "../constants.js";
import { fmtBRL, fmtPct, fmtDate, fmtDateTime, lancamentosComSaldoConta, contaPorCodigo, generateId } from "../finance.js";
import RecorrenciaAlert from "../components/RecorrenciaAlert.jsx";
import CustomTooltip from "../components/CustomTooltip.jsx";
import { useGestor } from "../GestorContext.jsx";
import {
  parseOFX,
  parseMercadoPagoCSV,
  parseXlsxFile,
  rowsToLancamentos,
  mergeOFXToLancamentos,
  exportDominio,
  exportJSON,
  importJSONFile,
  exportRelatorioCSV,
  marcarExportadosDominio,
} from "../importExport.js";
import { nextLote } from "../finance.js";
import { DEFAULT_CATS_PJ } from "../defaultCategories.js";
import { PenLine, Trash2 } from "../components/icons.jsx";

function PeriodToolbar() {
  const { filterPeriodo, setFilterPeriodo } = useGestor();
  return (
    <div className="period-selector">
      <span style={{ color: "var(--text2)", fontSize: 13 }}>Período:</span>
      <select value={filterPeriodo.ano} onChange={(e) => setFilterPeriodo((p) => ({ ...p, ano: e.target.value }))}>
        {["2022", "2023", "2024", "2025", "2026", "2027"].map((y) => <option key={y}>{y}</option>)}
      </select>
      <select value={filterPeriodo.mes} onChange={(e) => setFilterPeriodo((p) => ({ ...p, mes: e.target.value }))}>
        <option value="">Todos os meses</option>
        {MESES.map((m, i) => (
          <option key={m} value={(i + 1).toString().padStart(2, "0")}>{m}</option>
        ))}
      </select>
    </div>
  );
}

export function DashboardPage() {
  const { dreAtual, mensal, contas, getSaldoConta, getSaldoTotal, filterPeriodo, setFilterPeriodo } = useGestor();
  const pieData = [
    { name: "Receita", value: dreAtual.receitas },
    { name: "Custos", value: dreAtual.custos },
    { name: "Despesas", value: dreAtual.despesas },
    { name: "Impostos", value: dreAtual.impostos },
    { name: "Lucro", value: Math.max(dreAtual.lucroAposImpostos ?? dreAtual.lucroLiquido, 0) },
  ].filter((d) => d.value > 0);
  const COLORS = [...CHART.pie, "#7c3aed"];

  return (
    <div>
      <div className="toolbar">
        <PeriodToolbar />
      </div>
      <RecorrenciaAlert />
      <div className="kpi-grid">
        <div className="kpi-card" style={{ "--kpi-color": "var(--accent)" }}>
          <div className="kpi-label">Receita Total</div>
          <div className="kpi-value">{fmtBRL(dreAtual.receitas)}</div>
          <div className="kpi-sub">Entradas no período</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": "var(--danger)" }}>
          <div className="kpi-label">Custos</div>
          <div className="kpi-value">{fmtBRL(dreAtual.custos)}</div>
          <div className="kpi-sub">CMV e prod. diretos</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": "var(--accent2)" }}>
          <div className="kpi-label">Despesas</div>
          <div className="kpi-value">{fmtBRL(dreAtual.despesas)}</div>
          <div className="kpi-sub">Operacionais</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": "#7c3aed" }}>
          <div className="kpi-label">Impostos</div>
          <div className="kpi-value">{fmtBRL(dreAtual.impostos)}</div>
          <div className="kpi-sub">Simples / IRPJ / etc.</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": dreAtual.lucroAposImpostos >= 0 ? "var(--accent)" : "var(--danger)" }}>
          <div className="kpi-label">Lucro Líquido</div>
          <div className="kpi-value">{fmtBRL(dreAtual.lucroAposImpostos ?? dreAtual.lucroLiquido)}</div>
          <div className="kpi-sub">{fmtPct(dreAtual.lucroAposImpPct ?? dreAtual.lucroPct)} de margem</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": "var(--accent3)" }}>
          <div className="kpi-label">Saldo Total</div>
          <div className="kpi-value">{fmtBRL(getSaldoTotal())}</div>
          <div className="kpi-sub">{contas.filter((c) => !c.inativo).length} contas</div>
        </div>
      </div>
      <div className="charts-grid">
        <div className="card">
          <div className="card-title">Receita ?? Custo ?? Despesa (Mensal)</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={mensal}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 11 }} />
              <YAxis tick={{ fill: CHART.tick, fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Receita" fill={CHART.receita} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Custo" fill={CHART.custo} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesas" fill={CHART.despesas} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="card-title">Lucro Líquido Mensal</div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={mensal}>
              <defs>
                <linearGradient id="lucroGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART.lucro} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={CHART.lucro} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 11 }} />
              <YAxis tick={{ fill: CHART.tick, fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Lucro Líquido" stroke={CHART.lucro} fill="url(#lucroGrad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="charts-grid">
        <div className="card">
          <div className="card-title">Saldo por Conta</div>
          <div className="saldo-grid" style={{ marginBottom: 0 }}>
            {contas.filter((c) => !c.inativo).map((c) => (
              <div key={c.id} className="saldo-card">
                <div className="saldo-tipo">{c.tipo}</div>
                <div className="saldo-nome">{c.apelido || c.nome}</div>
                <div className="saldo-valor">{fmtBRL(getSaldoConta(c.id))}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Composição do Resultado</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmtBRL(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function LancamentosPage() {
  const {
    lancsFiltrados, contas, planoContas, clientes, fornecedores,
    search, setSearch, tipoFilter, setTipoFilter,
    consiliadoFilter, setConsiliadoFilter, contaFilter, setContaFilter,
    showSaldoCol, setShowSaldoCol, openModal, lancCrud, lancamentos, filterPeriodo,
  } = useGestor();

  const rows = contaFilter
    ? lancamentosComSaldoConta(lancamentos, contas, contaFilter).filter((l) =>
        lancsFiltrados.some((f) => f.id === l.id)
      )
    : lancsFiltrados;

  const saldoAnterior = useMemo(() => {
    if (!contaFilter) return null;
    const conta = contas.find((c) => c.id === contaFilter);
    if (!conta) return null;
    const { ano, mes } = filterPeriodo;
    const beforeDate = mes ? `${ano}-${mes}-01` : ano ? `${ano}-01-01` : null;
    if (!beforeDate) return null;
    let saldo = conta.saldoInicial || 0;
    lancamentos
      .filter((l) => l.data < beforeDate && (l.contaEntradaId === contaFilter || l.contaSaidaId === contaFilter))
      .sort((a, b) => a.data.localeCompare(b.data))
      .forEach((l) => {
        if (l.contaEntradaId === contaFilter) saldo += l.valor;
        if (l.contaSaidaId === contaFilter) saldo -= l.valor;
      });
    return saldo;
  }, [contaFilter, filterPeriodo, lancamentos, contas]);

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <PeriodToolbar />
          <div className="search-wrap">
            <span className="search-icon">?</span>
            <input className="search-input" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 160 }} value={contaFilter} onChange={(e) => setContaFilter(e.target.value)}>
            <option value="">Todas as contas</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.apelido || c.nome}</option>)}
          </select>
        </div>
        <div className="toolbar-right">
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text2)" }}>
            <input type="checkbox" checked={showSaldoCol} onChange={(e) => setShowSaldoCol(e.target.checked)} disabled={!contaFilter} />
            Coluna saldo
          </label>
          <button type="button" className="btn btn-primary" onClick={() => openModal("lancamento")}>+ Novo Lançamento</button>
        </div>
      </div>
      <div className="filter-bar">
        {["Todos", "Entrada", "Saida", "Transferencia"].map((t) => (
          <div key={t} className={`filter-chip${tipoFilter === t ? " active" : ""}`} onClick={() => setTipoFilter(t)}>{t}</div>
        ))}
        <span style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
        {["Todos", "Conciliados", "Pendentes"].map((t) => {
          const val = t === "Conciliados" ? "Sim" : t === "Pendentes" ? "Nao" : "Todos";
          return (
            <div key={t} className={`filter-chip${consiliadoFilter === val ? " active" : ""}`} onClick={() => setConsiliadoFilter(val)}>{t}</div>
          );
        })}
      </div>

      {contaFilter && saldoAnterior !== null && (
        <div className="alert alert-info" style={{ marginBottom: 10 }}>
          Saldo anterior ao início do período:{" "}
          <strong style={{ fontFamily: "var(--font-mono)" }}>{fmtBRL(saldoAnterior)}</strong>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cód.</th>
                <th>Lote</th>
                <th>Data</th>
                <th>Cód. Saída</th>
                <th>Conta Saída</th>
                <th>Cód. Entrada</th>
                <th>Conta Entrada</th>
                <th>Valor</th>
                {(showSaldoCol || contaFilter) && <th>Saldo</th>}
                <th>Histórico</th>
                <th>Domínio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={(showSaldoCol || contaFilter) ? 12 : 11}><div className="empty-state"><div className="empty-icon">?</div><div className="empty-text">Nenhum lançamento</div></div></td></tr>
              )}
              {rows.map((l) => {
                const cEnt = l.contaEntradaId ? contas.find((c) => c.id === l.contaEntradaId) : contaPorCodigo(contas, l.codigoDestino);
                const cSai = l.contaSaidaId ? contas.find((c) => c.id === l.contaSaidaId) : contaPorCodigo(contas, l.codigoOrigem);
                const plano = planoContas.find((p) => p.id === l.planoId);
                const cli = clientes.find((c) => c.id === l.clienteId);
                return (
                  <tr key={l.id}>
                    <td className="td-mono">{l.codigo ?? "?"}</td>
                    <td className="td-mono" style={{ fontSize: 12, color: "var(--text3)" }}>{l.lote}</td>
                    <td className="td-mono">
                      {fmtDate(l.data)}
                      {l.createdAt && (
                        <span style={{ display: "block", fontSize: 10, color: "var(--text3)", marginTop: 1 }}>
                          {new Date(l.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          {l.source === "whatsapp" && " 📱"}
                        </span>
                      )}
                    </td>
                    <td className="td-mono">{l.codigoOrigem ?? cSai?.codigo ?? "?"}</td>
                    <td>{cSai?.nome || (l.tipo === "Saida" || l.tipo === "Transferencia" ? "?" : "")}</td>
                    <td className="td-mono">{l.codigoDestino ?? cEnt?.codigo ?? "?"}</td>
                    <td>{cEnt?.nome || (l.tipo === "Entrada" || l.tipo === "Transferencia" ? "?" : "")}</td>
                    <td className={l.tipo === "Entrada" ? "td-green" : "td-red"}>{fmtBRL(l.valor)}</td>
                    {(showSaldoCol || contaFilter) && <td className="td-mono">{l.saldoConta != null ? fmtBRL(l.saldoConta) : "?"}</td>}
                    <td style={{ fontSize: 12, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {l.historico}{plano ? ` ? ${plano.descricao}` : ""}{cli ? ` ? ${cli.nome}` : ""}
                    </td>
                    <td>{l.exportado ? <span className="badge badge-blue">Sim</span> : <span className="badge badge-amber">Não</span>}</td>
                    <td className="table-actions-cell">
                      <div className="table-actions-inline">
                        <button type="button" className="btn btn-secondary btn-sm btn-icon" title="Editar lançamento" onClick={() => openModal("lancamento", l)}>
                          <PenLine size={14} strokeWidth={2} aria-hidden />
                        </button>
                        <button type="button" className="btn btn-danger btn-sm btn-icon" title="Excluir lançamento" onClick={() => { if (confirm("Excluir?")) lancCrud.remove(l.id); }}>
                          <Trash2 size={14} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text2)" }}>
          {rows.length} registros
        </div>
      </div>
    </div>
  );
}

function DRETable({ dre, planoContas, label }) {
  const receitas = planoContas.filter((p) => p.tipo === "Receita");
  const custos = planoContas.filter((p) => p.tipo === "Custo");
  const despesas = planoContas.filter((p) => p.tipo === "Despesa");
  const impostos = planoContas.filter((p) => p.tipo === "Imposto");

  const Row = ({ pc }) => {
    const v = dre.resultado?.[pc.id];
    const val = pc.tipo === "Receita" ? v?.entradas : v?.saidas;
    if (!val) return null;
    return (
      <tr>
        <td style={{ paddingLeft: 32, color: "var(--text2)", fontSize: 12 }}>{pc.codigo}</td>
        <td>{pc.descricao}</td>
        <td className={pc.tipo === "Receita" ? "td-green td-mono" : "td-red td-mono"}>{fmtBRL(val)}</td>
        <td></td>
      </tr>
    );
  };

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>{label}</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Código</th><th>Conta</th><th>Valor</th><th></th></tr></thead>
          <tbody>
            <tr><td colSpan={4} style={{ padding: "10px 16px", fontWeight: 600, color: "var(--accent)", fontSize: 12 }}>RECEITAS</td></tr>
            {receitas.map((pc) => <Row key={pc.id} pc={pc} />)}
            <tr className="dre-total"><td colSpan={2}>Total Receitas</td><td className="td-green td-mono">{fmtBRL(dre.receitas)}</td><td></td></tr>

            <tr><td colSpan={4} style={{ padding: "10px 16px", fontWeight: 600, color: "var(--danger)", fontSize: 12 }}>(-) CUSTOS</td></tr>
            {custos.map((pc) => <Row key={pc.id} pc={pc} />)}
            <tr className="dre-total"><td colSpan={2}>Total Custos</td><td className="td-red td-mono">{fmtBRL(dre.custos)}</td><td></td></tr>

            <tr><td colSpan={2} style={{ fontWeight: 700 }}>= LUCRO BRUTO</td><td className="td-mono" style={{ fontWeight: 700, color: dre.lucroBruto >= 0 ? "var(--accent)" : "var(--danger)" }}>{fmtBRL(dre.lucroBruto)}</td><td>{fmtPct(dre.receitas > 0 ? dre.lucroBruto / dre.receitas : 0)}</td></tr>

            <tr><td colSpan={4} style={{ padding: "10px 16px", fontWeight: 600, color: "var(--accent2)", fontSize: 12 }}>(-) DESPESAS</td></tr>
            {despesas.map((pc) => <Row key={pc.id} pc={pc} />)}
            <tr className="dre-total"><td colSpan={2}>Total Despesas</td><td className="td-amber td-mono">{fmtBRL(dre.despesas)}</td><td></td></tr>

            <tr><td colSpan={2} style={{ fontWeight: 700 }}>= LAIR (Antes dos Impostos)</td><td className="td-mono" style={{ fontWeight: 700, color: dre.lucroLiquido >= 0 ? "var(--accent)" : "var(--danger)" }}>{fmtBRL(dre.lucroLiquido)}</td><td>{fmtPct(dre.lucroPct)}</td></tr>

            {impostos.length > 0 && (
              <>
                <tr><td colSpan={4} style={{ padding: "10px 16px", fontWeight: 600, color: "#7c3aed", fontSize: 12 }}>(-) IMPOSTOS</td></tr>
                {impostos.map((pc) => <Row key={pc.id} pc={pc} />)}
                <tr className="dre-total"><td colSpan={2}>Total Impostos</td><td className="td-mono" style={{ color: "#7c3aed" }}>{fmtBRL(dre.impostos)}</td><td></td></tr>
              </>
            )}

            <tr><td colSpan={2} style={{ fontWeight: 700 }}>= LUCRO LÍQUIDO</td><td className="td-mono" style={{ fontWeight: 700, fontSize: 16, color: (dre.lucroAposImpostos ?? dre.lucroLiquido) >= 0 ? "var(--accent)" : "var(--danger)" }}>{fmtBRL(dre.lucroAposImpostos ?? dre.lucroLiquido)}</td><td>{fmtPct(dre.lucroAposImpPct ?? dre.lucroPct)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DREPage() {
  const { dreAtual, consultaDRE, planoContas, filterPeriodo, getDRE, getDREByRange, getConsultaDREByRange, contas } = useGestor();
  const [tab, setTab] = useState("periodo");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [comp1Ano, setComp1Ano] = useState(filterPeriodo.ano);
  const [comp1Mes, setComp1Mes] = useState("");
  const [comp2Ano, setComp2Ano] = useState(filterPeriodo.ano);
  const [comp2Mes, setComp2Mes] = useState("");

  const dreRange = useMemo(() => {
    if (!rangeFrom || !rangeTo) return null;
    return getDREByRange(rangeFrom, rangeTo);
  }, [rangeFrom, rangeTo, getDREByRange]);

  const consultaRange = useMemo(() => {
    if (!rangeFrom || !rangeTo) return [];
    return getConsultaDREByRange(rangeFrom, rangeTo);
  }, [rangeFrom, rangeTo, getConsultaDREByRange]);

  const dre1 = useMemo(() => getDRE(comp1Ano, comp1Mes), [comp1Ano, comp1Mes, getDRE]);
  const dre2 = useMemo(() => getDRE(comp2Ano, comp2Mes), [comp2Ano, comp2Mes, getDRE]);

  const dreData = MESES.map((m, i) => {
    const mes = (i + 1).toString().padStart(2, "0");
    const d = getDRE(filterPeriodo.ano, mes);
    return { name: m, Receita: d.receitas, "Lucro Bruto": d.lucroBruto, "Lucro Líquido": d.lucroAposImpostos ?? d.lucroLiquido };
  });

  const ANOS = ["2022", "2023", "2024", "2025", "2026"];

  const tabs = [
    { id: "periodo", label: "Por Período" },
    { id: "livre", label: "Intervalo Livre" },
    { id: "comp", label: "Comparativo" },
  ];

  return (
    <div>
      <div className="filter-bar" style={{ marginBottom: 14 }}>
        {tabs.map((t) => (
          <div key={t.id} className={`filter-chip${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</div>
        ))}
      </div>

      {tab === "periodo" && (
        <>
          <div className="toolbar"><PeriodToolbar /></div>
          <div className="charts-grid">
            <DRETable dre={dreAtual} planoContas={planoContas} label={`D.R.E. ? ${filterPeriodo.mes ? MESES[parseInt(filterPeriodo.mes, 10) - 1] : "Acumulado"} ${filterPeriodo.ano}`} />
            <div className="card">
              <div className="card-title">Evolução Anual {filterPeriodo.ano}</div>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={dreData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                  <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: CHART.tick, fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Receita" fill={`${CHART.receita}40`} stroke={CHART.receita} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="Lucro Bruto" stroke={CHART.lucroBruto} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Lucro Líquido" stroke={CHART.lucro} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden", marginTop: 14 }}>
            <div className="card-title" style={{ padding: "16px 20px 0" }}>Consulta D.R.E. (estilo Excel)</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th><th>Classificação</th><th>Conta Financeira</th>
                    <th>Saldo Anterior</th><th>Entradas</th><th>Saídas</th><th>Saldo Atual</th>
                  </tr>
                </thead>
                <tbody>
                  {consultaDRE.filter((r) => r.entradas || r.saidas || r.saldoAnterior).map((r) => (
                    <tr key={r.id}>
                      <td className="td-mono">{r.codigo}</td>
                      <td>{r.classificacao}</td>
                      <td style={{ fontSize: 12 }}>{r.contaFinanceira}</td>
                      <td className="td-mono">{fmtBRL(r.saldoAnterior)}</td>
                      <td className="td-green td-mono">{fmtBRL(r.entradas)}</td>
                      <td className="td-red td-mono">{fmtBRL(r.saidas)}</td>
                      <td className="td-mono">{fmtBRL(r.saldoAtual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "livre" && (
        <>
          <div className="card">
            <div className="card-title">Intervalo de Datas</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Data Inicial</label>
                <input className="form-input" type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Data Final</label>
                <input className="form-input" type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
              </div>
            </div>
          </div>
          {dreRange ? (
            <>
              <DRETable dre={dreRange} planoContas={planoContas} label={`D.R.E. ? ${fmtDate(rangeFrom)} a ${fmtDate(rangeTo)}`} />
              <div className="card" style={{ padding: 0, overflow: "hidden", marginTop: 14 }}>
                <div className="card-title" style={{ padding: "16px 20px 0" }}>Consulta D.R.E. no intervalo</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Código</th><th>Classificação</th><th>Conta Financeira</th>
                        <th>Saldo Anterior</th><th>Entradas</th><th>Saídas</th><th>Saldo Atual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consultaRange.filter((r) => r.entradas || r.saidas || r.saldoAnterior).map((r) => (
                        <tr key={r.id}>
                          <td className="td-mono">{r.codigo}</td>
                          <td>{r.classificacao}</td>
                          <td style={{ fontSize: 12 }}>{r.contaFinanceira}</td>
                          <td className="td-mono">{fmtBRL(r.saldoAnterior)}</td>
                          <td className="td-green td-mono">{fmtBRL(r.entradas)}</td>
                          <td className="td-red td-mono">{fmtBRL(r.saidas)}</td>
                          <td className="td-mono">{fmtBRL(r.saldoAtual)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="card" style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>
              Selecione as datas inicial e final para gerar o D.R.E.
            </div>
          )}
        </>
      )}

      {tab === "comp" && (
        <>
          <div className="card">
            <div className="card-title">Selecione os dois períodos para comparar</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Período 1 ? Ano</label>
                <select className="form-select" value={comp1Ano} onChange={(e) => setComp1Ano(e.target.value)}>
                  {ANOS.map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Período 1 ? Mês</label>
                <select className="form-select" value={comp1Mes} onChange={(e) => setComp1Mes(e.target.value)}>
                  <option value="">Acumulado</option>
                  {MESES.map((m, i) => <option key={m} value={(i + 1).toString().padStart(2, "0")}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Período 2 ? Ano</label>
                <select className="form-select" value={comp2Ano} onChange={(e) => setComp2Ano(e.target.value)}>
                  {ANOS.map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Período 2 ? Mês</label>
                <select className="form-select" value={comp2Mes} onChange={(e) => setComp2Mes(e.target.value)}>
                  <option value="">Acumulado</option>
                  {MESES.map((m, i) => <option key={m} value={(i + 1).toString().padStart(2, "0")}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="card-title" style={{ padding: "16px 20px 0" }}>
              Comparativo: {comp1Mes ? MESES[parseInt(comp1Mes, 10) - 1] : "Acumulado"}/{comp1Ano} vs {comp2Mes ? MESES[parseInt(comp2Mes, 10) - 1] : "Acumulado"}/{comp2Ano}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Indicador</th>
                    <th>{comp1Mes ? MESES[parseInt(comp1Mes, 10) - 1] : "Acum."}/{comp1Ano}</th>
                    <th>{comp2Mes ? MESES[parseInt(comp2Mes, 10) - 1] : "Acum."}/{comp2Ano}</th>
                    <th>Variação</th>
                    <th>Var. %</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Receitas", dre1.receitas, dre2.receitas],
                    ["Custos", dre1.custos, dre2.custos],
                    ["Lucro Bruto", dre1.lucroBruto, dre2.lucroBruto],
                    ["Despesas", dre1.despesas, dre2.despesas],
                    ["LAIR", dre1.lucroLiquido, dre2.lucroLiquido],
                    ["Impostos", dre1.impostos, dre2.impostos],
                    ["Lucro Líquido", dre1.lucroAposImpostos ?? dre1.lucroLiquido, dre2.lucroAposImpostos ?? dre2.lucroLiquido],
                  ].map(([label, v1, v2]) => {
                    const delta = v2 - v1;
                    const pct = v1 !== 0 ? delta / Math.abs(v1) : 0;
                    return (
                      <tr key={label}>
                        <td style={{ fontWeight: label.startsWith("Lucro") ? 700 : 400 }}>{label}</td>
                        <td className="td-mono">{fmtBRL(v1)}</td>
                        <td className="td-mono">{fmtBRL(v2)}</td>
                        <td className={`td-mono ${delta >= 0 ? "td-green" : "td-red"}`}>{delta >= 0 ? "+" : ""}{fmtBRL(delta)}</td>
                        <td className={`td-mono ${pct >= 0 ? "td-green" : "td-red"}`}>{pct >= 0 ? "+" : ""}{fmtPct(pct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ContasPage() {
  const { contas, getSaldoConta, getSaldoTotal, openModal, contaCrud } = useGestor();
  const [sortBy, setSortBy] = useState("codigo");

  const sorted = useMemo(() => {
    return [...contas].sort((a, b) => {
      if (sortBy === "nome") return (a.nome || "").localeCompare(b.nome || "");
      if (sortBy === "saldo") return getSaldoConta(b.id) - getSaldoConta(a.id);
      if (sortBy === "tipo") return (a.tipo || "").localeCompare(b.tipo || "");
      return (a.codigo ?? 0) - (b.codigo ?? 0);
    });
  }, [contas, sortBy, getSaldoConta]);

  return (
    <div>
      <div className="toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text2)" }}>Ordenar por:</span>
          {["codigo", "nome", "tipo", "saldo"].map((s) => (
            <div key={s} className={`filter-chip${sortBy === s ? " active" : ""}`} onClick={() => setSortBy(s)} style={{ textTransform: "capitalize" }}>{s}</div>
          ))}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => openModal("conta")}>+ Nova Conta</button>
      </div>
      <div className="kpi-grid">
        <div className="kpi-card" style={{ "--kpi-color": "var(--accent3)" }}>
          <div className="kpi-label">Saldo Total</div>
          <div className="kpi-value">{fmtBRL(getSaldoTotal())}</div>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Cód.</th><th>Nome</th><th>Apelido</th><th>Tipo</th><th>Contábil</th><th>Inicial</th><th>Atual</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} style={c.inativo ? { opacity: 0.55 } : {}}>
                  <td className="td-mono">{c.codigo}</td>
                  <td>{c.nome}</td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{c.apelido || "?"}</td>
                  <td><span className={`badge ${c.tipo === "Banco" ? "badge-blue" : "badge-amber"}`}>{c.tipo}</span></td>
                  <td className="td-mono" style={{ fontSize: 12 }}>{c.contaContabil || "?"}</td>
                  <td className="td-mono">{fmtBRL(c.saldoInicial)}</td>
                  <td className="td-green">{fmtBRL(getSaldoConta(c.id))}</td>
                  <td>{c.inativo ? <span className="badge badge-red">Inativo</span> : <span className="badge badge-green">Ativo</span>}</td>
                  <td className="table-actions-cell">
                    <div className="table-actions-inline">
                      <button type="button" className="btn btn-secondary btn-sm btn-icon" title="Editar conta" onClick={() => openModal("conta", c)}>
                        <PenLine size={14} strokeWidth={2} aria-hidden />
                      </button>
                      <button type="button" className="btn btn-danger btn-sm btn-icon" title="Excluir conta" onClick={() => { if (confirm("Excluir?")) contaCrud.remove(c.id); }}>
                        <Trash2 size={14} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function PlanoContasPage() {
  const { planoContas, openModal, planoCrud } = useGestor();
  const badgeColor = (tipo) => tipo === "Receita" ? "badge-green" : tipo === "Custo" ? "badge-red" : tipo === "Imposto" ? "badge-blue" : "badge-amber";

  const importarSugestoes = () => {
    const existentes = new Set(planoContas.map((p) => p.descricao.toLowerCase().trim()));
    const novas = DEFAULT_CATS_PJ.filter((c) => !existentes.has(c.descricao.toLowerCase().trim()));
    if (!novas.length) return alert("Todas as categorias sugeridas j? existem.");
    if (!window.confirm(`Adicionar ${novas.length} categoria(s) sugerida(s)?`)) return;
    novas.forEach((c) => planoCrud.add({ ...c, id: generateId(), codigo: "", caixaBanco: "", contaContabil: "" }));
  };

  return (
    <div>
      <div className="toolbar">
        <button type="button" className="btn btn-secondary btn-sm" onClick={importarSugestoes} title="Adiciona categorias padrão sugeridas">
          ??? Sugestões
        </button>
        <button type="button" className="btn btn-primary" onClick={() => openModal("plano")}>+ Nova Conta</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th style={{ width: 36 }}>?cone</th><th>Código</th><th>Descrição</th><th>Tipo</th><th>Natureza</th><th></th></tr></thead>
            <tbody>
              {planoContas.map((pc) => (
                <tr key={pc.id}>
                  <td style={{ textAlign: "center" }}>
                    {pc.icone ? (
                      <span className="cat-icone" style={{ background: pc.cor || "var(--muted)", fontSize: 14 }}>
                        {pc.icone}
                      </span>
                    ) : (
                      <span className="cat-icone cat-icone-empty">???</span>
                    )}
                  </td>
                  <td className="td-mono">{pc.codigo}</td>
                  <td>{pc.descricao}</td>
                  <td><span className={`badge ${badgeColor(pc.tipo)}`}>{pc.tipo}</span></td>
                  <td className="td-mono" style={{ fontSize: 12 }}>{pc.natureza || "?"}</td>
                  <td className="table-actions-cell">
                    <div className="table-actions-inline">
                      <button type="button" className="btn btn-secondary btn-sm btn-icon" title="Editar categoria" onClick={() => openModal("plano", pc)}>
                        <PenLine size={14} strokeWidth={2} aria-hidden />
                      </button>
                      <button type="button" className="btn btn-danger btn-sm btn-icon" title="Excluir categoria" onClick={() => { if (confirm("Excluir?")) planoCrud.remove(pc.id); }}>
                        <Trash2 size={14} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ImpostosPage() {
  const { planoContas, dreAtual, openModal, planoCrud } = useGestor();
  const impostos = planoContas.filter((p) => p.tipo === "Imposto");

  return (
    <div>
      <div className="toolbar">
        <div style={{ fontSize: 13, color: "var(--text2)" }}>
          Registre aqui os impostos que incidem sobre o resultado (Simples, IRPJ, CSLL, ISS, etc.)
        </div>
        <button type="button" className="btn btn-primary" onClick={() => openModal("plano", { tipo: "Imposto" })}>+ Novo Imposto</button>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card" style={{ "--kpi-color": "#7c3aed" }}>
          <div className="kpi-label">Total Impostos (período)</div>
          <div className="kpi-value">{fmtBRL(dreAtual.impostos)}</div>
          <div className="kpi-sub">{dreAtual.receitas > 0 ? fmtPct(dreAtual.impostos / dreAtual.receitas) : "?"} das receitas</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": "var(--accent)" }}>
          <div className="kpi-label">LAIR (Antes dos Impostos)</div>
          <div className="kpi-value">{fmtBRL(dreAtual.lucroLiquido)}</div>
          <div className="kpi-sub">{fmtPct(dreAtual.lucroPct)} de margem</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": dreAtual.lucroAposImpostos >= 0 ? "var(--accent)" : "var(--danger)" }}>
          <div className="kpi-label">Lucro Líquido (após impostos)</div>
          <div className="kpi-value">{fmtBRL(dreAtual.lucroAposImpostos)}</div>
          <div className="kpi-sub">{fmtPct(dreAtual.lucroAposImpPct)} de margem</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Código</th><th>Descrição</th><th>Classificação</th><th>Conta Contábil</th><th>Valor (período)</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {impostos.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state"><div className="empty-text">Nenhum imposto cadastrado. Clique em "+ Novo Imposto" para adicionar.</div></div></td></tr>
              )}
              {impostos.map((pc) => {
                const valor = dreAtual.resultado?.[pc.id]?.saidas || 0;
                return (
                  <tr key={pc.id}>
                    <td className="td-mono">{pc.codigo}</td>
                    <td>{pc.descricao}</td>
                    <td style={{ fontSize: 12, color: "var(--text2)" }}>{pc.classificacao}</td>
                    <td className="td-mono" style={{ fontSize: 12 }}>{pc.contaContabil || "?"}</td>
                    <td className="td-mono" style={{ color: "#7c3aed" }}>{fmtBRL(valor)}</td>
                    <td>{pc.inativo ? <span className="badge badge-red">Inativo</span> : <span className="badge badge-green">Ativo</span>}</td>
                    <td className="table-actions-cell">
                      <div className="table-actions-inline">
                        <button type="button" className="btn btn-secondary btn-sm btn-icon" title="Editar imposto" onClick={() => openModal("plano", pc)}>
                          <PenLine size={14} strokeWidth={2} aria-hidden />
                        </button>
                        <button type="button" className="btn btn-danger btn-sm btn-icon" title="Excluir imposto" onClick={() => { if (confirm("Excluir?")) planoCrud.remove(pc.id); }}>
                          <Trash2 size={14} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">Como funciona</div>
        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
          Lançamentos vinculados a uma conta do plano do tipo <strong>Imposto</strong> são contabilizados separadamente no D.R.E.,
          após as despesas operacionais. Isso gera o <strong>LAIR</strong> (Lucro Antes do Imposto de Renda) e o
          <strong> Lucro Líquido</strong> real (após impostos). Para registrar o pagamento, crie um lançamento de Saída
          vinculado ? conta de imposto correspondente.
        </p>
      </div>
    </div>
  );
}

function CadastroTable({ items, onAdd, onEdit, onDelete, label }) {
  return (
    <div>
      <div className="toolbar">
        <div />
        <button type="button" className="btn btn-primary" onClick={onAdd}>+ Novo {label}</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cód.</th><th>Nome</th><th>Apelido</th><th>Documento</th>
                <th>Cidade</th><th>Telefone</th><th>E-mail</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state"><div className="empty-text">Nenhum cadastro</div></div></td></tr>
              )}
              {items.map((x) => (
                <tr key={x.id}>
                  <td className="td-mono">{x.codigo ?? "?"}</td>
                  <td>{x.nome}</td>
                  <td>{x.apelido || "?"}</td>
                  <td className="td-mono" style={{ fontSize: 12 }}>{x.documento || "?"}</td>
                  <td>{x.cidade || "?"}</td>
                  <td>{x.telefone || "?"}</td>
                  <td>{x.email || "?"}</td>
                  <td className="table-actions-cell">
                    <div className="table-actions-inline">
                      <button type="button" className="btn btn-secondary btn-sm btn-icon" title="Editar centro de custo" onClick={() => onEdit(x)}>
                        <PenLine size={14} strokeWidth={2} aria-hidden />
                      </button>
                      <button type="button" className="btn btn-danger btn-sm btn-icon" title="Excluir centro de custo" onClick={() => { if (confirm("Excluir?")) onDelete(x.id); }}>
                        <Trash2 size={14} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ClientesPage() {
  const { clientes, openModal, clienteCrud } = useGestor();
  return (
    <CadastroTable
      items={clientes}
      label="Cliente"
      onAdd={() => openModal("cliente")}
      onEdit={(x) => openModal("cliente", x)}
      onDelete={clienteCrud.remove}
    />
  );
}

export function FornecedoresPage() {
  const { fornecedores, openModal, fornecedorCrud } = useGestor();
  return (
    <CadastroTable
      items={fornecedores}
      label="Fornecedor"
      onAdd={() => openModal("fornecedor")}
      onEdit={(x) => openModal("fornecedor", x)}
      onDelete={fornecedorCrud.remove}
    />
  );
}

export function ImportacoesPage() {
  const { contas, planoContas, lancamentos, empresa, company, setLancamentos, patchEmpresa } = useGestor();
  const [contaId, setContaId] = useState(contas[0]?.id || "");
  const [planoId, setPlanoId] = useState(planoContas[0]?.id || "");
  const [msg, setMsg] = useState("");
  const [dominioFrom, setDominioFrom] = useState("");
  const [dominioTo, setDominioTo] = useState("");
  const ofxRef = useRef();
  const mpRef = useRef();
  const xlsxRef = useRef();
  const jsonRef = useRef();

  const addLancs = (novos) => {
    const lote = nextLote(lancamentos);
    const withLote = novos.map((l) => ({ ...l, lote: l.lote || lote }));
    setLancamentos((p) => [...p, ...withLote]);
    setMsg(`${withLote.length} lançamento(s) importado(s).`);
  };

  const handleOFX = async (file) => {
    const text = await file.text();
    const txs = parseOFX(text);
    addLancs(mergeOFXToLancamentos(txs, lancamentos, contaId, planoId, nextLote(lancamentos)));
  };

  const handleMP = async (file) => {
    const text = await file.text();
    const txs = parseMercadoPagoCSV(text);
    addLancs(mergeOFXToLancamentos(txs, lancamentos, contaId, planoId, nextLote(lancamentos)));
  };

  const handleXlsx = async (file) => {
    const rows = await parseXlsxFile(file);
    addLancs(rowsToLancamentos(rows, nextLote(lancamentos), contaId, planoId));
  };

  const handleDominio = () => {
    const filtered = dominioFrom || dominioTo
      ? lancamentos.filter((l) => {
          if (l.exportado) return false;
          if (dominioFrom && l.data < dominioFrom) return false;
          if (dominioTo && l.data > dominioTo) return false;
          return true;
        })
      : lancamentos.filter((l) => !l.exportado);

    const lines = [
      `# EXPORTACAO DOMINIO - ${company.nomeFantasia}`,
      `# CNPJ: ${company.cnpj}`,
      `# Codigo Empresa: ${company.codigoDominio}`,
      `# Periodo: ${dominioFrom || "inicio"} a ${dominioTo || "fim"}`,
      `# Gerado: ${new Date().toISOString()}`,
      "DATA|LOTE|TIPO|CONTA|PLANO|VALOR|HISTORICO|EXPORTADO",
    ];
    for (const l of filtered) {
      const conta = contas.find((c) => c.id === (l.contaEntradaId || l.contaSaidaId));
      const plano = planoContas.find((p) => p.id === l.planoId);
      lines.push([
        l.data, l.lote, l.tipo,
        conta?.contaContabil || conta?.codigo || "",
        plano?.codigo || "",
        l.valor.toFixed(2),
        (l.historico || "").replace(/\|/g, "/"),
        "N",
      ].join("|"));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dominio_${company.nomeFantasia}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    const ids = filtered.map((l) => l.id);
    setLancamentos(marcarExportadosDominio(lancamentos, ids));
    setMsg(`${filtered.length} lançamento(s) exportados para Domínio.`);
  };

  const handleImportJSON = async (file) => {
    const data = await importJSONFile(file);
    patchEmpresa(data);
    setMsg("JSON importado com sucesso.");
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">Conta e plano padrão para importações</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Conta</label>
            <select className="form-select" value={contaId} onChange={(e) => setContaId(e.target.value)}>
              {contas.map((c) => <option key={c.id} value={c.id}>{c.apelido || c.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Plano</label>
            <select className="form-select" value={planoId} onChange={(e) => setPlanoId(e.target.value)}>
              {planoContas.map((p) => <option key={p.id} value={p.id}>{p.descricao}</option>)}
            </select>
          </div>
        </div>
      </div>
      {msg && <div className="alert alert-success">{msg}</div>}
      <div className="import-grid">
        <div className="card">
          <div className="card-title">OFX (extrato bancário)</div>
          <input ref={ofxRef} type="file" accept=".ofx,.OFX" hidden onChange={(e) => e.target.files[0] && handleOFX(e.target.files[0])} />
          <button type="button" className="btn btn-secondary" onClick={() => ofxRef.current?.click()}>Selecionar OFX</button>
        </div>
        <div className="card">
          <div className="card-title">Mercado Pago CSV</div>
          <input ref={mpRef} type="file" accept=".csv" hidden onChange={(e) => e.target.files[0] && handleMP(e.target.files[0])} />
          <button type="button" className="btn btn-secondary" onClick={() => mpRef.current?.click()}>Selecionar CSV</button>
        </div>
        <div className="card">
          <div className="card-title">Planilha XLSX</div>
          <input ref={xlsxRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => e.target.files[0] && handleXlsx(e.target.files[0])} />
          <button type="button" className="btn btn-secondary" onClick={() => xlsxRef.current?.click()}>Selecionar XLSX</button>
        </div>
        <div className="card">
          <div className="card-title">Exportação Domínio</div>
          <div className="form-grid" style={{ marginBottom: 10 }}>
            <div className="form-group">
              <label className="form-label">Data Inicial (opcional)</label>
              <input className="form-input" type="date" value={dominioFrom} onChange={(e) => setDominioFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Data Final (opcional)</label>
              <input className="form-input" type="date" value={dominioTo} onChange={(e) => setDominioTo(e.target.value)} />
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={handleDominio}>Exportar pendentes</button>
          <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>Sem datas: exporta todos os pendentes</p>
        </div>
        <div className="card">
          <div className="card-title">Backup JSON</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary" onClick={() => exportJSON(empresa, company)}>Exportar JSON</button>
            <input ref={jsonRef} type="file" accept=".json" hidden onChange={(e) => e.target.files[0] && handleImportJSON(e.target.files[0])} />
            <button type="button" className="btn btn-secondary" onClick={() => jsonRef.current?.click()}>Importar JSON</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConciliacaoPage() {
  const { lancamentos, contas, planoContas, markConsiliado } = useGestor();
  const pendentes = lancamentos.filter((l) => !l.consiliado).sort((a, b) => new Date(b.data) - new Date(a.data));

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="kpi-value" style={{ fontSize: 28 }}>{pendentes.length}</div>
        <div className="kpi-label">lançamentos pendentes de conciliação</div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Lote</th><th>Conta</th><th>Valor</th><th>Histórico</th><th></th></tr></thead>
            <tbody>
              {pendentes.length === 0 && <tr><td colSpan={6}><div className="empty-state"><div className="empty-text">Tudo conciliado</div></div></td></tr>}
              {pendentes.map((l) => {
                const conta = contas.find((c) => c.id === (l.contaEntradaId || l.contaSaidaId));
                const plano = planoContas.find((p) => p.id === l.planoId);
                return (
                  <tr key={l.id}>
                    <td className="td-mono">{fmtDate(l.data)}</td>
                    <td className="td-mono">{l.lote}</td>
                    <td>{conta?.nome} ? {plano?.descricao?.slice(0, 20)}</td>
                    <td className={l.tipo === "Entrada" ? "td-green" : "td-red"}>{fmtBRL(l.valor)}</td>
                    <td style={{ fontSize: 12 }}>{l.historico}</td>
                    <td>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => markConsiliado(l.id)}>Marcar conciliado</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function BalancetePage() {
  const { balancete } = useGestor();
  const totDeb = balancete.reduce((s, l) => s + l.debito, 0);
  const totCred = balancete.reduce((s, l) => s + l.credito, 0);

  return (
    <div>
      <div className="toolbar"><PeriodToolbar /></div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Descrição</th><th>Tipo</th><th>Débito</th><th>Crédito</th><th>Saldo</th></tr></thead>
            <tbody>
              {balancete.map((l, i) => (
                <tr key={i} style={l.isConta ? { background: "var(--surface2)" } : {}}>
                  <td className="td-mono">{l.codigo}</td>
                  <td>{l.descricao}</td>
                  <td><span className="badge badge-blue">{l.tipo}</span></td>
                  <td className="td-mono">{l.debito ? fmtBRL(l.debito) : "?"}</td>
                  <td className="td-mono">{l.credito ? fmtBRL(l.credito) : "?"}</td>
                  <td className="td-mono" style={{ color: l.saldo >= 0 ? "var(--accent)" : "var(--danger)" }}>{fmtBRL(l.saldo)}</td>
                </tr>
              ))}
              <tr className="dre-total">
                <td colSpan={3}>Totais</td>
                <td className="td-mono">{fmtBRL(totDeb)}</td>
                <td className="td-mono">{fmtBRL(totCred)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function FechamentoPage() {
  const { fechamentos, fechamentoCrud, lancamentos, planoContas, contas, getSaldoConta, getDRE, filterPeriodo } = useGestor();
  const [formAno, setFormAno] = useState(filterPeriodo.ano || new Date().getFullYear().toString());
  const [formMes, setFormMes] = useState((new Date().getMonth() + 1).toString().padStart(2, "0"));
  const [obs, setObs] = useState("");

  const preview = useMemo(() => {
    const dre = getDRE(formAno, formMes);
    const saldosContas = Object.fromEntries(contas.map((c) => [c.id, getSaldoConta(c.id)]));
    const count = lancamentos.filter((l) => l.data?.startsWith(`${formAno}-${formMes}`)).length;
    return { dre, saldosContas, count };
  }, [formAno, formMes, getDRE, contas, getSaldoConta, lancamentos]);

  const jaFechado = fechamentos.some((f) => f.periodo === `${formAno}-${formMes}`);

  const handleFechar = () => {
    if (jaFechado) return alert("Este período j? foi fechado.");
    if (preview.count === 0) return alert("Não h? lançamentos neste período para fechar.");
    if (!confirm(`Confirmar fechamento de ${MESES[parseInt(formMes, 10) - 1]}/${formAno}?\n\nEsta ação registra um snapshot do período.`)) return;
    const lastDay = new Date(parseInt(formAno), parseInt(formMes), 0).getDate();
    fechamentoCrud.add({
      id: generateId(),
      periodo: `${formAno}-${formMes}`,
      dataFechamento: `${formAno}-${formMes}-${String(lastDay).padStart(2, "0")}`,
      observacao: obs,
      saldosContas: preview.saldosContas,
      dreSnapshot: {
        receitas: preview.dre.receitas,
        custos: preview.dre.custos,
        despesas: preview.dre.despesas,
        impostos: preview.dre.impostos,
        lucroBruto: preview.dre.lucroBruto,
        lucroLiquido: preview.dre.lucroLiquido,
        lucroAposImpostos: preview.dre.lucroAposImpostos,
      },
      lancamentosCount: preview.count,
    });
    setObs("");
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">Fechar Período</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Ano</label>
            <select className="form-select" value={formAno} onChange={(e) => setFormAno(e.target.value)}>
              {["2022", "2023", "2024", "2025", "2026", "2027"].map((y) => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Mês</label>
            <select className="form-select" value={formMes} onChange={(e) => setFormMes(e.target.value)}>
              {MESES.map((m, i) => <option key={m} value={(i + 1).toString().padStart(2, "0")}>{m}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Observação</label>
            <input className="form-input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex: Fechamento referência Jan/2024" />
          </div>
        </div>

        <div style={{ marginTop: 16, padding: "14px 16px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 10 }}>
            Preview ? {MESES[parseInt(formMes, 10) - 1]}/{formAno}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
            {[
              ["Lançamentos", preview.count, false],
              ["Receitas", fmtBRL(preview.dre.receitas), false],
              ["Custos", fmtBRL(preview.dre.custos), false],
              ["Despesas", fmtBRL(preview.dre.despesas), false],
              ["Impostos", fmtBRL(preview.dre.impostos), false],
              ["Lucro Líquido", fmtBRL(preview.dre.lucroAposImpostos ?? preview.dre.lucroLiquido), true],
            ].map(([k, v, bold]) => (
              <div key={k} style={{ fontSize: 12 }}>
                <div style={{ color: "var(--text3)", marginBottom: 2 }}>{k}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontWeight: bold ? 700 : 400 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {jaFechado && <div className="alert alert-warn" style={{ marginTop: 12 }}>Este período j? possui fechamento registrado.</div>}

        <div style={{ marginTop: 14 }}>
          <button type="button" className="btn btn-primary" onClick={handleFechar} disabled={jaFechado}>
            {jaFechado ? "Período j? fechado" : `Fechar ${MESES[parseInt(formMes, 10) - 1]}/${formAno}`}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-title" style={{ padding: "16px 20px 0" }}>Histórico de Fechamentos</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Período</th><th>Data Fechamento</th><th>Lançamentos</th>
                <th>Receitas</th><th>Custos</th><th>Despesas</th><th>Impostos</th><th>Lucro Líquido</th>
                <th>Observação</th><th></th>
              </tr>
            </thead>
            <tbody>
              {fechamentos.length === 0 && (
                <tr><td colSpan={10}><div className="empty-state"><div className="empty-text">Nenhum fechamento registrado</div></div></td></tr>
              )}
              {[...fechamentos].sort((a, b) => b.periodo.localeCompare(a.periodo)).map((f) => {
                const [fAno, fMes] = f.periodo.split("-");
                return (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{MESES[parseInt(fMes, 10) - 1]}/{fAno}</td>
                    <td className="td-mono">{fmtDate(f.dataFechamento)}</td>
                    <td className="td-mono">{f.lancamentosCount}</td>
                    <td className="td-green td-mono">{fmtBRL(f.dreSnapshot?.receitas)}</td>
                    <td className="td-red td-mono">{fmtBRL(f.dreSnapshot?.custos)}</td>
                    <td className="td-amber td-mono">{fmtBRL(f.dreSnapshot?.despesas)}</td>
                    <td className="td-mono" style={{ color: "#7c3aed" }}>{fmtBRL(f.dreSnapshot?.impostos)}</td>
                    <td className="td-mono" style={{ fontWeight: 700, color: (f.dreSnapshot?.lucroAposImpostos ?? f.dreSnapshot?.lucroLiquido) >= 0 ? "var(--accent)" : "var(--danger)" }}>
                      {fmtBRL(f.dreSnapshot?.lucroAposImpostos ?? f.dreSnapshot?.lucroLiquido)}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text2)" }}>{f.observacao || "?"}</td>
                    <td className="table-actions-cell">
                      <div className="table-actions-inline">
                        <button type="button" className="btn btn-danger btn-sm btn-icon" title="Remover fechamento" onClick={() => { if (confirm("Remover fechamento?")) fechamentoCrud.remove(f.id); }}>
                          <Trash2 size={14} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function RelatoriosPage() {
  const { fluxoCaixa, mensal, filterPeriodo, contas, planoContas, lancamentos } = useGestor();
  const [relConta, setRelConta] = useState("");
  const [relTipo, setRelTipo] = useState("Todos");

  const fluxoFiltrado = useMemo(() => {
    return fluxoCaixa.filter((l) => {
      if (relConta && l.contaEntradaId !== relConta && l.contaSaidaId !== relConta) return false;
      if (relTipo !== "Todos" && l.tipo !== relTipo) return false;
      return true;
    });
  }, [fluxoCaixa, relConta, relTipo]);

  return (
    <div>
      <div className="toolbar"><PeriodToolbar /></div>

      <div className="card">
        <div className="card-title">Filtros do relatório</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Conta</label>
            <select className="form-select" value={relConta} onChange={(e) => setRelConta(e.target.value)}>
              <option value="">Todas as contas</option>
              {contas.map((c) => <option key={c.id} value={c.id}>{c.apelido || c.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select className="form-select" value={relTipo} onChange={(e) => setRelTipo(e.target.value)}>
              <option>Todos</option><option>Entrada</option><option>Saida</option><option>Transferencia</option>
            </select>
          </div>
        </div>
      </div>

      <div className="charts-grid full">
        <div className="card">
          <div className="card-title">Fluxo de Caixa</div>
          <div className="table-wrap" style={{ maxHeight: 320 }}>
            <table>
              <thead><tr><th>Data</th><th>Histórico</th><th>Tipo</th><th>Valor</th><th>Saldo acum.</th></tr></thead>
              <tbody>
                {fluxoFiltrado.slice(0, 100).map((l) => (
                  <tr key={l.id}>
                    <td className="td-mono">{fmtDate(l.data)}</td>
                    <td style={{ fontSize: 12 }}>{l.historico}</td>
                    <td>{l.tipo}</td>
                    <td className={l.tipo === "Entrada" ? "td-green" : "td-red"}>{fmtBRL(l.valor)}</td>
                    <td className="td-mono">{fmtBRL(l.saldoAcumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => exportRelatorioCSV(fluxoFiltrado.map((l) => ({
            data: l.data, historico: l.historico, tipo: l.tipo, valor: l.valor, saldo: l.saldoAcumulado,
          })), `fluxo_${filterPeriodo.ano}.csv`)}>Exportar fluxo CSV</button>
        </div>
        <div className="card">
          <div className="card-title">Resumo Mensal</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Mês</th><th>Receita</th><th>Custo</th><th>Despesas</th><th>Impostos</th><th>Lucro</th><th>Margem %</th></tr></thead>
              <tbody>
                {mensal.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td className="td-green td-mono">{fmtBRL(m.Receita)}</td>
                    <td className="td-red td-mono">{fmtBRL(m.Custo)}</td>
                    <td className="td-amber td-mono">{fmtBRL(m.Despesas)}</td>
                    <td className="td-mono" style={{ color: "#7c3aed" }}>{fmtBRL(m.Impostos)}</td>
                    <td className="td-mono">{fmtBRL(m["Lucro Líquido"])}</td>
                    <td className="td-mono" style={{ color: (m["Lucro %"] || 0) >= 0 ? "var(--accent)" : "var(--danger)" }}>
                      {fmtPct(m["Lucro %"] || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => exportRelatorioCSV(mensal.map((m) => ({ ...m, "Lucro %": fmtPct(m["Lucro %"] || 0) })), `mensal_${filterPeriodo.ano}.csv`)}>Exportar mensal CSV</button>
        </div>
      </div>
    </div>
  );
}

export function EmpresaPage() {
  const { company, setEmpresaField } = useGestor();

  return (
    <div>
      <div className="card">
        <div className="card-title">Dados da empresa</div>
        <div className="form-grid">
          {[
            ["nomeFantasia", "Nome fantasia"],
            ["razaoSocial", "Razão social"],
            ["cnpj", "CNPJ"],
            ["inscricaoEstadual", "Inscrição estadual"],
            ["codigoDominio", "Código Domínio (exportação contábil)"],
            ["dataFechamento", "Data fechamento"],
          ].map(([key, label]) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label}</label>
              <input
                className="form-input"
                value={company[key] ?? ""}
                onChange={(e) => setEmpresaField(key, key === "codigoDominio" ? Number(e.target.value) : e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
      <p style={{ marginTop: 12, fontSize: 12, color: "var(--muted-foreground)" }}>
        Seus dados ficam salvos no PostgreSQL junto com a sua conta.
      </p>
    </div>
  );
}
