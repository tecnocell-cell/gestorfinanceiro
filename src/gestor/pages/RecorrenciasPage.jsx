/**
 * RecorrenciasPage — Despesas e Receitas Recorrentes
 *
 * Funciona para PF e PJ (lê contas e planoContas do GestorContext).
 * Em modo viewOnly (admin impersonation): leitura apenas, sem criar/editar/excluir.
 */
import { useState } from "react";
import { useGestor } from "../GestorContext.jsx";
import { useRecorrencias } from "../hooks/useRecorrencias.js";
import { addMoney, fmtBRL, fmtDate, generateId, toDateKey, safeNum } from "../finance.js";
import { PenLine, Trash2, Pause, Play, CircleCheck, Repeat, ArrowDownLeft, ArrowUpRight, Clock, AlertTriangle, Loader2 } from "../components/icons.jsx";
import { SummaryIcon, EmptyIcon } from "../components/IconBox.jsx";
import PfPageShell from "../components/pf/PfPageShell.jsx";
import {
  ModalShell,
  ModalSection,
  ModalFooter,
  ModalGrid,
  ModalField,
  ModalTipoPills,
} from "../components/ModalShell.jsx";

const REC_TIPO_OPTIONS = [
  { value: "Receita", label: "Receita" },
  { value: "Despesa", label: "Despesa" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const hoje = () => new Date().toISOString().slice(0, 10);

function calcProximaDataLocal(periodicidade, dataAtual) {
  const key = toDateKey(dataAtual);
  if (!key) return hoje();
  const d = new Date(key + "T00:00:00");
  if (periodicidade === "mensal")  d.setMonth(d.getMonth() + 1);
  else if (periodicidade === "semanal") d.setDate(d.getDate() + 7);
  else if (periodicidade === "anual")  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function diasAteVencimento(data) {
  // normaliza timestamp do Postgres (ex: "2026-05-30T00:00:00.000Z") → "2026-05-30"
  const key = toDateKey(data);
  if (!key) return NaN;
  const diff = new Date(key + "T00:00:00") - new Date(hoje() + "T00:00:00");
  return Math.ceil(diff / 86_400_000);
}

function classProxima(data) {
  const dias = diasAteVencimento(data);
  if (Number.isNaN(dias)) return "";
  if (dias < 0)  return "recorrencias-proxima-late";
  if (dias <= 7) return "recorrencias-proxima-soon";
  return "recorrencias-proxima-ok";
}

function labelProxima(data) {
  const key = toDateKey(data);
  if (!key) return "—";
  const dias = diasAteVencimento(key);
  if (Number.isNaN(dias)) return "—";
  if (dias < 0)  return `${fmtDate(key)} (${Math.abs(dias)}d atraso)`;
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  if (dias <= 7)  return `${fmtDate(key)} (em ${dias}d)`;
  return fmtDate(key);
}

const PERIODO_LABEL = { mensal: "Mensal", semanal: "Semanal", anual: "Anual" };
const VAZIO_FORM = {
  tipo: "Despesa",
  descricao: "",
  valor: "",
  periodicidade: "mensal",
  proxima_data: hoje(),
  conta_id: "",
  plano_id: "",
  observacao: "",
};

// ─── Modal Recorrência (criar / editar) ───────────────────────────────────────

function ModalRecorrencia({ recorrencia, onClose, onCreate, onUpdate, contas, planoContas }) {
  const isEdit = !!recorrencia;
  const [form, setForm] = useState(
    isEdit
      ? {
          tipo:          recorrencia.tipo,
          descricao:     recorrencia.descricao,
          valor:         String(recorrencia.valor),
          periodicidade: recorrencia.periodicidade,
          proxima_data:  toDateKey(recorrencia.proxima_data) || hoje(),
          conta_id:      recorrencia.conta_id  || "",
          plano_id:      recorrencia.plano_id  || "",
          status:        recorrencia.status,
          observacao:    recorrencia.observacao || "",
        }
      : { ...VAZIO_FORM }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Filtra categorias pelo tipo selecionado
  const categoriasFiltradas = planoContas.filter((p) => {
    if (form.tipo === "Receita") return p.natureza === "Credito" || p.tipo === "Receita";
    return p.natureza === "Debito"  || p.tipo === "Despesa" || p.tipo === "Custo";
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const valor = parseFloat(form.valor);
    if (!form.descricao.trim()) return setError("Informe a descrição.");
    if (isNaN(valor) || valor <= 0) return setError("Valor inválido.");
    if (!form.proxima_data) return setError("Informe a próxima data.");

    setLoading(true);
    setError(null);
    try {
      const payload = {
        tipo:          form.tipo,
        descricao:     form.descricao.trim(),
        valor,
        periodicidade: form.periodicidade,
        proxima_data:  form.proxima_data,
        conta_id:      form.conta_id  || null,
        plano_id:      form.plano_id  || null,
        observacao:    form.observacao || null,
        ...(isEdit && { status: form.status }),
      };

      if (isEdit) {
        await onUpdate(recorrencia.id, payload);
      } else {
        await onCreate(payload);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const recTone = form.tipo === "Receita" ? "receita" : "despesa";

  return (
    <ModalShell
      onClose={onClose}
      title={isEdit ? "Editar recorrência" : "Nova recorrência"}
      subtitle={
        isEdit
          ? "Atualize valor, periodicidade e próxima data desta recorrência."
          : "Cadastre receitas ou despesas que se repetem automaticamente."
      }
      tone={recTone}
      size="lg"
      footer={
        <ModalFooter
          onClose={onClose}
          submitType="submit"
          formId="modal-rec-form"
          loading={loading}
          saveLabel={isEdit ? "Salvar alterações" : "Criar recorrência"}
        />
      }
    >
      <form id="modal-rec-form" onSubmit={handleSubmit}>
        <ModalSection label="Tipo">
          <ModalField label="Receita ou despesa" required>
            <ModalTipoPills
              value={form.tipo}
              onChange={(v) => set("tipo", v)}
              options={REC_TIPO_OPTIONS}
              ariaLabel="Tipo da recorrência"
            />
          </ModalField>
        </ModalSection>

        <ModalSection label="Detalhes">
          <ModalField label="Descrição" required>
            <input
              className="form-input"
              type="text"
              placeholder={form.tipo === "Receita" ? "Ex: Salário, Aluguel recebido…" : "Ex: Aluguel, Internet…"}
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              required
              autoFocus
            />
          </ModalField>

          <ModalGrid cols={2}>
            <ModalField label="Valor (R$)" required>
              <input
                className="form-input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => set("valor", e.target.value)}
                required
              />
            </ModalField>
            <ModalField label="Periodicidade" required>
              <select
                className="form-select"
                value={form.periodicidade}
                onChange={(e) => set("periodicidade", e.target.value)}
              >
                <option value="mensal">Mensal</option>
                <option value="semanal">Semanal</option>
                <option value="anual">Anual</option>
              </select>
            </ModalField>
            <ModalField label="Próxima data" required>
              <input
                className="form-input"
                type="date"
                value={form.proxima_data}
                onChange={(e) => set("proxima_data", e.target.value)}
                required
              />
            </ModalField>
            <ModalField label="Conta">
              <select
                className="form-select"
                value={form.conta_id}
                onChange={(e) => set("conta_id", e.target.value)}
              >
                <option value="">— Nenhuma —</option>
                {contas.filter((c) => !c.inativo).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.apelido || c.nome}
                  </option>
                ))}
              </select>
            </ModalField>
            <ModalField label="Categoria">
              <select
                className="form-select"
                value={form.plano_id}
                onChange={(e) => set("plano_id", e.target.value)}
              >
                <option value="">— Nenhuma —</option>
                {categoriasFiltradas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.descricao}
                  </option>
                ))}
              </select>
            </ModalField>
            {isEdit && (
              <ModalField label="Status">
                <select
                  className="form-select"
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  <option value="ativa">Ativa</option>
                  <option value="pausada">Pausada</option>
                  <option value="encerrada">Encerrada</option>
                </select>
              </ModalField>
            )}
            <ModalField label="Observação" className="modal-field--full">
              <input
                className="form-input"
                type="text"
                placeholder="Opcional"
                value={form.observacao}
                onChange={(e) => set("observacao", e.target.value)}
              />
            </ModalField>
          </ModalGrid>
        </ModalSection>

        {error && <div className="modal-inline-error" role="alert">{error}</div>}
      </form>
    </ModalShell>
  );
}

// ─── Modal Gerar Lançamento ───────────────────────────────────────────────────

function ModalGerarLancamento({ recorrencia, onClose, onConfirm, contas, planoContas }) {
  const [valorLanc, setValorLanc] = useState(String(recorrencia.valor));
  const [contaId, setContaId]     = useState(recorrencia.conta_id || "");
  const [planoId, setPlanoId]     = useState(recorrencia.plano_id || "");
  const [obs, setObs]             = useState(recorrencia.descricao);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  // A data do lançamento = vencimento = proxima_data da recorrência (antes de avançar)
  const dataVenc = toDateKey(recorrencia.proxima_data) || hoje();

  const handleConfirm = async () => {
    const valor = parseFloat(valorLanc);
    if (isNaN(valor) || valor <= 0) return setError("Valor inválido.");

    setLoading(true);
    setError(null);
    try {
      await onConfirm({
        tipo:     recorrencia.tipo,
        data:     dataVenc,
        valor,
        contaId,
        planoId,
        historico: obs,
        recorrenciaId: recorrencia.id,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const categorias = planoContas.filter((p) => {
    if (recorrencia.tipo === "Receita") return p.natureza === "Credito" || p.tipo === "Receita";
    return p.natureza === "Debito" || p.tipo === "Despesa" || p.tipo === "Custo";
  });

  const gerarTone = recorrencia.tipo === "Receita" ? "receita" : "despesa";

  return (
    <ModalShell
      onClose={onClose}
      title="Gerar lançamento"
      subtitle="Confirme os dados antes de criar o lançamento a partir desta recorrência."
      tone={gerarTone}
      size="lg"
      footer={
        <ModalFooter
          onClose={onClose}
          onSave={handleConfirm}
          loading={loading}
          disabled={!contaId}
          saveLabel={loading ? "Gerando…" : "Confirmar lançamento"}
        />
      }
    >
      <div className="modal-rec-preview">
        <div className="modal-rec-preview-title">{recorrencia.descricao}</div>
        <div className="modal-rec-preview-meta">
          <span className={`badge ${recorrencia.tipo === "Receita" ? "badge-green" : "badge-red"}`}>
            {recorrencia.tipo}
          </span>
          <span>{PERIODO_LABEL[recorrencia.periodicidade]}</span>
          <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
            Vencimento: {fmtDate(dataVenc)}
          </span>
          <span>
            Próximo ciclo: {fmtDate(calcProximaDataLocal(recorrencia.periodicidade, dataVenc))}
          </span>
        </div>
      </div>

      <ModalSection label="Lançamento">
        <ModalGrid cols={1}>
          <ModalField label="Valor (R$)" required>
            <input
              className="form-input"
              type="number"
              min="0.01"
              step="0.01"
              value={valorLanc}
              onChange={(e) => setValorLanc(e.target.value)}
              required
            />
          </ModalField>
          <ModalField label="Conta" required>
            <select
              className="form-select"
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
              required
            >
              <option value="">— Selecione a conta —</option>
              {contas.filter((c) => !c.inativo).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.apelido || c.nome}
                </option>
              ))}
            </select>
          </ModalField>
          <ModalField label="Categoria">
            <select
              className="form-select"
              value={planoId}
              onChange={(e) => setPlanoId(e.target.value)}
            >
              <option value="">— Nenhuma —</option>
              {categorias.map((p) => (
                <option key={p.id} value={p.id}>{p.descricao}</option>
              ))}
            </select>
          </ModalField>
          <ModalField label="Histórico">
            <input
              className="form-input"
              type="text"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
          </ModalField>
        </ModalGrid>
      </ModalSection>

      {error && <div className="modal-inline-error" role="alert">{error}</div>}
    </ModalShell>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function RecorrenciasPage() {
  const {
    contas, planoContas, lancamentos,
    lancCrud, flushStateSave,
    empresa, viewOnly,
  } = useGestor();

  const { recorrencias, loading, error, load, create, update, remove, gerar } = useRecorrencias();

  const [showNova,    setShowNova]    = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);
  const [gerarTarget, setGerarTarget] = useState(null);
  const [filtroTipo,  setFiltroTipo]  = useState("Todos");
  const [filtroStatus,setFiltroStatus]= useState("ativa");
  const [localError,  setLocalError]  = useState(null);

  // Filtra lista
  const lista = recorrencias.filter((r) => {
    if (filtroTipo !== "Todos" && r.tipo !== filtroTipo) return false;
    if (filtroStatus !== "Todos" && r.status !== filtroStatus) return false;
    return true;
  });

  // Gerar lançamento: adiciona ao JSONB via lancCrud (caminho seguro e testado)
  const handleGerarConfirm = async ({ tipo, data, valor, contaId, planoId, historico, recorrenciaId }) => {
    const conta     = contas.find((c) => c.id === contaId);
    const plano     = planoContas.find((p) => p.id === planoId);

    const nums = lancamentos.map((l) => Number(l.codigo)).filter((n) => !isNaN(n));
    const nextCodigo = nums.length ? Math.max(...nums) + 1 : 1;

    // Converte tipo da recorrência ("Receita"/"Despesa") para tipo do lançamento ("Entrada"/"Saida")
    const tipoLanc = tipo === "Receita" ? "Entrada" : "Saida";

    const lancamento = {
      id:             generateId(),
      codigo:         nextCodigo,
      lote:           `REC-${recorrenciaId.slice(0, 6)}`,
      data,
      // vencimento = proxima_data da recorrência ANTES de avançar o ciclo
      vencimento:     toDateKey(gerarTarget.proxima_data) || data,
      tipo:           tipoLanc,
      historico,
      valor:          parseFloat(valor),
      contaEntradaId: tipoLanc === "Entrada" ? contaId : null,
      contaSaidaId:   tipoLanc === "Saida"   ? contaId : null,
      codigoDestino:  tipoLanc === "Entrada" ? (conta?.codigo ?? null) : null,
      codigoOrigem:   tipoLanc === "Saida"   ? (conta?.codigo ?? null) : null,
      planoId:        planoId || null,
      clienteId:      null,
      fornecedorId:   null,
      consiliado:     false,
      tipoOrigem:     "",
      tipoDestino:    "",
      recorrenciaId,          // campo opcional — retrocompatível
    };

    // 1. Adiciona lançamento ao JSONB (operação principal — não pode falhar silenciosamente)
    lancCrud.add(lancamento);

    // 3. Salva o estado JSONB imediatamente
    setTimeout(() => flushStateSave().catch(() => {}), 50);

    // 2. Avança proxima_data no backend (não-bloqueante: se falhar, lançamento já foi criado)
    gerar(gerarTarget.id).catch((err) => {
      console.warn("Não foi possível avançar proxima_data:", err.message);
    });
  };

  const handleToggleStatus = async (rec) => {
    const novoStatus = rec.status === "ativa" ? "pausada" : "ativa";
    try {
      await update(rec.id, { status: novoStatus });
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleDelete = async (rec) => {
    if (!confirm(`Excluir a recorrência "${rec.descricao}"?\nOs lançamentos já gerados não serão afetados.`)) return;
    try {
      await remove(rec.id);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  // Resumo (visual premium)
  const resumo = (() => {
    const ativas = recorrencias.filter((r) => r.status === "ativa");
    const totalMensalDespesas = ativas
      .filter((r) => r.tipo === "Despesa" && r.periodicidade === "mensal")
      .reduce((s, r) => addMoney(s, r.valor), 0);
    const totalMensalReceitas = ativas
      .filter((r) => r.tipo === "Receita" && r.periodicidade === "mensal")
      .reduce((s, r) => addMoney(s, r.valor), 0);
    const vencendo7 = ativas.filter((r) => {
      const d = diasAteVencimento(r.proxima_data);
      return !Number.isNaN(d) && d >= 0 && d <= 7;
    }).length;
    return {
      ativas: ativas.length,
      vencendo7,
      totalMensalDespesas,
      totalMensalReceitas,
    };
  })();

  return (
    <PfPageShell pageId="recorrencias">
      <div className="pp-page-header">
        <div className="pp-page-header-text">
          <span className="pp-page-title">Recorrências</span>
          <span className="pp-page-sub">
            Suas assinaturas, contas fixas e receitas recorrentes em um só lugar.
          </span>
        </div>
        {!viewOnly && (
          <div className="pp-page-actions">
            <button type="button" className="pp-btn-primary" onClick={() => setShowNova(true)}>
              <span aria-hidden>＋</span> Nova recorrência
            </button>
          </div>
        )}
      </div>

      {/* Resumo */}
      <div className="pp-summary-grid">
        <div className="pp-summary-card pp-summary-info">
          <SummaryIcon icon={Repeat} />
          <div className="pp-summary-label">Ativas</div>
          <div className="pp-summary-value">{resumo.ativas}</div>
          <div className="pp-summary-hint">recorrências em curso</div>
        </div>
        <div className="pp-summary-card pp-summary-out">
          <SummaryIcon icon={ArrowDownLeft} />
          <div className="pp-summary-label">Despesas mensais</div>
          <div className="pp-summary-value">{fmtBRL(resumo.totalMensalDespesas)}</div>
          <div className="pp-summary-hint">compromisso fixo / mês</div>
        </div>
        <div className="pp-summary-card pp-summary-in">
          <SummaryIcon icon={ArrowUpRight} />
          <div className="pp-summary-label">Receitas mensais</div>
          <div className="pp-summary-value">{fmtBRL(resumo.totalMensalReceitas)}</div>
          <div className="pp-summary-hint">entradas previstas / mês</div>
        </div>
        <div className="pp-summary-card pp-summary-warn">
          <SummaryIcon icon={Clock} />
          <div className="pp-summary-label">Vencendo em 7 dias</div>
          <div className="pp-summary-value">{resumo.vencendo7}</div>
          <div className="pp-summary-hint">precisam de atenção</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="pp-toolbar">
        <select
          className="pp-select"
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
        >
          <option value="Todos">Todos os status</option>
          <option value="ativa">Ativas</option>
          <option value="pausada">Pausadas</option>
          <option value="encerrada">Encerradas</option>
        </select>
        {["Todos", "Receita", "Despesa"].map((t) => (
          <button
            key={t}
            type="button"
            className={`pp-chip${filtroTipo === t ? " is-active" : ""}${t === "Receita" ? " pp-chip-in" : t === "Despesa" ? " pp-chip-out" : ""}`}
            onClick={() => setFiltroTipo(t)}
          >
            {t === "Todos" ? "Todas" : t === "Receita" ? "↑ Receitas" : "↓ Despesas"}
          </button>
        ))}
        <span className="pp-toolbar-spacer" />
      </div>

      {localError && (
        <div className="alert alert-warn" style={{ marginBottom: 12 }}>
          ⚠ {localError}
          <button
            type="button"
            onClick={() => setLocalError(null)}
            style={{ marginLeft: 10, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Conteúdo */}
      {loading ? (
        <div className="pp-card"><div className="pp-empty"><EmptyIcon icon={Loader2} /><div className="pp-empty-text">Carregando recorrências…</div></div></div>
      ) : error ? (
        <div className="pp-card"><div className="pp-empty"><EmptyIcon icon={AlertTriangle} /><div className="pp-empty-title">Não foi possível carregar</div><div className="pp-empty-text">{error}</div></div></div>
      ) : lista.length === 0 ? (
        <div className="pp-card">
          <div className="pp-empty">
            <EmptyIcon icon={Repeat} />
            <div className="pp-empty-title">
              {filtroTipo !== "Todos" || filtroStatus !== "ativa"
                ? "Nenhuma recorrência com este filtro"
                : "Sem recorrências cadastradas"}
            </div>
            <div className="pp-empty-text">
              Cadastre suas despesas e receitas fixas (aluguel, salário, assinaturas…) e
              receba alertas automáticos no dashboard quando estiverem prestes a vencer.
            </div>
            {!viewOnly && (
              <button type="button" className="pp-btn-primary" onClick={() => setShowNova(true)}>
                <span aria-hidden>＋</span> Nova recorrência
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="pp-card">
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th className="pp-th-num">Valor</th>
                  <th>Periodicidade</th>
                  <th>Próxima data</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => {
                  const tipoCls = r.tipo === "Receita" ? "in" : "out";
                  const proxCls = classProxima(r.proxima_data).replace("recorrencias-proxima-", "rec-prox-");
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong title={r.descricao} style={{ fontWeight: 600 }}>{r.descricao}</strong>
                        {r.observacao && (
                          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{r.observacao}</div>
                        )}
                      </td>
                      <td>
                        <span className={`rec-type-pill rec-type-${tipoCls}`}>
                          <span className="rec-type-icon" aria-hidden>
                            {r.tipo === "Receita"
                              ? <ArrowUpRight size={13} strokeWidth={2.25} />
                              : <ArrowDownLeft size={13} strokeWidth={2.25} />}
                          </span>
                          {r.tipo}
                        </span>
                      </td>
                      <td className={`pp-cell-value pp-cell-value-${tipoCls}`}>{fmtBRL(r.valor)}</td>
                      <td><span className="pp-badge pp-badge-violet">{PERIODO_LABEL[r.periodicidade]}</span></td>
                      <td><span className={`rec-prox ${proxCls}`}>{labelProxima(r.proxima_data)}</span></td>
                      <td>
                        {r.status === "ativa" ? (
                          <span className="pp-badge pp-badge-green">● Ativa</span>
                        ) : r.status === "pausada" ? (
                          <span className="pp-badge pp-badge-amber">⏸ Pausada</span>
                        ) : (
                          <span className="pp-badge pp-badge-muted">○ Encerrada</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="pp-row-actions">
                          {!viewOnly && r.status === "ativa" && (
                            <button
                              type="button"
                              className="pp-icon-btn pp-icon-btn-success"
                              title="Gerar lançamento agora"
                              onClick={() => setGerarTarget(r)}
                            >
                              <CircleCheck size={14} strokeWidth={2} aria-hidden />
                            </button>
                          )}
                          {!viewOnly && (
                            <>
                              <button type="button" className="pp-icon-btn" title="Editar" onClick={() => setEditTarget(r)}>
                                <PenLine size={14} strokeWidth={2} aria-hidden />
                              </button>
                              {r.status !== "encerrada" && (
                                <button
                                  type="button"
                                  className="pp-icon-btn"
                                  title={r.status === "ativa" ? "Pausar" : "Reativar"}
                                  onClick={() => handleToggleStatus(r)}
                                >
                                  {r.status === "ativa"
                                    ? <Pause size={14} strokeWidth={2} aria-hidden />
                                    : <Play size={14} strokeWidth={2} aria-hidden />}
                                </button>
                              )}
                              <button
                                type="button"
                                className="pp-icon-btn pp-icon-btn-danger"
                                title="Excluir"
                                onClick={() => handleDelete(r)}
                              >
                                <Trash2 size={14} strokeWidth={2} aria-hidden />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* Modal: nova / editar recorrência */}
      {(showNova || editTarget) && (
        <ModalRecorrencia
          recorrencia={editTarget || null}
          contas={contas}
          planoContas={planoContas}
          onClose={() => { setShowNova(false); setEditTarget(null); }}
          onCreate={create}
          onUpdate={update}
        />
      )}

      {/* Modal: gerar lançamento */}
      {gerarTarget && (
        <ModalGerarLancamento
          recorrencia={gerarTarget}
          contas={contas}
          planoContas={planoContas}
          onClose={() => setGerarTarget(null)}
          onConfirm={handleGerarConfirm}
        />
      )}
    </PfPageShell>

  );
}
