/**
 * ContasAPagarPage — Contas a Pagar / Receber (Phase 4)
 *
 * ISOLAMENTO TOTAL: arquivo novo. Nenhum arquivo existente de página alterado.
 *
 * Regras:
 *  - Usa lançamentos do JSONB existente (sem nova tabela SQL).
 *  - Campos opcionais novos: vencimento (string date), status ("pendente"|"pago").
 *  - Fallbacks: vencimento → l.data, status → "pago" (sem quebrar lançamentos antigos).
 *  - "atrasado" é calculado no frontend e NUNCA persistido.
 *  - Mutações usam lancCrud.update() — o mesmo caminho testado do JSONB.
 *  - viewOnly: todas as ações ficam desabilitadas.
 */
import { useState, useMemo, useCallback } from "react";
import { useGestor }            from "../GestorContext.jsx";
import PfPageShell              from "../components/pf/PfPageShell.jsx";
import { PF_PAGE_HINTS }        from "../pfHints.js";
import { addMoney, fmtBRL, fmtDate, getStatusLancamento } from "../finance.js";
import { MESES }                from "../constants.js";
import { SummaryIcon, EmptyIcon } from "../components/IconBox.jsx";
import {
  ArrowDownLeft, ArrowUpRight, AlertTriangle, Clock, CircleCheck,
} from "../components/icons.jsx";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const hojeStr = () => new Date().toISOString().slice(0, 10);
const em7Str  = () => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

const STATUS_META = {
  pago:     { label: "Pago",     pp: "pp-badge-green" },
  pendente: { label: "Pendente", pp: "pp-badge-blue"  },
  atrasado: { label: "Vencido",  pp: "pp-badge-red"   },
};

// ─── Inline vencimento editor ─────────────────────────────────────────────────

function VencCell({ l, onSave, disabled }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");

  const startEdit = () => {
    if (disabled) return;
    setVal(l._venc);
    setEditing(true);
  };

  const confirm = () => {
    if (val) onSave(l.id, val);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          type="date"
          className="form-input"
          style={{ padding: "3px 7px", fontSize: 12, width: 130, fontFamily: "var(--font-mono)" }}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") confirm(); if (e.key === "Escape") cancel(); }}
        />
        <button className="btn btn-sm btn-primary" onClick={confirm} style={{ padding: "3px 7px" }}>✓</button>
        <button className="btn btn-sm btn-secondary" onClick={cancel} style={{ padding: "3px 7px" }}>✕</button>
      </div>
    );
  }

  return (
    <span
      className="cp-venc-cell"
      onClick={startEdit}
      title={disabled ? "" : "Clique para editar vencimento"}
      style={{ cursor: disabled ? "default" : "pointer" }}
    >
      {fmtDate(l._venc)}
      {!disabled && <span className="cp-venc-edit-icon">✎</span>}
    </span>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ContasAPagarPage() {
  const {
    lancamentos, lancCrud, planoContas,
    filterPeriodo, setFilterPeriodo,
    viewOnly,
  } = useGestor();

  const [statusFilter, setStatusFilter] = useState("aberto"); // "aberto" | "pago" | "todos"
  const [tipoFilter,   setTipoFilter]   = useState("todos");  // "todos" | "pagar" | "receber"

  const hint = PF_PAGE_HINTS["contas-pagar"];

  // ── Base: Entrada + Saída anotadas com _venc e _status ────────────────────
  const base = useMemo(() =>
    lancamentos
      .filter((l) => l.tipo !== "Transferencia")
      .map((l) => ({
        ...l,
        _venc:   l.vencimento ?? l.data,
        _status: getStatusLancamento(l),
      }))
      .sort((a, b) => a._venc.localeCompare(b._venc)),
    [lancamentos]
  );

  // ── Filtro por período (usa vencimento) ───────────────────────────────────
  const periodFiltered = useMemo(() =>
    base.filter((l) => {
      const d = new Date(l._venc + "T00:00:00");
      if (filterPeriodo.ano && d.getFullYear().toString() !== filterPeriodo.ano) return false;
      if (filterPeriodo.mes && (d.getMonth() + 1).toString().padStart(2, "0") !== filterPeriodo.mes) return false;
      return true;
    }),
    [base, filterPeriodo]
  );

  // ── Filtro UI ─────────────────────────────────────────────────────────────
  const visible = useMemo(() =>
    periodFiltered.filter((l) => {
      if (statusFilter === "aberto" && l._status === "pago") return false;
      if (statusFilter === "pago"   && l._status !== "pago") return false;
      if (tipoFilter   === "pagar"   && l.tipo !== "Saida")  return false;
      if (tipoFilter   === "receber" && l.tipo !== "Entrada") return false;
      return true;
    }),
    [periodFiltered, statusFilter, tipoFilter]
  );

  // ── KPIs (sobre periodFiltered, não sobre visible) ────────────────────────
  const kpis = useMemo(() => {
    const h = hojeStr();
    const h7 = em7Str();
    const abertos   = periodFiltered.filter((l) => l._status !== "pago");
    const aPagar    = abertos.filter((l) => l.tipo === "Saida").reduce((s, l) => addMoney(s, l.valor), 0);
    const aReceber  = abertos.filter((l) => l.tipo === "Entrada").reduce((s, l) => addMoney(s, l.valor), 0);
    const vencidos  = abertos.filter((l) => l._status === "atrasado").length;
    const vencendo7 = abertos.filter((l) => l._venc > h && l._venc <= h7).length;
    return { aPagar, aReceber, vencidos, vencendo7 };
  }, [periodFiltered]);

  // ── Mutações ──────────────────────────────────────────────────────────────
  const marcarPago = useCallback((id) => {
    if (viewOnly) return;
    lancCrud.update(id, { status: "pago" });
  }, [lancCrud, viewOnly]);

  const marcarPendente = useCallback((id) => {
    if (viewOnly) return;
    lancCrud.update(id, { status: "pendente" });
  }, [lancCrud, viewOnly]);

  const salvarVenc = useCallback((id, newDate) => {
    if (viewOnly || !newDate) return;
    lancCrud.update(id, { vencimento: newDate });
  }, [lancCrud, viewOnly]);

  const getPlano = (l) => planoContas.find((p) => p.id === l.planoId);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <PfPageShell pageId="contas-pagar">
      <div className="pp-page-header">
        <div className="pp-page-header-text">
          <span className="pp-page-title">{hint?.title || "Contas a Pagar / Receber"}</span>
          <span className="pp-page-sub">{hint?.text}</span>
        </div>
      </div>

      <div className="pp-summary-grid">
        <div className="pp-summary-card pp-summary-out">
          <SummaryIcon icon={ArrowDownLeft} />
          <div className="pp-summary-label">A Pagar</div>
          <div className="pp-summary-value">{fmtBRL(kpis.aPagar)}</div>
          <div className="pp-summary-hint">Despesas em aberto</div>
        </div>
        <div className="pp-summary-card pp-summary-in">
          <SummaryIcon icon={ArrowUpRight} />
          <div className="pp-summary-label">A Receber</div>
          <div className="pp-summary-value">{fmtBRL(kpis.aReceber)}</div>
          <div className="pp-summary-hint">Receitas em aberto</div>
        </div>
        <div className="pp-summary-card pp-summary-warn">
          <SummaryIcon icon={AlertTriangle} />
          <div className="pp-summary-label">Vencidos</div>
          <div className="pp-summary-value">{kpis.vencidos}</div>
          <div className="pp-summary-hint">Já passaram do prazo</div>
        </div>
        <div className="pp-summary-card pp-summary-info">
          <SummaryIcon icon={Clock} />
          <div className="pp-summary-label">Vence em 7 dias</div>
          <div className="pp-summary-value">{kpis.vencendo7}</div>
          <div className="pp-summary-hint">Próximos vencimentos</div>
        </div>
      </div>

      <div className="pp-toolbar">
        {[
          { v: "aberto", label: "Em Aberto" },
          { v: "pago",   label: "Pagos"     },
          { v: "todos",  label: "Todos"     },
        ].map((f) => (
          <button
            key={f.v}
            type="button"
            className={`pp-chip${statusFilter === f.v ? " is-active" : ""}`}
            onClick={() => setStatusFilter(f.v)}
          >
            {f.label}
          </button>
        ))}
        <span className="pp-toolbar-spacer" />
        {[
          { v: "todos",   label: "Todos"     },
          { v: "pagar",   label: "↓ A Pagar" },
          { v: "receber", label: "↑ A Receber" },
        ].map((f) => (
          <button
            key={f.v}
            type="button"
            className={`pp-chip${tipoFilter === f.v ? " is-active" : ""}${f.v === "receber" ? " pp-chip-in" : f.v === "pagar" ? " pp-chip-out" : ""}`}
            onClick={() => setTipoFilter(f.v)}
          >
            {f.label}
          </button>
        ))}
        <span className="pp-toolbar-spacer" />
        <select
          className="pp-select"
          value={filterPeriodo.ano}
          onChange={(e) => setFilterPeriodo((p) => ({ ...p, ano: e.target.value }))}
        >
          {["2022", "2023", "2024", "2025", "2026", "2027"].map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
        <select
          className="pp-select"
          value={filterPeriodo.mes}
          onChange={(e) => setFilterPeriodo((p) => ({ ...p, mes: e.target.value }))}
        >
          <option value="">Todos os meses</option>
          {MESES.map((m, i) => (
            <option key={m} value={(i + 1).toString().padStart(2, "0")}>{m}</option>
          ))}
        </select>
      </div>

      <div className="pp-card">
        {visible.length === 0 ? (
          <div className="pp-empty">
            <EmptyIcon icon={CircleCheck} />
            <div className="pp-empty-title">Nenhuma conta encontrada</div>
            <div className="pp-empty-text">Nenhuma conta encontrada para este filtro.</div>
          </div>
        ) : (
          <>
            <div className="pp-table-wrap">
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>Data lançamento</th>
                    <th>Vencimento</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Tipo</th>
                    <th className="pp-th-num">Valor</th>
                    <th>Status</th>
                    {!viewOnly && <th style={{ textAlign: "right" }}>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((l) => {
                    const meta = STATUS_META[l._status] || STATUS_META.pendente;
                    const tipoCls = l.tipo === "Entrada" ? "in" : "out";
                    const rowCls = l._status === "atrasado" ? " cp-row-late" : "";
                    return (
                      <tr key={l.id} className={rowCls.trim() || undefined}>
                        <td className="td-mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                          {fmtDate(l.data)}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <VencCell l={l} onSave={salvarVenc} disabled={viewOnly} />
                        </td>
                        <td className="cp-td-ellipsis" title={l.historico || ""}>
                          {l.historico || <span style={{ color: "var(--muted-foreground)" }}>—</span>}
                        </td>
                        <td className="cp-td-ellipsis" style={{ maxWidth: 160 }}>
                          {(() => {
                            const pl = getPlano(l);
                            if (!pl) return <span style={{ color: "var(--muted-foreground)" }}>—</span>;
                            return (
                              <span style={{ display: "flex", alignItems: "center", gap: 6 }} title={pl.descricao}>
                                {pl.icone && (
                                  <span className="cat-icone" style={{ background: pl.cor || "var(--muted)", fontSize: 13 }}>
                                    {pl.icone}
                                  </span>
                                )}
                                {pl.descricao}
                              </span>
                            );
                          })()}
                        </td>
                        <td>
                          <span className={`pp-badge ${l.tipo === "Entrada" ? "pp-badge-green" : "pp-badge-red"}`}>
                            {l.tipo === "Entrada" ? "↑ Receber" : "↓ Pagar"}
                          </span>
                        </td>
                        <td className={`pp-cell-value pp-cell-value-${tipoCls}`}>{fmtBRL(l.valor)}</td>
                        <td>
                          <span className={`pp-badge ${meta.pp}`}>{meta.label}</span>
                        </td>
                        {!viewOnly && (
                          <td style={{ textAlign: "right" }}>
                            <div className="pp-row-actions">
                              {l._status !== "pago" ? (
                                <button
                                  type="button"
                                  className="pp-btn-primary"
                                  style={{ height: 28, padding: "0 10px", fontSize: 11 }}
                                  title="Marcar como pago"
                                  onClick={() => marcarPago(l.id)}
                                >
                                  ✓ Pago
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="pp-btn-secondary"
                                  style={{ height: 28, padding: "0 10px", fontSize: 11 }}
                                  title="Reabrir — marcar como pendente"
                                  onClick={() => marcarPendente(l.id)}
                                >
                                  ↺ Reabrir
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="lanc-footer">
              <span>{visible.length} registro{visible.length !== 1 ? "s" : ""}</span>
            </div>
          </>
        )}
      </div>
    </PfPageShell>
  );
}
