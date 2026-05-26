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
import { fmtBRL, fmtDate, getStatusLancamento } from "../finance.js";
import { MESES }                from "../constants.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const hojeStr = () => new Date().toISOString().slice(0, 10);
const em7Str  = () => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

const STATUS_META = {
  pago:     { label: "Pago",    cls: "badge-cp-pago"     },
  pendente: { label: "Pendente", cls: "badge-cp-pendente" },
  atrasado: { label: "Vencido",  cls: "badge-cp-atrasado" },
};

// ─── KPI card local ───────────────────────────────────────────────────────────

function CpKpi({ icon, label, value, sub, color }) {
  return (
    <div className="cp-kpi">
      <div className="cp-kpi-icon">{icon}</div>
      <div className="cp-kpi-label">{label}</div>
      <div className="cp-kpi-value" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="cp-kpi-sub">{sub}</div>}
    </div>
  );
}

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
    const aPagar    = abertos.filter((l) => l.tipo === "Saida").reduce((s, l) => s + l.valor, 0);
    const aReceber  = abertos.filter((l) => l.tipo === "Entrada").reduce((s, l) => s + l.valor, 0);
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
    <div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="cp-kpi-grid">
        <CpKpi
          icon="↓"
          label="A Pagar"
          value={fmtBRL(kpis.aPagar)}
          sub="Despesas em aberto"
          color="var(--danger-fg)"
        />
        <CpKpi
          icon="↑"
          label="A Receber"
          value={fmtBRL(kpis.aReceber)}
          sub="Receitas em aberto"
          color="var(--success-fg)"
        />
        <CpKpi
          icon="⚠"
          label="Vencidos"
          value={kpis.vencidos.toString()}
          sub="Já passaram do prazo"
          color={kpis.vencidos > 0 ? "var(--danger-fg)" : undefined}
        />
        <CpKpi
          icon="⌚"
          label="Vence em 7 dias"
          value={kpis.vencendo7.toString()}
          sub="Próximos vencimentos"
          color={kpis.vencendo7 > 0 ? "var(--warning-fg)" : undefined}
        />
      </div>

      {/* ── Filtros + período ────────────────────────────────────────────── */}
      <div className="cp-filters">
        <div className="cp-filter-group">
          <span className="cp-filter-label">Status:</span>
          {[
            { v: "aberto", label: "Em Aberto" },
            { v: "pago",   label: "Pagos"     },
            { v: "todos",  label: "Todos"     },
          ].map((f) => (
            <button
              key={f.v}
              type="button"
              className={`btn btn-sm${statusFilter === f.v ? " btn-primary" : " btn-secondary"}`}
              onClick={() => setStatusFilter(f.v)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="cp-filter-group">
          <span className="cp-filter-label">Tipo:</span>
          {[
            { v: "todos",   label: "Todos"     },
            { v: "pagar",   label: "A Pagar"   },
            { v: "receber", label: "A Receber" },
          ].map((f) => (
            <button
              key={f.v}
              type="button"
              className={`btn btn-sm${tipoFilter === f.v ? " btn-primary" : " btn-secondary"}`}
              onClick={() => setTipoFilter(f.v)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="cp-filter-group" style={{ marginLeft: "auto" }}>
          <span className="cp-filter-label">Período:</span>
          <select
            className="form-input"
            style={{ padding: "4px 8px", fontSize: 12 }}
            value={filterPeriodo.ano}
            onChange={(e) => setFilterPeriodo((p) => ({ ...p, ano: e.target.value }))}
          >
            {["2023", "2024", "2025", "2026", "2027"].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <select
            className="form-input"
            style={{ padding: "4px 8px", fontSize: 12 }}
            value={filterPeriodo.mes}
            onChange={(e) => setFilterPeriodo((p) => ({ ...p, mes: e.target.value }))}
          >
            <option value="">Todos os meses</option>
            {MESES.map((m, i) => (
              <option key={m} value={(i + 1).toString().padStart(2, "0")}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Tabela ───────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginTop: 0, padding: 0, overflow: "hidden" }}>
        {visible.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div>Nenhuma conta encontrada para este filtro.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Data lançamento</th>
                  <th>Vencimento</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                  <th>Status</th>
                  {!viewOnly && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((l) => {
                  const meta = STATUS_META[l._status] || STATUS_META.pendente;
                  return (
                    <tr key={l.id}>

                      {/* Data lançamento */}
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, whiteSpace: "nowrap" }}>
                        {fmtDate(l.data)}
                      </td>

                      {/* Vencimento — editável inline */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        <VencCell l={l} onSave={salvarVenc} disabled={viewOnly} />
                      </td>

                      {/* Descrição */}
                      <td className="cp-td-ellipsis" title={l.historico || ""}>
                        {l.historico || <span style={{ color: "var(--muted-foreground)" }}>—</span>}
                      </td>

                      {/* Categoria */}
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

                      {/* Tipo */}
                      <td>
                        <span className={`badge ${l.tipo === "Entrada" ? "badge-success" : "badge-danger"}`}>
                          {l.tipo === "Entrada" ? "↑ Receber" : "↓ Pagar"}
                        </span>
                      </td>

                      {/* Valor */}
                      <td style={{
                        textAlign: "right",
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        fontWeight: 700,
                        color: l.tipo === "Entrada" ? "var(--success-fg)" : "var(--danger-fg)",
                        whiteSpace: "nowrap",
                      }}>
                        {fmtBRL(l.valor)}
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`badge ${meta.cls}`}>{meta.label}</span>
                      </td>

                      {/* Ações */}
                      {!viewOnly && (
                        <td>
                          <div className="admin-actions">
                            {l._status !== "pago" ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                style={{ fontSize: 11, padding: "3px 8px" }}
                                title="Marcar como pago"
                                onClick={() => marcarPago(l.id)}
                              >
                                ✓ Pago
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                style={{ fontSize: 11, padding: "3px 8px" }}
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
        )}
      </div>

      {visible.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 8, textAlign: "right" }}>
          {visible.length} registro{visible.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
