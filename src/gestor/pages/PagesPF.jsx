import { useState, useMemo, useEffect, useCallback } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import { MESES, CHART } from "../constants.js";
import { fmtBRL, fmtDate, fmtDateTime, getDRE, generateId, filterLancamentos } from "../finance.js";
import RecorrenciaAlert from "../components/RecorrenciaAlert.jsx";
import CustomTooltip from "../components/CustomTooltip.jsx";
import { useGestor } from "../GestorContext.jsx";
import { integracaoPfPjApi } from "../api.js";
import PfPageShell from "../components/pf/PfPageShell.jsx";
import { ContasPage } from "./Pages.jsx";
import { getDueDate, getLancamentoSituacao } from "../pfDueDates.js";
import {
  LANCAMENTO_FILTER_OPTIONS,
  labelFilterChip,
  labelLancamentoTipo,
} from "../profileLabels.js";
import { DEFAULT_CATS_PF } from "../defaultCategories.js";
import { PF_PAGE_HINTS } from "../pfHints.js";
import { PenLine, Trash2, ClipboardList, ArrowDownLeft, CircleCheck, AlertTriangle, Target } from "../components/icons.jsx";
import { SummaryIcon, EmptyIcon } from "../components/IconBox.jsx";

// ─── Shared helpers ───────────────────────────────────────────────────────────

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

function formatContaLanc(l, contaMap) {
  const ent = l.contaEntradaId ? contaMap[l.contaEntradaId] : "";
  const sai = l.contaSaidaId ? contaMap[l.contaSaidaId] : "";
  if (l.tipo === "Transferencia" && ent && sai) {
    return ent === sai ? ent : `${sai} → ${ent}`;
  }
  if (l.tipo === "Entrada") return ent || sai || "—";
  if (l.tipo === "Saida") return sai || ent || "—";
  return ent || sai || "—";
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
    <PfPageShell pageId="dashboard">
    <div>
      <div className="toolbar"><PeriodToolbar /></div>
      <RecorrenciaAlert />
      <div className="kpi-grid">
        <div className="kpi-card" style={{ "--kpi-color": "var(--accent)" }}>
          <div className="kpi-label">Receitas</div>
          <div className="kpi-value">{fmtBRL(dreAtual.receitas)}</div>
          <div className="kpi-sub">Receitas no período</div>
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
    </PfPageShell>
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

  const statusInfo = {
    entrada: { badge: "badge-blue", label: "Receita", valor: "td-blue" },
    pago: { badge: "badge-green", label: "Quitada", valor: "td-green" },
    vencida: { badge: "badge-red", label: "Vencida", valor: "td-red" },
    proximo: { badge: "badge-amber", label: "A vencer", valor: "td-amber" },
    pendente: { badge: "badge-amber", label: "Pendente", valor: "td-red" },
  };

  const resumo = useMemo(() => {
    let ent = 0, sai = 0;
    for (const l of lancsFiltrados) {
      if (l.tipo === "Entrada") ent += l.valor || 0;
      else if (l.tipo === "Saida") sai += l.valor || 0;
    }
    return { entradas: ent, saidas: sai, saldo: ent - sai, qtd: lancsFiltrados.length };
  }, [lancsFiltrados]);

  return (
    <PfPageShell pageId="lancamentos">
    <div className="lanc-premium">
      <div className="lanc-toolbar">
        <div className="lanc-toolbar-row">
          <PeriodToolbar />
          <div className="lanc-search">
            <span className="lanc-search-icon" aria-hidden>🔍</span>
            <input
              className="lanc-search-input"
              placeholder="Buscar lançamentos…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="lanc-toolbar-actions">
            <button
              type="button"
              className="lanc-btn-primary"
              onClick={() => openModal("lancamento")}
            >
              <span aria-hidden>＋</span> Novo lançamento
            </button>
          </div>
        </div>
        <div className="lanc-chips-row">
          <div className="lanc-chips">
            {LANCAMENTO_FILTER_OPTIONS.map((t) => (
              <button
                type="button"
                key={t}
                className={`lanc-chip${tipoFilter === t ? " is-active" : ""} lanc-chip-${String(t).toLowerCase()}`}
                onClick={() => setTipoFilter(t)}
              >
                {labelFilterChip(t, true)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lanc-summary-grid">
        <div className="lanc-summary-card lanc-summary-in">
          <div className="lanc-summary-label">Receitas</div>
          <div className="lanc-summary-value">{fmtBRL(resumo.entradas)}</div>
          <div className="lanc-summary-hint">no período filtrado</div>
        </div>
        <div className="lanc-summary-card lanc-summary-out">
          <div className="lanc-summary-label">Despesas</div>
          <div className="lanc-summary-value">{fmtBRL(resumo.saidas)}</div>
          <div className="lanc-summary-hint">no período filtrado</div>
        </div>
        <div className={`lanc-summary-card ${resumo.saldo >= 0 ? "lanc-summary-pos" : "lanc-summary-neg"}`}>
          <div className="lanc-summary-label">Saldo do período</div>
          <div className="lanc-summary-value">{fmtBRL(resumo.saldo)}</div>
          <div className="lanc-summary-hint">{resumo.saldo >= 0 ? "sobrou" : "déficit"}</div>
        </div>
        <div className="lanc-summary-card lanc-summary-count">
          <div className="lanc-summary-label">Lançamentos</div>
          <div className="lanc-summary-value">{resumo.qtd}</div>
          <div className="lanc-summary-hint">{resumo.qtd === 1 ? "registro" : "registros"}</div>
        </div>
      </div>

      <div className="lanc-card">
        {lancsFiltrados.length === 0 ? (
          <div className="lanc-empty-premium">
            <div className="lanc-empty-icon" aria-hidden>💰</div>
            <div className="lanc-empty-title">Você ainda não tem lançamentos por aqui</div>
            <div className="lanc-empty-text">
              Comece adicionando suas receitas e despesas para acompanhar seu dinheiro de perto.
            </div>
            <button
              type="button"
              className="lanc-btn-primary"
              onClick={() => openModal("lancamento")}
            >
              <span aria-hidden>＋</span> Novo lançamento
            </button>
          </div>
        ) : (
          <>
            <div className="lanc-table-wrap">
              <table className="lanc-table lanc-table-pf">
                <colgroup>
                  <col className="lanc-col-date" />
                  <col className="lanc-col-status" />
                  <col className="lanc-col-cat" />
                  <col className="lanc-col-conta" />
                  <col className="lanc-col-val" />
                  <col className="lanc-col-hist" />
                  <col className="lanc-col-act" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Status</th>
                    <th>Categoria</th>
                    <th>Conta</th>
                    <th className="lanc-th-num">Valor</th>
                    <th>Histórico</th>
                    <th className="lanc-th-act" aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {lancsFiltrados.map((l) => {
                    const venc = getDueDate(l);
                    const situacao = getLancamentoSituacao(l);
                    const info = statusInfo[situacao];
                    const tipoCls = l.tipo === "Entrada" ? "in" : l.tipo === "Saida" ? "out" : "tr";
                    const tipoIcon = l.tipo === "Entrada" ? "↓" : l.tipo === "Saida" ? "↑" : "⇄";
                    return (
                      <tr key={l.id} className={`lanc-row lanc-row-${tipoCls}${situacao ? ` lanc-row-${situacao}` : ""}`}>
                        <td className="td-mono lanc-cell-date">
                          <div className="lanc-date-cell">
                            <span className={`lanc-type-dot lanc-type-${tipoCls}`} title={l.tipo} aria-hidden>{tipoIcon}</span>
                            <div className="lanc-cell-stack">
                              <div>{fmtDate(l.data)}</div>
                              {l.tipo === "Saida" && venc && (
                                <div className={`lanc-cell-meta${situacao === "vencida" ? " lanc-meta-late" : situacao === "proximo" ? " lanc-meta-soon" : ""}`}>
                                  Venc. {fmtDate(venc)}
                                </div>
                              )}
                              {l.createdAt && (
                                <div className="lanc-cell-meta">
                                  {new Date(l.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                  {l.source === "whatsapp" && " 📱"}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          {l.tipo === "Saida" && info ? (
                            <span className={`lanc-badge lanc-badge-${info.badge.replace("badge-", "")}`}>{info.label}</span>
                          ) : l.tipo === "Entrada" ? (
                            <span className="lanc-badge lanc-badge-blue">Receita</span>
                          ) : (
                            <span className={`lanc-badge lanc-badge-${l.tipo === "Saida" ? "red" : "blue"}`}>
                              {labelLancamentoTipo(l.tipo, true)}
                            </span>
                          )}
                        </td>
                        <td className="lanc-cell-clip" title={catMap[l.planoId] || ""}>{catMap[l.planoId] || "—"}</td>
                        <td className="lanc-cell-quiet lanc-cell-clip lanc-cell-conta" title={formatContaLanc(l, contaMap)}>
                          {formatContaLanc(l, contaMap)}
                        </td>
                        <td className={`lanc-th-num lanc-value lanc-value-${tipoCls}`}>{fmtBRL(l.valor)}</td>
                        <td title={l.historico || undefined}>
                          <span className="lanc-cell-hist">{l.historico || "—"}</span>
                        </td>
                        <td className="lanc-actions-cell">
                          <div className="lanc-actions">
                            <button type="button" className="lanc-icon-btn" title="Editar lançamento" onClick={() => openModal("lancamento", l)}>
                              <PenLine size={14} strokeWidth={2} aria-hidden />
                            </button>
                            <button type="button" className="lanc-icon-btn lanc-icon-btn-danger" title="Excluir lançamento" onClick={() => lancCrud.remove(l.id)}>
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

            <div className="lanc-mobile-list">
              {lancsFiltrados.map((l) => {
                const situacao = getLancamentoSituacao(l);
                const info = statusInfo[situacao];
                const tipoCls = l.tipo === "Entrada" ? "in" : l.tipo === "Saida" ? "out" : "tr";
                const tipoIcon = l.tipo === "Entrada" ? "↓" : l.tipo === "Saida" ? "↑" : "⇄";
                return (
                  <div key={l.id} className={`lanc-mobile-item lanc-mobile-${tipoCls}`}>
                    <div className={`lanc-mobile-icon lanc-type-${tipoCls}`} aria-hidden>{tipoIcon}</div>
                    <div className="lanc-mobile-body">
                      <div className="lanc-mobile-top">
                        <span className="lanc-mobile-hist">{l.historico || catMap[l.planoId] || "—"}</span>
                        <span className={`lanc-value lanc-value-${tipoCls}`}>{fmtBRL(l.valor)}</span>
                      </div>
                      <div className="lanc-mobile-meta">
                        <span>{fmtDate(l.data)}</span>
                        {catMap[l.planoId] && (<><span>·</span><span>{catMap[l.planoId]}</span></>)}
                        {info && (<><span>·</span><span className={`lanc-badge lanc-badge-${info.badge.replace("badge-", "")}`}>{info.label}</span></>)}
                      </div>
                    </div>
                    <div className="lanc-actions">
                      <button type="button" className="lanc-icon-btn" title="Editar" onClick={() => openModal("lancamento", l)}>
                        <PenLine size={14} strokeWidth={2} aria-hidden />
                      </button>
                      <button type="button" className="lanc-icon-btn lanc-icon-btn-danger" title="Excluir" onClick={() => lancCrud.remove(l.id)}>
                        <Trash2 size={14} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="lanc-footer">
              <span>{lancsFiltrados.length} {lancsFiltrados.length === 1 ? "registro" : "registros"}</span>
            </div>
          </>
        )}
      </div>
    </div>
    </PfPageShell>
  );
}

// ─── Categorias PF ────────────────────────────────────────────────────────────

export function CategoriasPFPage() {
  const { planoContas, planoCrud, openModal } = useGestor();
  const receitas = planoContas.filter((p) => !p.inativo && p.tipo === "Receita");
  const despesas = planoContas.filter((p) => !p.inativo && p.tipo === "Despesa");

  // ── Sugestões de categorias padrão ────────────────────────────────────────
  const importarSugestoes = () => {
    const existentes = new Set(planoContas.map((p) => p.descricao.toLowerCase().trim()));
    const novas = DEFAULT_CATS_PF.filter((c) => !existentes.has(c.descricao.toLowerCase().trim()));
    if (!novas.length) return alert("Todas as categorias sugeridas já existem.");
    if (!window.confirm(`Adicionar ${novas.length} categoria(s) sugerida(s)?`)) return;
    novas.forEach((c) => planoCrud.add({ ...c, id: generateId(), codigo: "", contaContabil: "", caixaBanco: "" }));
  };

  // ── Tabela de categorias com ícone + cor ──────────────────────────────────
  const Section = ({ title, items, badgeCls }) => (
    <div className="pp-card" style={{ marginBottom: 14 }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 14 }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div className="pp-empty" style={{ padding: "32px 24px" }}>
          <div className="pp-empty-text">Nenhuma categoria.</div>
        </div>
      ) : (
        <div className="pp-table-wrap">
          <table className="pp-table">
            <thead>
              <tr><th style={{ width: 48 }}>Ícone</th><th>Descrição</th><th>Tipo</th><th style={{ textAlign: "right" }}>Ações</th></tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td style={{ textAlign: "center" }}>
                    {p.icone ? (
                      <span className="cat-icone" style={{ background: p.cor || "var(--muted)", fontSize: 15 }}>
                        {p.icone}
                      </span>
                    ) : (
                      <span className="cat-icone cat-icone-empty">◼</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {p.descricao}
                    {p.codigo && <span className="td-mono" style={{ marginLeft: 8, fontSize: 11, color: "var(--muted-foreground)" }}>{p.codigo}</span>}
                  </td>
                  <td><span className={`pp-badge ${badgeCls}`}>{p.tipo}</span></td>
                  <td style={{ textAlign: "right" }}>
                    <div className="pp-row-actions">
                      <button type="button" className="pp-icon-btn" title="Editar categoria" onClick={() => openModal("categoria-pf", p)}>
                        <PenLine size={14} strokeWidth={2} aria-hidden />
                      </button>
                      <button type="button" className="pp-icon-btn pp-icon-btn-danger" title="Excluir categoria" onClick={() => planoCrud.remove(p.id)}>
                        <Trash2 size={14} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const hint = PF_PAGE_HINTS.categorias;

  return (
    <PfPageShell pageId="categorias">
    <div>
      <div className="pp-page-header">
        <div className="pp-page-header-text">
          <span className="pp-page-title">{hint?.title || "Categorias"}</span>
          <span className="pp-page-sub">{hint?.text}</span>
        </div>
        <div className="pp-page-actions">
          <button type="button" className="pp-btn-secondary" onClick={importarSugestoes} title="Adiciona categorias padrão sugeridas que ainda não existem">
            ✦ Sugestões
          </button>
          <button type="button" className="pp-btn-primary" onClick={() => openModal("categoria-pf")}>
            <span aria-hidden>＋</span> Nova categoria
          </button>
        </div>
      </div>
      <Section title="Receitas" items={receitas} badgeCls="pp-badge-green" />
      <Section title="Despesas" items={despesas} badgeCls="pp-badge-red" />
    </div>
    </PfPageShell>
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
  const hint = PF_PAGE_HINTS.orcamento;

  return (
    <PfPageShell pageId="orcamento">
    <div>
      <div className="pp-page-header">
        <div className="pp-page-header-text">
          <span className="pp-page-title">{hint?.title || "Orçamento"}</span>
          <span className="pp-page-sub">{hint?.text}</span>
        </div>
      </div>

      <div className="pp-toolbar">
        <PeriodToolbar />
      </div>

      {!filterPeriodo.mes && (
        <div className="alert alert-warn" style={{ marginBottom: 14 }}>
          Selecione um mês específico para editar o orçamento.
        </div>
      )}

      <div className="pp-summary-grid cols-3">
        <div className="pp-summary-card pp-summary-info">
          <SummaryIcon icon={ClipboardList} />
          <div className="pp-summary-label">Total Orçado</div>
          <div className="pp-summary-value">{fmtBRL(totOrcado)}</div>
          <div className="pp-summary-hint">Planejado para o mês</div>
        </div>
        <div className="pp-summary-card pp-summary-out">
          <SummaryIcon icon={ArrowDownLeft} />
          <div className="pp-summary-label">Total Gasto</div>
          <div className="pp-summary-value">{fmtBRL(totRealizado)}</div>
          <div className="pp-summary-hint">Realizado no período</div>
        </div>
        <div className={`pp-summary-card ${totDiff >= 0 ? "pp-summary-in" : "pp-summary-warn"}`}>
          <SummaryIcon icon={totDiff >= 0 ? CircleCheck : AlertTriangle} />
          <div className="pp-summary-label">Saldo do Orçamento</div>
          <div className="pp-summary-value">{fmtBRL(totDiff)}</div>
          <div className="pp-summary-hint">{totDiff >= 0 ? "Dentro do orçamento" : "Acima do orçamento"}</div>
        </div>
      </div>

      <div className="pp-card" style={{ padding: 0 }}>
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
          <div className="pp-empty" style={{ padding: "32px 24px" }}>
            <div className="pp-empty-text">Nenhuma categoria de despesa cadastrada.</div>
          </div>
        )}
      </div>
    </div>
    </PfPageShell>
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

  const hint = PF_PAGE_HINTS.metas;

  return (
    <PfPageShell pageId="metas">
    <div>
      <div className="pp-page-header">
        <div className="pp-page-header-text">
          <span className="pp-page-title">{hint?.title || "Metas"}</span>
          <span className="pp-page-sub">{hint?.text}</span>
        </div>
        <div className="pp-page-actions">
          <button type="button" className="pp-btn-primary" onClick={() => openModal("meta")}>
            <span aria-hidden>＋</span> Nova meta
          </button>
        </div>
      </div>

      {metas.length === 0 && (
        <div className="pp-card">
          <div className="pp-empty">
            <EmptyIcon icon={Target} />
            <div className="pp-empty-title">Nenhuma meta cadastrada</div>
            <div className="pp-empty-text">Crie sua primeira meta de poupança com valor alvo e prazo.</div>
            <button type="button" className="pp-btn-primary" onClick={() => openModal("meta")}>
              <span aria-hidden>＋</span> Nova meta
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {metas.map((m) => {
          const p = pct(m);
          return (
            <div key={m.id} className="meta-card pp-card" style={{ padding: 16 }}>
              <div className="meta-card-header">
                <div className="meta-title">{m.descricao}</div>
                <div className="pp-row-actions">
                  <button type="button" className="pp-icon-btn" title="Editar meta" onClick={() => openModal("meta", m)}>
                    <PenLine size={14} strokeWidth={2} aria-hidden />
                  </button>
                  <button type="button" className="pp-icon-btn pp-icon-btn-danger" title="Excluir meta" onClick={() => metaCrud.remove(m.id)}>
                    <Trash2 size={14} strokeWidth={2} aria-hidden />
                  </button>
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
                type="button"
                className="pp-btn-secondary"
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
    </PfPageShell>
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
    <PfPageShell pageId="relatorios">
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
    </PfPageShell>
  );
}

// ─── Perfil PF ────────────────────────────────────────────────────────────────

function PfPjVinculoCard() {
  const { viewOnly } = useGestor();
  const [pendentes, setPendentes] = useState([]);
  const [ativos, setAtivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acao, setAcao] = useState(null);
  const [erro, setErro] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const data = await integracaoPfPjApi.getVinculo();
      setPendentes(data.pendentes || []);
      setAtivos(data.ativos || []);
    } catch (err) {
      setErro(err.message || "Erro ao carregar convites.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAceitar = async (id) => {
    setAcao(id);
    setErro(null);
    setMsg(null);
    try {
      await integracaoPfPjApi.aceitar(id);
      setMsg("Vínculo aceito com sucesso.");
      await load();
    } catch (err) {
      setErro(err.message || "Erro ao aceitar.");
    } finally {
      setAcao(null);
    }
  };

  const handleRecusar = async (id) => {
    if (!window.confirm("Recusar este convite de vínculo?")) return;
    setAcao(id);
    setErro(null);
    setMsg(null);
    try {
      await integracaoPfPjApi.recusar(id);
      setMsg("Convite recusado.");
      await load();
    } catch (err) {
      setErro(err.message || "Erro ao recusar.");
    } finally {
      setAcao(null);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Integração com PJ</div>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Carregando...</div>
      </div>
    );
  }

  if (!pendentes.length && !ativos.length) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">Integração com PJ</div>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55, margin: "0 0 14px" }}>
        Empresas PJ podem vincular sua conta PF para repasses futuros. Aceite apenas convites de empresas que você reconhece.
      </p>

      {ativos.map((v) => (
        <div key={v.id} className="alert alert-info" style={{ marginBottom: 10 }}>
          <strong>Vinculada a {v.nomePj || "Empresa PJ"}</strong>
          <span className="badge badge-cp-pago" style={{ marginLeft: 8, fontSize: 10 }}>Ativo</span>
        </div>
      ))}

      {pendentes.map((v) => (
        <div key={v.id} style={{
          border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
          padding: "12px 14px", marginBottom: 10,
        }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{v.nomePj || "Empresa PJ"}</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
            Convite para vincular sua conta PF
          </div>
          {!viewOnly && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="btn btn-primary btn-sm"
                disabled={acao === v.id}
                onClick={() => handleAceitar(v.id)}>
                {acao === v.id ? "..." : "Aceitar"}
              </button>
              <button type="button" className="btn btn-secondary btn-sm"
                disabled={acao === v.id}
                onClick={() => handleRecusar(v.id)}>
                Recusar
              </button>
            </div>
          )}
        </div>
      ))}

      {erro && <div className="alert alert-warn" style={{ marginTop: 8 }}>{erro}</div>}
      {msg && <div className="alert alert-info" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

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
      <PfPjVinculoCard />
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

// ─── Contas PF ────────────────────────────────────────────────────────────────

export function ContasPFPage() {
  return (
    <PfPageShell pageId="contas">
      <ContasPage pfMode />
    </PfPageShell>
  );
}
