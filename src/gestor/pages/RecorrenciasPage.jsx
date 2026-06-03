/**
 * RecorrenciasPage — Despesas e Receitas Recorrentes
 *
 * Funciona para PF e PJ (lê contas e planoContas do GestorContext).
 * Em modo viewOnly (admin impersonation): leitura apenas, sem criar/editar/excluir.
 */
import { useState, useMemo } from "react";
import { useGestor } from "../GestorContext.jsx";
import { useRecorrencias } from "../hooks/useRecorrencias.js";
import { addMoney, fmtBRL, fmtDate, generateId, toDateKey, safeNum } from "../finance.js";
import {
  buildLancamentoFromRecorrencia,
  classificarRecorrenciasParaMes,
  formatMesReferencia,
  getMesReferenciaAtual,
  getRecorrenciaLancamentoMesStatus,
  isRecorrenciaGeradaNoMes,
  monthKeyFromDate,
  resumoRecorrenciasMes,
  vencimentoNoMesReferencia,
  podeGerarRecorrenciaNoMes,
} from "../recorrenciasLancamentos.js";
import { PenLine, Trash2, Pause, Play, CircleCheck, Repeat, ArrowDownLeft, ArrowUpRight, Clock, AlertTriangle, Loader2, CalendarDays } from "../components/icons.jsx";
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
    const valor = safeNum(form.valor);
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

// ─── Modal Gerar vencimentos do mês ───────────────────────────────────────────

function ModalGerarMesVencimentos({
  monthKey,
  elegiveis,
  jaGeradas,
  semConta,
  foraDoMes,
  onClose,
  onConfirm,
  loading,
}) {
  const mesLabel = formatMesReferencia(monthKey);
  return (
    <ModalShell
      onClose={onClose}
      title="Gerar vencimentos do mês"
      subtitle={`Referência: ${mesLabel}. Lançamentos entram em A Pagar/Receber como pendentes.`}
      tone="violet"
      size="md"
      footer={
        <ModalFooter
          onClose={onClose}
          onSave={onConfirm}
          loading={loading}
          disabled={elegiveis.length === 0}
          saveLabel={
            loading
              ? "Gerando…"
              : elegiveis.length > 0
                ? `Gerar ${elegiveis.length} lançamento(s)`
                : "Nada a gerar"
          }
        />
      }
    >
      {elegiveis.length === 0 && (
        <ModalSection label="Nenhuma pendente">
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--text2)" }}>
            {jaGeradas.length > 0 ? (
              <>
                Todas as recorrências com conta já foram lançadas para <strong>{mesLabel}</strong>{" "}
                ({jaGeradas.length} em aberto ou quitadas). Para quitar, use{" "}
                <strong>A Pagar / A Receber</strong>. A próxima data só avança ao marcar como pago.
              </>
            ) : (
              <>
                Não há recorrências ativas elegíveis para <strong>{mesLabel}</strong>.
                Verifique o mês de referência nos filtros ou vincule uma conta às recorrências.
              </>
            )}
          </p>
        </ModalSection>
      )}
      <ModalSection label="Resumo">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
          <li><strong>{elegiveis.length}</strong> serão gerados (com conta vinculada)</li>
          <li><strong>{jaGeradas.length}</strong> já gerados neste mês — serão ignorados</li>
          {semConta.length > 0 && (
            <li style={{ color: "var(--warning)" }}>
              <strong>{semConta.length}</strong> sem conta — edite a recorrência antes de gerar
            </li>
          )}
          {foraDoMes?.length > 0 && (
            <li style={{ color: "var(--text3)" }}>
              <strong>{foraDoMes.length}</strong> com próxima data em outro mês — use o botão individual na linha
            </li>
          )}
        </ul>
      </ModalSection>
      {elegiveis.length > 0 && (
        <ModalSection label="A gerar">
          <div style={{ fontSize: 12, color: "var(--text2)", maxHeight: 120, overflowY: "auto" }}>
            {elegiveis.map((r) => (
              <div key={r.id}>• {r.descricao} — {fmtBRL(r.valor)}</div>
            ))}
          </div>
        </ModalSection>
      )}
      {jaGeradas.length > 0 && (
        <ModalSection label="Já gerados (não duplicar)">
          <div style={{ fontSize: 12, color: "var(--text3)", maxHeight: 80, overflowY: "auto" }}>
            {jaGeradas.map((r) => (
              <div key={r.id}>• {r.descricao}</div>
            ))}
          </div>
        </ModalSection>
      )}
    </ModalShell>
  );
}

// ─── Modal Gerar Lançamento ───────────────────────────────────────────────────

function ModalGerarLancamento({ recorrencia, mesReferencia, dataVenc, onClose, onConfirm, contas, planoContas, jaGeradaNoMes }) {
  const [valorLanc, setValorLanc] = useState(String(recorrencia.valor));
  const [contaId, setContaId]     = useState(recorrencia.conta_id || "");
  const [planoId, setPlanoId]     = useState(recorrencia.plano_id || "");
  const [obs, setObs]             = useState(recorrencia.descricao);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  const dataVencStr = toDateKey(dataVenc) || hoje();

  const handleConfirm = async () => {
    const valor = safeNum(valorLanc);
    if (isNaN(valor) || valor <= 0) return setError("Valor inválido.");
    if (jaGeradaNoMes) {
      return setError("Esta recorrência já foi gerada para o mês do vencimento. Não é possível duplicar.");
    }

    setLoading(true);
    setError(null);
    try {
      await onConfirm({
        tipo:     recorrencia.tipo,
        data:     dataVencStr,
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
      {jaGeradaNoMes && (
        <div className="modal-inline-error" role="alert">
          Já existe lançamento desta recorrência no mês {formatMesReferencia(mesReferencia)}.
        </div>
      )}

      <div className="modal-rec-preview">
        <div className="modal-rec-preview-title">{recorrencia.descricao}</div>
        <div className="modal-rec-preview-meta">
          <span className={`badge ${recorrencia.tipo === "Receita" ? "badge-green" : "badge-red"}`}>
            {recorrencia.tipo}
          </span>
          <span>{PERIODO_LABEL[recorrencia.periodicidade]}</span>
          <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
            Vencimento: {fmtDate(dataVencStr)}
          </span>
          <span>
            Após marcar pago: {fmtDate(calcProximaDataLocal(recorrencia.periodicidade, dataVencStr))}
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
    empresa, viewOnly, filterPeriodo,
  } = useGestor();

  const { recorrencias, loading, error, load, create, update, remove, gerar } = useRecorrencias();

  const [showNova,    setShowNova]    = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);
  const [gerarTarget, setGerarTarget] = useState(null);
  const [showGerarMes, setShowGerarMes] = useState(false);
  const [gerarMesLoading, setGerarMesLoading] = useState(false);
  const [filtroTipo,  setFiltroTipo]  = useState("Todos");
  const [filtroStatus,setFiltroStatus]= useState("ativa");
  const [filtroLancMes, setFiltroLancMes] = useState("todos");
  const [localError,  setLocalError]  = useState(null);
  const [localSuccess, setLocalSuccess] = useState(null);

  const mesReferencia = useMemo(
    () => getMesReferenciaAtual(filterPeriodo),
    [filterPeriodo]
  );

  const classificacaoMes = useMemo(
    () => classificarRecorrenciasParaMes(recorrencias, lancamentos, mesReferencia),
    [recorrencias, lancamentos, mesReferencia]
  );

  const resumoMes = useMemo(
    () => resumoRecorrenciasMes(recorrencias, lancamentos, mesReferencia),
    [recorrencias, lancamentos, mesReferencia]
  );

  const statusMesPorRec = useMemo(() => {
    const map = new Map();
    for (const r of recorrencias) {
      map.set(r.id, getRecorrenciaLancamentoMesStatus(r, lancamentos, mesReferencia));
    }
    return map;
  }, [recorrencias, lancamentos, mesReferencia]);

  // Filtra lista
  const lista = recorrencias.filter((r) => {
    if (filtroTipo !== "Todos" && r.tipo !== filtroTipo) return false;
    if (filtroStatus !== "Todos" && r.status !== filtroStatus) return false;
    if (filtroLancMes !== "todos" && r.status === "ativa") {
      const code = statusMesPorRec.get(r.id)?.code;
      if (filtroLancMes === "falta" && code !== "pendente_gerar") return false;
      if (filtroLancMes === "aberta" && code !== "gerada_aberta" && code !== "gerada_atrasada") return false;
      if (filtroLancMes === "paga" && code !== "gerada_paga") return false;
    }
    return true;
  });

  const criarLancamentoRecorrencia = (rec, opts = {}) => {
    const mesRef = opts.mesReferencia ?? monthKeyFromDate(rec.proxima_data);
    const baseLancs = opts.lancamentosBase ?? lancamentos;

    if (!podeGerarRecorrenciaNoMes(rec, baseLancs, mesRef)) {
      throw new Error(
        `"${rec.descricao}" não pode ser gerada em ${formatMesReferencia(mesRef)}.`
      );
    }

    const dataVenc =
      toDateKey(opts.vencimentoOverride) ||
      vencimentoNoMesReferencia(rec, mesRef);

    const lancamento = buildLancamentoFromRecorrencia({
      recorrencia: { ...rec, conta_id: opts.contaId ?? rec.conta_id, plano_id: opts.planoId ?? rec.plano_id },
      lancamentos: baseLancs,
      contas,
      generateId,
      historico: opts.historico,
      valorOverride: opts.valor,
      vencimentoOverride: dataVenc,
    });
    lancCrud.add(lancamento);
    return lancamento;
  };

  const handleGerarConfirm = async ({ valor, contaId, planoId, historico }) => {
    const rec = { ...gerarTarget, conta_id: contaId, plano_id: planoId };
    criarLancamentoRecorrencia(rec, {
      historico,
      valor: safeNum(valor),
      mesReferencia,
      vencimentoOverride: vencimentoNoMesReferencia(rec, mesReferencia),
    });
    setTimeout(() => flushStateSave().catch(() => {}), 50);
  };

  const handleGerarMesConfirm = async () => {
    const { elegiveis, jaGeradas, semConta } = classificacaoMes;
    if (!elegiveis.length) {
      setLocalError("Nenhuma recorrência elegível para gerar neste mês.");
      setShowGerarMes(false);
      return;
    }

    setGerarMesLoading(true);
    setLocalError(null);
    setLocalSuccess(null);
    const erros = [];
    let ok = 0;
    let acc = [...lancamentos];

    for (const rec of elegiveis) {
      try {
        if (isRecorrenciaGeradaNoMes(acc, rec.id, mesReferencia)) continue;
        const lanc = criarLancamentoRecorrencia(rec, {
          lancamentosBase: acc,
          mesReferencia,
          vencimentoOverride: vencimentoNoMesReferencia(rec, mesReferencia),
        });
        acc.push(lanc);
        ok += 1;
      } catch (err) {
        erros.push(`${rec.descricao}: ${err.message}`);
      }
    }

    setTimeout(() => flushStateSave().catch(() => {}), 50);
    setGerarMesLoading(false);
    setShowGerarMes(false);

    if (ok > 0 && !erros.length) {
      setLocalSuccess(
        `${ok} lançamento(s) gerado(s) para ${formatMesReferencia(mesReferencia)}.` +
        (jaGeradas.length ? ` ${jaGeradas.length} já existiam.` : "")
      );
    } else if (erros.length) {
      setLocalError(
        [ok > 0 ? `${ok} gerado(s).` : null, ...erros].filter(Boolean).join(" ")
      );
    } else {
      setLocalError("Nenhum lançamento foi gerado.");
    }
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

  const nElegiveis = classificacaoMes.elegiveis.length;

  return (
    <PfPageShell pageId="recorrencias">
      <div className="pp-page-header">
        <div className="pp-page-header-text">
          <span className="pp-page-title">Recorrências</span>
          <span className="pp-page-sub">
            Gere o vencimento do mês de referência; a próxima data só avança ao marcar como pago em A Pagar/Receber.
          </span>
        </div>
        {!viewOnly && (
          <div className="pp-page-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="pp-btn-secondary"
              title={
                nElegiveis > 0
                  ? `Gerar ${nElegiveis} lançamento(s) com vencimento em ${formatMesReferencia(mesReferencia)}`
                  : classificacaoMes.jaGeradas.length > 0
                    ? `Todas já lançadas em ${formatMesReferencia(mesReferencia)} — clique para ver o resumo`
                    : `Nenhuma recorrência elegível em ${formatMesReferencia(mesReferencia)}`
              }
              onClick={() => setShowGerarMes(true)}
            >
              <CalendarDays size={16} strokeWidth={2} aria-hidden style={{ marginRight: 6, verticalAlign: -2 }} />
              Gerar vencimentos do mês
              {nElegiveis > 0 && (
                <span className="pp-btn-badge" style={{ marginLeft: 8 }}>{nElegiveis}</span>
              )}
            </button>
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
        <span className="pp-toolbar-meta" style={{ fontSize: 12, color: "var(--text3)" }}>
          Mês ref.: {formatMesReferencia(mesReferencia)}
        </span>
      </div>

      <div className="rec-mes-resumo" role="status" aria-label={`Resumo ${formatMesReferencia(mesReferencia)}`}>
        <span className="rec-mes-resumo-label">No mês {formatMesReferencia(mesReferencia)}:</span>
        {resumoMes.faltaGerar > 0 && (
          <button
            type="button"
            className={`rec-mes-pill rec-mes-pill-amber${filtroLancMes === "falta" ? " is-active" : ""}`}
            onClick={() => setFiltroLancMes((f) => (f === "falta" ? "todos" : "falta"))}
          >
            {resumoMes.faltaGerar} falta gerar
          </button>
        )}
        {(resumoMes.emAberto + resumoMes.atrasadas) > 0 && (
          <button
            type="button"
            className={`rec-mes-pill rec-mes-pill-blue${filtroLancMes === "aberta" ? " is-active" : ""}`}
            onClick={() => setFiltroLancMes((f) => (f === "aberta" ? "todos" : "aberta"))}
          >
            {resumoMes.emAberto + resumoMes.atrasadas} lançada(s) em aberto
          </button>
        )}
        {resumoMes.pagas > 0 && (
          <button
            type="button"
            className={`rec-mes-pill rec-mes-pill-green${filtroLancMes === "paga" ? " is-active" : ""}`}
            onClick={() => setFiltroLancMes((f) => (f === "paga" ? "todos" : "paga"))}
          >
            {resumoMes.pagas} lançada(s) · paga(s)
          </button>
        )}
        {resumoMes.foraMes > 0 && (
          <span className="rec-mes-pill rec-mes-pill-muted">
            {resumoMes.foraMes} vence(m) em outro mês
          </span>
        )}
        {resumoMes.faltaGerar === 0 && resumoMes.emAberto === 0 && resumoMes.atrasadas === 0 && resumoMes.pagas === 0 && resumoMes.foraMes === 0 && (
          <span className="rec-mes-pill rec-mes-pill-muted">Nenhuma ativa neste mês</span>
        )}
        {filtroLancMes !== "todos" && (
          <button type="button" className="rec-mes-clear" onClick={() => setFiltroLancMes("todos")}>
            Limpar filtro
          </button>
        )}
      </div>

      {localSuccess && (
        <div className="alert alert-success" style={{ marginBottom: 12 }}>
          ✓ {localSuccess}
          <button
            type="button"
            onClick={() => setLocalSuccess(null)}
            style={{ marginLeft: 10, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

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
                  <th>No mês ref.</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => {
                  const tipoCls = r.tipo === "Receita" ? "in" : "out";
                  const proxCls = classProxima(r.proxima_data).replace("recorrencias-proxima-", "rec-prox-");
                  const mesStatus = statusMesPorRec.get(r.id) || getRecorrenciaLancamentoMesStatus(r, lancamentos, mesReferencia);
                  const badgeCls = `pp-badge pp-badge-${mesStatus.badge || "muted"}`;
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
                      <td>
                        <span className={`rec-prox ${proxCls}`}>{labelProxima(r.proxima_data)}</span>
                      </td>
                      <td>
                        <span className={badgeCls} title={mesStatus.hint || mesStatus.label}>
                          {mesStatus.label}
                        </span>
                        {mesStatus.hint && !mesStatus.lancamento && (
                          <div className="rec-mes-lanc-meta">{mesStatus.hint}</div>
                        )}
                        {mesStatus.lancamento && (
                          <div className="rec-mes-lanc-meta">
                            Venc. {fmtDate(mesStatus.lancamento.vencimento ?? mesStatus.lancamento.data)}
                            {mesStatus.lancamento.codigo != null && (
                              <> · Cód. {mesStatus.lancamento.codigo}</>
                            )}
                          </div>
                        )}
                      </td>
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
                              title={
                                mesStatus.jaGerada
                                  ? "Já lançada neste mês — use A Pagar/Receber para quitar"
                                  : mesStatus.code === "fora_mes"
                                    ? "Próxima data em outro mês — ajuste o mês ref. nos filtros ou gere individualmente"
                                    : "Gerar lançamento agora"
                              }
                              disabled={!mesStatus.canGerar}
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
      {showGerarMes && (
        <ModalGerarMesVencimentos
          monthKey={mesReferencia}
          elegiveis={classificacaoMes.elegiveis}
          jaGeradas={classificacaoMes.jaGeradas}
          semConta={classificacaoMes.semConta}
          foraDoMes={classificacaoMes.foraDoMes}
          onClose={() => setShowGerarMes(false)}
          onConfirm={handleGerarMesConfirm}
          loading={gerarMesLoading}
        />
      )}

      {gerarTarget && (
        <ModalGerarLancamento
          recorrencia={gerarTarget}
          mesReferencia={mesReferencia}
          dataVenc={vencimentoNoMesReferencia(gerarTarget, mesReferencia)}
          contas={contas}
          planoContas={planoContas}
          jaGeradaNoMes={isRecorrenciaGeradaNoMes(lancamentos, gerarTarget.id, mesReferencia)}
          onClose={() => setGerarTarget(null)}
          onConfirm={handleGerarConfirm}
        />
      )}
    </PfPageShell>

  );
}
