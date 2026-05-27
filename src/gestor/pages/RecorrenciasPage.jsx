/**
 * RecorrenciasPage — Despesas e Receitas Recorrentes
 *
 * Funciona para PF e PJ (lê contas e planoContas do GestorContext).
 * Em modo viewOnly (admin impersonation): leitura apenas, sem criar/editar/excluir.
 */
import { useState } from "react";
import { useGestor } from "../GestorContext.jsx";
import { useRecorrencias } from "../hooks/useRecorrencias.js";
import { fmtBRL, fmtDate, generateId, toDateKey } from "../finance.js";
import { PenLine, Trash2, Pause, Play, CircleCheck } from "../components/icons.jsx";
import PfPageShell from "../components/pf/PfPageShell.jsx";

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

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <span className="modal-title">
            {isEdit ? "✏ Editar Recorrência" : "↺ Nova Recorrência"}
          </span>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Tipo */}
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <div className="rec-tipo-row">
              {["Receita", "Despesa"].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`rec-tipo-btn ${t.toLowerCase()}${form.tipo === t ? " active" : ""}`}
                  onClick={() => set("tipo", t)}
                >
                  <span style={{ fontSize: 18 }}>{t === "Receita" ? "↑" : "↓"}</span>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Descrição */}
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Descrição *</label>
              <input
                className="form-input"
                type="text"
                placeholder={form.tipo === "Receita" ? "Ex: Salário, Aluguel recebido…" : "Ex: Aluguel, Internet…"}
                value={form.descricao}
                onChange={(e) => set("descricao", e.target.value)}
                required autoFocus
              />
            </div>

            {/* Valor */}
            <div className="form-group">
              <label className="form-label">Valor (R$) *</label>
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
            </div>

            {/* Periodicidade */}
            <div className="form-group">
              <label className="form-label">Periodicidade *</label>
              <select
                className="form-select"
                value={form.periodicidade}
                onChange={(e) => set("periodicidade", e.target.value)}
              >
                <option value="mensal">Mensal</option>
                <option value="semanal">Semanal</option>
                <option value="anual">Anual</option>
              </select>
            </div>

            {/* Próxima data */}
            <div className="form-group">
              <label className="form-label">Próxima data *</label>
              <input
                className="form-input"
                type="date"
                value={form.proxima_data}
                onChange={(e) => set("proxima_data", e.target.value)}
                required
              />
            </div>

            {/* Conta */}
            <div className="form-group">
              <label className="form-label">Conta</label>
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
            </div>

            {/* Categoria */}
            <div className="form-group">
              <label className="form-label">Categoria</label>
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
            </div>

            {/* Status (só em edição) */}
            {isEdit && (
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  <option value="ativa">Ativa</option>
                  <option value="pausada">Pausada</option>
                  <option value="encerrada">Encerrada</option>
                </select>
              </div>
            )}

            {/* Observação */}
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Observação</label>
              <input
                className="form-input"
                type="text"
                placeholder="Opcional"
                value={form.observacao}
                onChange={(e) => set("observacao", e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="alert alert-warn" style={{ marginTop: 10 }}>⚠ {error}</div>
          )}

          <div className="modal-footer" style={{ margin: "16px -1.25rem -1.25rem", borderRadius: 0 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "Salvando…" : isEdit ? "Salvar alterações" : "↺ Criar recorrência"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Gerar Lançamento ───────────────────────────────────────────────────

function ModalGerarLancamento({ recorrencia, onClose, onConfirm, contas, planoContas }) {
  const [dataLanc, setDataLanc]   = useState(hoje());
  const [valorLanc, setValorLanc] = useState(String(recorrencia.valor));
  const [contaId, setContaId]     = useState(recorrencia.conta_id || "");
  const [planoId, setPlanoId]     = useState(recorrencia.plano_id || "");
  const [obs, setObs]             = useState(recorrencia.descricao);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  const handleConfirm = async () => {
    const valor = parseFloat(valorLanc);
    if (isNaN(valor) || valor <= 0) return setError("Valor inválido.");
    if (!dataLanc) return setError("Informe a data.");

    setLoading(true);
    setError(null);
    try {
      await onConfirm({
        tipo:     recorrencia.tipo,
        data:     dataLanc,
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

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <span className="modal-title">✔ Gerar Lançamento</span>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Preview da recorrência */}
          <div style={{
            background: "var(--surface-2)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{recorrencia.descricao}</div>
            <div style={{ color: "var(--muted-foreground)", display: "flex", gap: 12 }}>
              <span className={`badge ${recorrencia.tipo === "Receita" ? "badge-green" : "badge-red"}`}>
                {recorrencia.tipo}
              </span>
              <span>{PERIODO_LABEL[recorrencia.periodicidade]}</span>
              <span>Próximo ciclo: {fmtDate(calcProximaDataLocal(recorrencia.periodicidade, toDateKey(recorrencia.proxima_data) || recorrencia.proxima_data))}</span>
            </div>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Data do pagamento *</label>
              <input
                className="form-input"
                type="date"
                value={dataLanc}
                onChange={(e) => setDataLanc(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Vencimento</label>
              <input
                className="form-input"
                type="text"
                value={fmtDate(toDateKey(recorrencia.proxima_data) || recorrencia.proxima_data)}
                readOnly
                style={{ background: "var(--surface-2)", color: "var(--muted-foreground)", cursor: "default" }}
                title="Data de vencimento desta competência"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Valor (R$) *</label>
              <input
                className="form-input"
                type="number"
                min="0.01"
                step="0.01"
                value={valorLanc}
                onChange={(e) => setValorLanc(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Conta *</label>
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
            </div>

            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Categoria</label>
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
            </div>

            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Histórico</label>
              <input
                className="form-input"
                type="text"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="alert alert-warn" style={{ marginTop: 10 }}>⚠ {error}</div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={loading || !contaId}
          >
            {loading ? "Gerando…" : "✔ Confirmar lançamento"}
          </button>
        </div>
      </div>
    </div>
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

  return (
    <PfPageShell pageId="recorrencias">
    <div>
      {/* Toolbar */}
      <div className="toolbar">
        <h2 style={{ fontWeight: 700, fontSize: 16 }}>↺ Recorrências</h2>
        <div className="toolbar-right">
          {/* Filtro status */}
          <select
            className="form-select"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            style={{ width: "auto" }}
          >
            <option value="Todos">Todos os status</option>
            <option value="ativa">Ativas</option>
            <option value="pausada">Pausadas</option>
            <option value="encerrada">Encerradas</option>
          </select>
          {/* Filtro tipo */}
          <select
            className="form-select"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            style={{ width: "auto" }}
          >
            <option value="Todos">Receitas + Despesas</option>
            <option value="Receita">Só Receitas</option>
            <option value="Despesa">Só Despesas</option>
          </select>
          {!viewOnly && (
            <button className="btn btn-primary" onClick={() => setShowNova(true)}>
              + Nova Recorrência
            </button>
          )}
        </div>
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
        <div className="empty-state">Carregando…</div>
      ) : error ? (
        <div className="empty-state" style={{ color: "var(--danger-fg)" }}>⚠ {error}</div>
      ) : lista.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 40, marginBottom: 12 }}>↺</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>
            {filtroTipo !== "Todos" || filtroStatus !== "Todos"
              ? "Nenhuma recorrência com este filtro"
              : "Nenhuma recorrência cadastrada"}
          </div>
          {!viewOnly && filtroTipo === "Todos" && filtroStatus === "ativa" && (
            <div style={{ fontSize: 13, marginTop: 6, color: "var(--muted-foreground)" }}>
              Cadastre despesas e receitas fixas para receber alertas no dashboard
            </div>
          )}
        </div>
      ) : (
        <div className="table-wrap recorrencias-table">
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Periodicidade</th>
                <th>Próxima data</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id}>
                  {/* Descrição */}
                  <td className="td-ellipsis" style={{ maxWidth: 200 }}>
                    <strong title={r.descricao}>{r.descricao}</strong>
                    {r.observacao && (
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                        {r.observacao}
                      </div>
                    )}
                  </td>

                  {/* Tipo */}
                  <td>
                    <span className={`badge ${r.tipo === "Receita" ? "badge-green" : "badge-red"}`}>
                      {r.tipo === "Receita" ? "↑" : "↓"} {r.tipo}
                    </span>
                  </td>

                  {/* Valor */}
                  <td className="td-mono">{fmtBRL(r.valor)}</td>

                  {/* Periodicidade */}
                  <td>
                    <span className="badge badge-period">{PERIODO_LABEL[r.periodicidade]}</span>
                  </td>

                  {/* Próxima data */}
                  <td className={`td-mono td-compact ${classProxima(r.proxima_data)}`}>
                    {labelProxima(r.proxima_data)}
                  </td>

                  {/* Status */}
                  <td>
                    {r.status === "ativa" ? (
                      <span className="badge badge-green">● Ativa</span>
                    ) : r.status === "pausada" ? (
                      <span className="badge badge-pausada">⏸ Pausada</span>
                    ) : (
                      <span className="badge badge-encerrada">○ Encerrada</span>
                    )}
                  </td>

                  {/* Ações */}
                  <td className="table-actions-cell">
                    <div className="rec-actions table-actions-inline">
                      {!viewOnly && r.status === "ativa" && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary rec-btn-gerar"
                          title="Gerar lançamento agora"
                          onClick={() => setGerarTarget(r)}
                        >
                          <CircleCheck size={14} strokeWidth={2} aria-hidden />
                          <span>Gerar</span>
                        </button>
                      )}
                      {!viewOnly && (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary btn-icon"
                            title="Editar recorrência"
                            onClick={() => setEditTarget(r)}
                          >
                            <PenLine size={14} strokeWidth={2} aria-hidden />
                          </button>
                          {r.status !== "encerrada" && (
                            <button
                              type="button"
                              className={`btn btn-sm btn-icon ${r.status === "ativa" ? "btn-secondary" : "btn-primary"}`}
                              title={r.status === "ativa" ? "Pausar recorrência" : "Reativar recorrência"}
                              onClick={() => handleToggleStatus(r)}
                            >
                              {r.status === "ativa" ? (
                                <Pause size={14} strokeWidth={2} aria-hidden />
                              ) : (
                                <Play size={14} strokeWidth={2} aria-hidden />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-danger btn-icon"
                            title="Excluir recorrência"
                            onClick={() => handleDelete(r)}
                          >
                            <Trash2 size={14} strokeWidth={2} aria-hidden />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </div>
    </PfPageShell>
  );
}
