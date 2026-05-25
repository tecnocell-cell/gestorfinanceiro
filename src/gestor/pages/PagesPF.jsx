import { useState, useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import { MESES, CHART } from "../constants.js";
import { fmtBRL, fmtDate, getDRE, generateId, filterLancamentos } from "../finance.js";
import CustomTooltip from "../components/CustomTooltip.jsx";
import { useGestor } from "../GestorContext.jsx";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function PeriodToolbar() {
  const { filterPeriodo, setFilterPeriodo } = useGestor();
  return (
    <div className="period-selector">
      <span style={{ color: "var(--text2)", fontSize: 13 }}>Período:</span>
      <select value={filterPeriodo.ano} onChange={(e) => setFilterPeriodo((p) => ({ ...p, ano: e.target.value }))}>
        {["2022", "2023", "2024", "2025", "2026"].map((y) => <option key={y}>{y}</option>)}
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

// ─── Dashboard PF ─────────────────────────────────────────────────────────────

export function DashboardPFPage() {
  const { dreAtual, mensal, contas, getSaldoConta, getSaldoTotal } = useGestor();

  const saldoTotal = getSaldoTotal();
  const saldoMes = dreAtual.receitas - dreAtual.despesas;

  const pieData = [
    { name: "Receitas", value: dreAtual.receitas },
    { name: "Despesas", value: dreAtual.despesas },
  ].filter((d) => d.value > 0);

  const mensalData = mensal.map((m) => ({
    name: m.name,
    Receitas: m.Receita,
    Despesas: m.Despesas,
  }));

  return (
    <div>
      <div className="toolbar"><PeriodToolbar /></div>

      <div className="kpi-grid">
        <div className="kpi-card" style={{ "--kpi-color": "var(--accent)" }}>
          <div className="kpi-label">Receitas</div>
          <div className="kpi-value">{fmtBRL(dreAtual.receitas)}</div>
          <div className="kpi-sub">Entradas no período</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": "var(--danger)" }}>
          <div className="kpi-label">Despesas</div>
          <div className="kpi-value">{fmtBRL(dreAtual.despesas)}</div>
          <div className="kpi-sub">Gastos no período</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": saldoMes >= 0 ? "var(--accent)" : "var(--danger)" }}>
          <div className="kpi-label">Saldo do Período</div>
          <div className="kpi-value">{fmtBRL(saldoMes)}</div>
          <div className="kpi-sub">{saldoMes >= 0 ? "Sobrou no período" : "Déficit no período"}</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": "var(--accent3)" }}>
          <div className="kpi-label">Saldo Total</div>
          <div className="kpi-value">{fmtBRL(saldoTotal)}</div>
          <div className="kpi-sub">{contas.filter((c) => !c.inativo).length} contas</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="card">
          <div className="card-title">Receitas × Despesas (Mensal)</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mensalData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART.tick }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: CHART.tick }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Receitas" fill={CHART.receita} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Despesas" fill={CHART.custo} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Composição do Resultado</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={[CHART.receita, CHART.custo][i % 2]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmtBRL(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Saldo por Conta</div>
        <div className="saldo-grid">
          {contas.filter((c) => !c.inativo).map((c) => (
            <div key={c.id} className="saldo-card">
              <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600 }}>{c.apelido || c.nome}</div>
              <div className="saldo-valor">{fmtBRL(getSaldoConta(c.id))}</div>
              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{c.tipo}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Lançamentos PF ───────────────────────────────────────────────────────────

export function LancamentosPFPage() {
  const {
    lancsFiltrados, planoContas, contas,
    filterPeriodo, tipoFilter, setTipoFilter,
    search, setSearch, openModal, lancCrud,
  } = useGestor();

  const catMap = Object.fromEntries(planoContas.map((p) => [p.id, p.descricao]));
  const contaMap = Object.fromEntries(contas.map((c) => [c.id, c.apelido || c.nome]));

  return (
    <div>
      <div className="toolbar">
        <PeriodToolbar />
        <button className="btn btn-primary btn-sm" onClick={() => openModal("lancamento")}>+ Lançamento</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {["Todos", "Entrada", "Saida", "Transferencia"].map((t) => (
          <div key={t} className={`filter-chip${tipoFilter === t ? " active" : ""}`} onClick={() => setTipoFilter(t)}>
            {t === "Saida" ? "Saída" : t}
          </div>
        ))}
        <div className="search-wrap" style={{ marginLeft: "auto" }}>
          <span className="search-icon">🔍</span>
          <input className="form-input search-input" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Conta</th>
                <th>Valor</th>
                <th>Histórico</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lancsFiltrados.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">Nenhum lançamento encontrado.</td></tr>
              ) : lancsFiltrados.map((l) => (
                <tr key={l.id}>
                  <td className="td-mono">{fmtDate(l.data)}</td>
                  <td>
                    <span className={`badge ${l.tipo === "Entrada" ? "badge-green" : l.tipo === "Transferencia" ? "badge-blue" : "badge-red"}`}>
                      {l.tipo === "Saida" ? "Saída" : l.tipo}
                    </span>
                  </td>
                  <td>{catMap[l.planoId] || "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>
                    {l.contaEntradaId ? contaMap[l.contaEntradaId] : ""}
                    {l.contaSaidaId ? contaMap[l.contaSaidaId] : ""}
                  </td>
                  <td className={l.tipo === "Entrada" ? "td-green" : "td-red"}>{fmtBRL(l.valor)}</td>
                  <td style={{ fontSize: 12, color: "var(--text2)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.historico}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openModal("lancamento", l)}>✎</button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => lancCrud.remove(l.id)}>✕</button>
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

// ─── Categorias PF ────────────────────────────────────────────────────────────

export function CategoriasPFPage() {
  const { planoContas, planoCrud, openModal } = useGestor();
  const receitas = planoContas.filter((p) => !p.inativo && p.tipo === "Receita");
  const despesas = planoContas.filter((p) => !p.inativo && p.tipo === "Despesa");

  const Section = ({ title, items, color }) => (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-title" style={{ color }}>{title}</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Código</th><th>Descrição</th><th>Tipo</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td className="td-mono">{p.codigo}</td>
                <td style={{ fontWeight: 500 }}>{p.descricao}</td>
                <td><span className={`badge ${p.tipo === "Receita" ? "badge-green" : "badge-red"}`}>{p.tipo}</span></td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openModal("categoria-pf", p)}>✎</button>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => planoCrud.remove(p.id)}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={4} className="empty-state">Nenhuma categoria.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <div className="toolbar">
        <div />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => openModal("categoria-pf", { tipo: "Receita" })}>+ Receita</button>
          <button className="btn btn-primary btn-sm" onClick={() => openModal("categoria-pf", { tipo: "Despesa" })}>+ Despesa</button>
        </div>
      </div>
      <Section title="Receitas" items={receitas} color="var(--green-dark)" />
      <Section title="Despesas" items={despesas} color="var(--danger)" />
    </div>
  );
}

// ─── Orçamento ────────────────────────────────────────────────────────────────

export function OrcamentoPage() {
  const { planoContas, lancamentos, filterPeriodo, setFilterPeriodo, orcamentos, orcamentoCrud } = useGestor();

  const despesas = planoContas.filter((p) => !p.inativo && p.tipo === "Despesa");

  const getOrcado = (catId) => {
    const orc = orcamentos.find(
      (o) => o.categoriaId === catId && o.ano === filterPeriodo.ano && o.mes === filterPeriodo.mes
    );
    return orc?.valor || 0;
  };

  const setOrcado = (catId, valor) => {
    const existing = orcamentos.find(
      (o) => o.categoriaId === catId && o.ano === filterPeriodo.ano && o.mes === filterPeriodo.mes
    );
    if (existing) {
      orcamentoCrud.update(existing.id, { valor: parseFloat(valor) || 0 });
    } else {
      orcamentoCrud.add({
        id: generateId(),
        categoriaId: catId,
        ano: filterPeriodo.ano,
        mes: filterPeriodo.mes,
        valor: parseFloat(valor) || 0,
      });
    }
  };

  const getRealizado = (catId) => {
    return lancamentos
      .filter((l) => {
        if (l.planoId !== catId) return false;
        const d = new Date(l.data + "T00:00:00");
        if (filterPeriodo.ano && d.getFullYear().toString() !== filterPeriodo.ano) return false;
        if (filterPeriodo.mes && (d.getMonth() + 1).toString().padStart(2, "0") !== filterPeriodo.mes) return false;
        return true;
      })
      .reduce((s, l) => s + l.valor, 0);
  };

  const linhas = despesas.map((p) => {
    const orcado = getOrcado(p.id);
    const realizado = getRealizado(p.id);
    const diff = orcado - realizado;
    const pct = orcado > 0 ? Math.min((realizado / orcado) * 100, 100) : 0;
    return { ...p, orcado, realizado, diff, pct };
  });

  const totOrcado    = linhas.reduce((s, l) => s + l.orcado, 0);
  const totRealizado = linhas.reduce((s, l) => s + l.realizado, 0);
  const totDiff      = totOrcado - totRealizado;

  const fillClass = (pct) => pct >= 100 ? "red" : pct >= 80 ? "amber" : "green";

  return (
    <div>
      <div className="toolbar">
        <PeriodToolbar />
      </div>

      {!filterPeriodo.mes && (
        <div className="alert alert-warn" style={{ marginBottom: 14 }}>
          Selecione um mês específico para editar o orçamento.
        </div>
      )}

      <div className="kpi-grid" style={{ marginBottom: 18 }}>
        <div className="kpi-card" style={{ "--kpi-color": "var(--accent3)" }}>
          <div className="kpi-label">Total Orçado</div>
          <div className="kpi-value">{fmtBRL(totOrcado)}</div>
          <div className="kpi-sub">Planejado para o mês</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": "var(--danger)" }}>
          <div className="kpi-label">Total Gasto</div>
          <div className="kpi-value">{fmtBRL(totRealizado)}</div>
          <div className="kpi-sub">Realizado no período</div>
        </div>
        <div className="kpi-card" style={{ "--kpi-color": totDiff >= 0 ? "var(--accent)" : "var(--danger)" }}>
          <div className="kpi-label">Saldo do Orçamento</div>
          <div className="kpi-value">{fmtBRL(totDiff)}</div>
          <div className="kpi-sub">{totDiff >= 0 ? "Dentro do orçamento" : "Acima do orçamento"}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="orcamento-row orcamento-header">
          <span>Categoria</span>
          <span style={{ textAlign: "right" }}>Orçado</span>
          <span style={{ textAlign: "right" }}>Realizado</span>
          <span style={{ textAlign: "right" }}>Diferença</span>
          <span style={{ textAlign: "right" }}>%</span>
          <span>Progresso</span>
        </div>
        {linhas.map((l) => (
          <div key={l.id} className="orcamento-row">
            <span style={{ fontWeight: 500 }}>{l.descricao}</span>
            <span>
              <input
                className="orcamento-input"
                type="number"
                min="0"
                step="10"
                value={l.orcado || ""}
                placeholder="0,00"
                onChange={(e) => setOrcado(l.id, e.target.value)}
                disabled={!filterPeriodo.mes}
              />
            </span>
            <span className="td-mono" style={{ textAlign: "right" }}>{fmtBRL(l.realizado)}</span>
            <span className={`td-mono`} style={{ textAlign: "right", color: l.diff >= 0 ? "var(--green-dark)" : "var(--danger)" }}>
              {fmtBRL(l.diff)}
            </span>
            <span className="td-mono" style={{ textAlign: "right", fontSize: 12 }}>
              {l.orcado > 0 ? `${Math.round((l.realizado / l.orcado) * 100)}%` : "—"}
            </span>
            <div style={{ minWidth: 60 }}>
              <div className="progress-wrap">
                <div className={`progress-fill ${fillClass(l.pct)}`} style={{ width: `${l.pct}%` }} />
              </div>
            </div>
          </div>
        ))}
        {linhas.length === 0 && (
          <div className="empty-state">Nenhuma categoria de despesa cadastrada.</div>
        )}
      </div>
    </div>
  );
}

// ─── Metas ────────────────────────────────────────────────────────────────────

export function MetasPage() {
  const { metas, metaCrud, openModal } = useGestor();
  const [aporteMeta, setAporteMeta] = useState(null);
  const [aporteValor, setAporteValor] = useState("");

  const pct = (m) => m.valorAlvo > 0 ? Math.min((m.valorAtual / m.valorAlvo) * 100, 100) : 0;
  const fillClass = (p) => p >= 100 ? "green" : p >= 50 ? "blue" : "purple";

  const handleAporte = () => {
    const v = parseFloat(aporteValor);
    if (!v || !aporteMeta) return;
    metaCrud.update(aporteMeta.id, { valorAtual: (aporteMeta.valorAtual || 0) + v });
    setAporteMeta(null);
    setAporteValor("");
  };

  return (
    <div>
      <div className="toolbar">
        <div />
        <button className="btn btn-primary btn-sm" onClick={() => openModal("meta")}>+ Nova Meta</button>
      </div>

      {metas.length === 0 && (
        <div className="alert alert-info">Nenhuma meta cadastrada. Crie sua primeira meta de poupança!</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {metas.map((m) => {
          const p = pct(m);
          return (
            <div key={m.id} className="meta-card">
              <div className="meta-card-header">
                <div className="meta-title">{m.descricao}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openModal("meta", m)}>✎</button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => metaCrud.remove(m.id)}>✕</button>
                </div>
              </div>
              <div className="meta-values">
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: 600 }}>{fmtBRL(m.valorAtual || 0)}</span>
                <span style={{ color: "var(--text3)" }}> / {fmtBRL(m.valorAlvo)}</span>
              </div>
              <div className="progress-wrap">
                <div className={`progress-fill ${fillClass(p)}`} style={{ width: `${p}%` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <div className="meta-prazo">{m.prazo ? `Prazo: ${m.prazo}` : ""}</div>
                <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: p >= 100 ? "var(--green-dark)" : "var(--text2)" }}>
                  {p.toFixed(0)}%
                </span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ width: "100%", marginTop: 10 }}
                onClick={() => { setAporteMeta(m); setAporteValor(""); }}
              >
                + Registrar Aporte
              </button>
            </div>
          );
        })}
      </div>

      {/* Aporte modal inline */}
      {aporteMeta && (
        <div className="modal-backdrop" onClick={() => setAporteMeta(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <span className="modal-title">Aporte — {aporteMeta.descricao}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setAporteMeta(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Valor do aporte (R$)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={aporteValor}
                  onChange={(e) => setAporteValor(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAporteMeta(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAporte}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Relatórios PF ────────────────────────────────────────────────────────────

export function RelatoriosPFPage() {
  const { lancamentos, planoContas, filterPeriodo } = useGestor();

  const mensal = useMemo(() =>
    MESES.map((name, i) => {
      const mes = (i + 1).toString().padStart(2, "0");
      const dre = getDRE(lancamentos, planoContas, filterPeriodo.ano, mes);
      return { name, Receitas: dre.receitas, Despesas: dre.despesas, Saldo: dre.receitas - dre.despesas };
    }),
    [lancamentos, planoContas, filterPeriodo.ano]
  );

  const categoriaBreakdown = useMemo(() => {
    const despesaCats = planoContas.filter((p) => !p.inativo && p.tipo === "Despesa");
    return despesaCats.map((p) => {
      const total = lancamentos
        .filter((l) => {
          if (l.planoId !== p.id) return false;
          const d = new Date(l.data + "T00:00:00");
          if (filterPeriodo.ano && d.getFullYear().toString() !== filterPeriodo.ano) return false;
          if (filterPeriodo.mes && (d.getMonth() + 1).toString().padStart(2, "0") !== filterPeriodo.mes) return false;
          return true;
        })
        .reduce((s, l) => s + l.valor, 0);
      return { name: p.descricao, value: total };
    }).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  }, [lancamentos, planoContas, filterPeriodo]);

  const PIE_COLORS = ["#f43f5e", "#f97316", "#eab308", "#ec4899", "#6366f1", "#14b8a6", "#f43f5e", "#94a3b8"];

  const exportCSV = () => {
    const rows = [["Mês", "Receitas", "Despesas", "Saldo"]];
    mensal.forEach((m) => rows.push([m.name, m.Receitas.toFixed(2), m.Despesas.toFixed(2), m.Saldo.toFixed(2)]));
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `relatorio_pf_${filterPeriodo.ano}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="toolbar">
        <PeriodToolbar />
        <button className="btn btn-secondary btn-sm" onClick={exportCSV}>⬇ CSV</button>
      </div>

      <div className="charts-grid">
        <div className="card">
          <div className="card-title">Receitas × Despesas ({filterPeriodo.ano})</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mensal} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART.tick }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: CHART.tick }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Receitas" fill={CHART.receita} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Despesas" fill={CHART.custo} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Gastos por Categoria</div>
          {categoriaBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoriaBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {categoriaBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmtBRL(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">Sem dados de despesas no período.</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Evolução Mensal — {filterPeriodo.ano}</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th style={{ textAlign: "right" }}>Receitas</th>
                <th style={{ textAlign: "right" }}>Despesas</th>
                <th style={{ textAlign: "right" }}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {mensal.map((m) => (
                <tr key={m.name}>
                  <td style={{ fontWeight: 500 }}>{m.name}</td>
                  <td className="td-green" style={{ textAlign: "right" }}>{fmtBRL(m.Receitas)}</td>
                  <td className="td-red" style={{ textAlign: "right" }}>{fmtBRL(m.Despesas)}</td>
                  <td className={m.Saldo >= 0 ? "td-green" : "td-red"} style={{ textAlign: "right", fontWeight: 600 }}>{fmtBRL(m.Saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Perfil PF ────────────────────────────────────────────────────────────────

export function PerfilPFPage() {
  const { pessoa, patchEmpresa } = useGestor();
  const [form, setForm] = useState({ nome: "", cpf: "", email: "", telefone: "", dataNascimento: "", profissao: "", ...(pessoa || {}) });
  const [saved, setSaved] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    patchEmpresa({ pessoa: { ...form }, nome: form.nome });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">Dados Pessoais</div>
        <div className="form-grid">
          {[
            ["nome", "Nome Completo", "text"],
            ["cpf", "CPF", "text"],
            ["email", "E-mail", "email"],
            ["telefone", "Telefone", "text"],
            ["dataNascimento", "Data de Nascimento", "date"],
            ["profissao", "Profissão", "text"],
          ].map(([key, label, type]) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label}</label>
              <input className="form-input" type={type} value={form[key] ?? ""} onChange={(e) => set(key, e.target.value)} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-primary" onClick={handleSave}>Salvar</button>
          {saved && <span style={{ color: "var(--green-dark)", fontSize: 13 }}>✓ Salvo!</span>}
        </div>
      </div>
    </div>
  );
}
