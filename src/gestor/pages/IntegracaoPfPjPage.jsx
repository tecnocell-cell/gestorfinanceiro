/**
 * IntegracaoPfPjPage — Vínculo + repasses PJ → PF vinculada (Etapas 5.0B–5.5)
 * Todas as operações financeiras são da PJ para a PF vinculada (não há PF → PJ no MVP).
 */
import { useState, useEffect, useCallback } from "react";
import { useGestor } from "../GestorContext.jsx";
import { isPessoaJuridica } from "../profileLabels.js";
import { integracaoPfPjApi } from "../api.js";
import { fmtBRL, fmtDate, fmtDateTime, reaisFromCentavos } from "../finance.js";
import { INTEGRACAO_TIPO_OPERACAO_LABELS } from "../integracaoPfPjLabels.js";
import {
  Link2, User, CheckCircle, Clock, XCircle, AlertCircle, Banknote, TrendingUp,
  CircleDollarSign, ArrowRight, ArrowDownRight, Lock, CalendarDays, PenLine, Trash2, Pause, Play,
} from "../components/icons.jsx";
import PlanLimitNotice from "../components/PlanLimitNotice.jsx";

const TAB_VINCULO = "vinculo";
const TABS_FINANCEIRAS = ["prolabore", "lucros", "salario", "transferencia", "agendamentos", "historico"];

const TABS = [
  { id: TAB_VINCULO, label: "Vínculo" },
  { id: "prolabore", label: "Pró-labore" },
  { id: "lucros", label: "Distribuição de Lucros" },
  { id: "salario", label: "Salário" },
  { id: "transferencia", label: "Transferência PJ → PF" },
  { id: "agendamentos", label: "Agendamentos" },
  { id: "historico", label: "Histórico" },
];

const TIPO_AGENDAMENTO_OPTIONS = Object.entries(INTEGRACAO_TIPO_OPERACAO_LABELS).map(
  ([value, label]) => ({ value, label })
);

const AGENDAMENTO_STATUS_LABEL = {
  ativa: "Ativo",
  pausada: "Pausado",
  encerrada: "Encerrado",
};

function mesAtualInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function labelMesRef(mes) {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return mes || "—";
  const [y, m] = mes.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(m) - 1]}/${y}`;
}

const TIPO_OP_LABEL = INTEGRACAO_TIPO_OPERACAO_LABELS;

const AVISO_CONFIRMACAO =
  "Esta ação criará uma saída na PJ e uma entrada na PF vinculada.";

function statusBadgeVinculo(status) {
  if (status === "ativo") return { label: "Ativo", cls: "badge-cp-pago", Icon: CheckCircle };
  if (status === "pendente") return { label: "Aguardando PF", cls: "badge-cp-pendente", Icon: Clock };
  return { label: status, cls: "badge-cp-atrasado", Icon: XCircle };
}

function statusBadgeOperacao(status) {
  if (status === "ok") return { label: "Confirmado", cls: "badge-cp-pago", Icon: CheckCircle };
  if (status === "rollback") return { label: "Desfeito", cls: "badge-cp-atrasado", Icon: XCircle };
  return { label: status, cls: "badge-cp-atrasado", Icon: XCircle };
}

function TabBar({ tab, setTab, vinculoAtivo, vinculoPendente }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
      {TABS.map((t) => {
        const financeira = TABS_FINANCEIRAS.includes(t.id);
        const disabled = financeira && !vinculoAtivo;
        let title = "";
        if (disabled && !vinculoPendente) title = "Vincule uma conta PF na aba Vínculo.";
        if (disabled && vinculoPendente) title = "Aguarde a PF aceitar o vínculo em Perfil.";
        return (
          <button
            key={t.id}
            type="button"
            className={`btn btn-sm ${tab === t.id ? "btn-primary" : "btn-secondary"}`}
            disabled={disabled}
            title={title}
            onClick={() => setTab(t.id)}
          >
            {disabled && <Lock size={12} strokeWidth={2} style={{ marginRight: 4, verticalAlign: -2 }} aria-hidden />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function AvisoVinculoInativo({ vinculo }) {
  if (vinculo?.status === "pendente") {
    return (
      <div className="alert alert-info" style={{ marginBottom: 16 }}>
        <strong>Vínculo aguardando aceite.</strong>{" "}
        A PF precisa aceitar o convite em <strong>Perfil</strong> antes de você lançar pró-labore,
        distribuição de lucros, salário ou transferência PJ → PF.
      </div>
    );
  }
  return (
    <div className="alert alert-warn" style={{ marginBottom: 16 }}>
      <strong>Vincule e aguarde aceite da PF antes de lançar.</strong>{" "}
      Informe o e-mail da conta PF na aba <strong>Vínculo</strong>. Todas as operações desta tela
      são repasses da <strong>PJ para a PF vinculada</strong> (saída na PJ + entrada na PF).
    </div>
  );
}

function OperacaoForm({
  description,
  vinculo,
  viewOnly,
  valor,
  setValor,
  data,
  setData,
  observacao,
  setObservacao,
  preview,
  clearPreview,
  previewLoading,
  confirmando,
  onPreview,
  onConfirm,
  previewBtnLabel,
  confirmBtnLabel,
}) {
  if (!vinculo) {
    return (
      <div className="alert alert-warn" style={{ margin: 0 }}>
        Vínculo PF <strong>ativo</strong> necessário. Conclua o aceite na aba Vínculo.
      </div>
    );
  }
  if (viewOnly) {
    return <div className="alert alert-info" style={{ margin: 0 }}>Modo visualização — lançamentos indisponíveis.</div>;
  }
  return (
    <>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55, margin: "0 0 12px" }}>
        {description}
      </p>
      <p style={{
        fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5, margin: "0 0 16px",
        padding: "10px 12px", background: "var(--rn-page-canvas)", borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
      }}>
        <ArrowDownRight size={14} strokeWidth={2} style={{ verticalAlign: -2, marginRight: 6 }} aria-hidden />
        Repasse <strong>PJ → PF</strong>: não há lançamento da PF para a PJ nesta integração.
      </p>
      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div className="form-group">
          <label className="form-label">Valor (R$) *</label>
          <input className="form-input" type="number" min="0.01" step="0.01" placeholder="5000.00"
            value={valor} onChange={(e) => { setValor(e.target.value); clearPreview(); }} />
        </div>
        <div className="form-group">
          <label className="form-label">Data *</label>
          <input className="form-input" type="date" value={data}
            onChange={(e) => { setData(e.target.value); clearPreview(); }} />
        </div>
        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
          <label className="form-label">Observação (opcional)</label>
          <input className="form-input" type="text" placeholder="Ex: exercício 2025"
            value={observacao} onChange={(e) => { setObservacao(e.target.value); clearPreview(); }} />
        </div>
      </div>
      <div style={{ marginBottom: preview ? 16 : 0 }}>
        <button type="button" className="btn btn-secondary"
          disabled={previewLoading || !valor || !data}
          onClick={onPreview}>
          {previewLoading ? "Gerando..." : previewBtnLabel}
        </button>
      </div>
      {preview && (
        <div style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "16px",
          background: "var(--card)",
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            Revise os lançamentos antes de confirmar
          </div>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 12px", lineHeight: 1.5 }}>
            Serão criados <strong>dois lançamentos vinculados</strong>: um na PJ e outro na PF.
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            <PreviewLancamento titulo="Saída na PJ" lado="Saída" lanc={preview.lancamentoPj} />
            <PreviewLancamento titulo="Entrada na PF vinculada" lado="Entrada" lanc={preview.lancamentoPf} />
          </div>
          <div className="alert alert-info" style={{ marginTop: 16, marginBottom: 12, fontSize: 13 }}>
            {AVISO_CONFIRMACAO}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%", fontWeight: 700 }}
            disabled={confirmando}
            onClick={onConfirm}
          >
            {confirmando ? "Confirmando..." : confirmBtnLabel}
          </button>
        </div>
      )}
    </>
  );
}

function PreviewLancamento({ titulo, lado, lanc }) {
  if (!lanc) return null;
  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
      padding: "12px 14px", background: "var(--rn-page-canvas)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 8 }}>
        {titulo} ({lado})
      </div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{lanc.historico}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginTop: 10, fontSize: 12 }}>
        <div>
          <span style={{ color: "var(--muted-foreground)" }}>Tipo</span>
          <div style={{ color: lanc.tipo === "Entrada" ? "var(--success-fg)" : "var(--danger-fg)", fontWeight: 600 }}>
            {lanc.tipo}
          </div>
        </div>
        <div>
          <span style={{ color: "var(--muted-foreground)" }}>Valor</span>
          <div className="td-mono" style={{ fontWeight: 600 }}>{fmtBRL(lanc.valor)}</div>
        </div>
        <div>
          <span style={{ color: "var(--muted-foreground)" }}>Data</span>
          <div>{fmtDate(lanc.data)}</div>
        </div>
        <div>
          <span style={{ color: "var(--muted-foreground)" }}>Conta</span>
          <div>{lanc.conta}</div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <span style={{ color: "var(--muted-foreground)" }}>Categoria / Plano</span>
          <div>{lanc.plano}</div>
        </div>
      </div>
    </div>
  );
}

const VAZIO_AGENDAMENTO = {
  tipoOperacao: "pro_labore",
  valor: "",
  diaMes: "5",
  observacao: "",
  status: "ativa",
};

function AgendamentosPanel({
  agendamentos,
  loading,
  viewOnly,
  mesGeracao,
  setMesGeracao,
  form,
  setForm,
  editId,
  setEditId,
  salvandoAg,
  gerandoMes,
  onRefresh,
  onSubmit,
  onCancelEdit,
  onEdit,
  onDelete,
  onToggleStatus,
  onGerarMes,
}) {
  const ativos = agendamentos.filter((a) => a.status === "ativa").length;

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55, margin: "0 0 16px" }}>
        Cadastre repasses <strong>recorrentes</strong> (dia do mês, valor e tipo). Nada é lançado automaticamente —
        use <strong>Gerar repasses do mês</strong> quando quiser criar as operações na PJ e na PF (com histórico e auditoria).
      </p>

      {!viewOnly && (
        <div className="card" style={{ marginBottom: 16, padding: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            {editId ? "Editar agendamento" : "Novo agendamento"}
          </div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
            <label style={{ fontSize: 12 }}>
              <span style={{ color: "var(--muted-foreground)" }}>Tipo</span>
              <select
                className="input"
                value={form.tipoOperacao}
                onChange={(e) => setForm((f) => ({ ...f, tipoOperacao: e.target.value }))}
              >
                {TIPO_AGENDAMENTO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              <span style={{ color: "var(--muted-foreground)" }}>Valor (R$)</span>
              <input
                className="input"
                type="text"
                inputMode="decimal"
                value={form.valor}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                placeholder="0,00"
              />
            </label>
            <label style={{ fontSize: 12 }}>
              <span style={{ color: "var(--muted-foreground)" }}>Dia do mês</span>
              <input
                className="input"
                type="number"
                min={1}
                max={31}
                value={form.diaMes}
                onChange={(e) => setForm((f) => ({ ...f, diaMes: e.target.value }))}
              />
            </label>
            {editId && (
              <label style={{ fontSize: 12 }}>
                <span style={{ color: "var(--muted-foreground)" }}>Status</span>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="ativa">Ativo</option>
                  <option value="pausada">Pausado</option>
                  <option value="encerrada">Encerrado</option>
                </select>
              </label>
            )}
            <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>
              <span style={{ color: "var(--muted-foreground)" }}>Observação (opcional)</span>
              <input
                className="input"
                value={form.observacao}
                onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
                placeholder="Ex.: repasse mensal sócio"
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={salvandoAg} onClick={onSubmit}>
              {salvandoAg ? "Salvando..." : editId ? "Salvar alterações" : "Cadastrar"}
            </button>
            {editId && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onCancelEdit}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {!viewOnly && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            padding: 14,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "flex-end",
          }}
        >
          <label style={{ fontSize: 12 }}>
            <span style={{ color: "var(--muted-foreground)" }}>Mês de referência</span>
            <input
              className="input"
              type="month"
              value={mesGeracao}
              onChange={(e) => setMesGeracao(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={gerandoMes || !agendamentos.length}
            onClick={onGerarMes}
          >
            {gerandoMes ? "Gerando..." : "Gerar repasses do mês"}
          </button>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {ativos} agendamento(s) ativo(s) · ignora os já gerados em {labelMesRef(mesGeracao)}
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 12, color: "var(--muted-foreground)", fontSize: 13 }}>Carregando agendamentos...</div>
      ) : !agendamentos.length ? (
        <div style={{ padding: 12, color: "var(--muted-foreground)", fontSize: 13 }}>
          Nenhum agendamento. Cadastre pró-labore, lucros, salário ou transferência com dia fixo do mês.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th style={{ textAlign: "right" }}>Valor</th>
                <th>Dia</th>
                <th>Status</th>
                <th>Último mês gerado</th>
                <th>Observação</th>
                {!viewOnly && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {agendamentos.map((ag) => {
                const tipoLabel = TIPO_OP_LABEL[ag.tipoOperacao] || ag.tipoOperacao;
                const valorExibir =
                  ag.valor != null ? ag.valor : reaisFromCentavos(ag.valorCentavos);
                return (
                  <tr key={ag.id}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{tipoLabel}</td>
                    <td className="td-mono" style={{ textAlign: "right", fontWeight: 600 }}>
                      {fmtBRL(valorExibir)}
                    </td>
                    <td className="td-mono" style={{ fontSize: 12 }}>dia {ag.diaMes}</td>
                    <td style={{ fontSize: 12 }}>{AGENDAMENTO_STATUS_LABEL[ag.status] || ag.status}</td>
                    <td style={{ fontSize: 12 }}>{ag.ultimoGeradoMes ? labelMesRef(ag.ultimoGeradoMes) : "—"}</td>
                    <td style={{ fontSize: 12, maxWidth: 200 }} title={ag.observacao}>
                      {ag.observacao || "—"}
                    </td>
                    {!viewOnly && (
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Editar"
                            onClick={() => onEdit(ag)}
                          >
                            <PenLine size={12} strokeWidth={2} aria-hidden />
                          </button>
                          {ag.status === "ativa" ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              title="Pausar"
                              onClick={() => onToggleStatus(ag, "pausada")}
                            >
                              <Pause size={12} strokeWidth={2} aria-hidden />
                            </button>
                          ) : ag.status === "pausada" ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              title="Reativar"
                              onClick={() => onToggleStatus(ag, "ativa")}
                            >
                              <Play size={12} strokeWidth={2} aria-hidden />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Excluir"
                            onClick={() => onDelete(ag)}
                          >
                            <Trash2 size={12} strokeWidth={2} aria-hidden />
                          </button>
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

      <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={onRefresh}>
        Atualizar lista
      </button>
    </div>
  );
}

function HistoricoOperacoes({ operacoes, loading, viewOnly, desfazendoId, reparandoId, onRollback, onRepair }) {
  if (loading) {
    return (
      <div style={{ padding: 12, color: "var(--muted-foreground)", fontSize: 13 }}>Carregando histórico...</div>
    );
  }
  if (!operacoes.length) {
    return (
      <div style={{ padding: 12, color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.55 }}>
        Nenhuma operação registrada. Após confirmar um repasse PJ → PF, ele aparecerá aqui com os dois lançamentos.
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Operação</th>
            <th style={{ textAlign: "right" }}>Valor</th>
            <th>Criado em</th>
            <th>Desfeito em</th>
            <th>Status</th>
            <th>Lançamentos</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {operacoes.map((op) => {
            const b = statusBadgeOperacao(op.status);
            const tipoLabel = TIPO_OP_LABEL[op.tipoOperacao] || op.tipoOperacao;
            const valorExibir =
              op.valor != null && Number.isFinite(op.valor)
                ? op.valor
                : reaisFromCentavos(op.valorCentavos);
            return (
              <tr key={op.id}>
                <td className="td-mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(op.data)}</td>
                <td style={{ fontSize: 13, fontWeight: 600 }}>{tipoLabel}</td>
                <td className="td-mono" style={{ textAlign: "right", fontWeight: 600 }}>{fmtBRL(valorExibir)}</td>
                <td className="lanc-cell-quiet" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  {op.criadoEm ? fmtDateTime(op.criadoEm) : "—"}
                </td>
                <td className="lanc-cell-quiet" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  {op.desfeitoEm ? fmtDateTime(op.desfeitoEm) : "—"}
                </td>
                <td>
                  <span className={`badge ${b.cls}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <b.Icon size={12} strokeWidth={2} aria-hidden />
                    {b.label}
                  </span>
                  {op.divergente && op.status === "ok" && (
                    <span className="badge badge-cp-atrasado" style={{ display: "inline-flex", marginLeft: 6, fontSize: 10 }}>
                      Divergente
                    </span>
                  )}
                </td>
                <td className="integracao-hist-lanc" style={{ fontSize: 12, lineHeight: 1.5, verticalAlign: "top" }}>
                  <span className="badge badge-cp-pendente" style={{ marginBottom: 4, display: "inline-block" }}>
                    PJ + PF
                  </span>
                  <div style={{ color: "var(--muted-foreground)" }}>
                    Saída na PJ · Entrada na PF
                  </div>
                  {op.historico && (
                    <div className="integracao-hist-hist" style={{ color: "var(--text)" }} title={op.historico}>
                      {op.historico}
                    </div>
                  )}
                </td>
                <td>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {!viewOnly && op.status === "ok" && op.divergente && (
                      <button type="button" className="btn btn-secondary btn-sm"
                        disabled={reparandoId === op.id}
                        title="Corrige valores e recria lançamento ausente"
                        onClick={() => onRepair(op)}>
                        {reparandoId === op.id ? "Reparando..." : "Reparar"}
                      </button>
                    )}
                    {!viewOnly && op.status === "ok" && (
                      <button type="button" className="btn btn-secondary btn-sm"
                        disabled={desfazendoId === op.id}
                        title="Remove o lançamento na PJ e na PF"
                        onClick={() => onRollback(op)}>
                        {desfazendoId === op.id ? "Desfazendo..." : "Desfazer"}
                      </button>
                    )}
                    {op.status === "rollback" && (
                      <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Lançamentos removidos</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function IntegracaoPfPjPage() {
  const { viewOnly, reloadAppState, tipo } = useGestor();
  const contaPJ = isPessoaJuridica(tipo);
  const [tab, setTab] = useState(TAB_VINCULO);

  const [email, setEmail] = useState("");
  const [vinculo, setVinculo] = useState(null);
  const [pfPreview, setPfPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [msg, setMsg] = useState(null);

  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const [lucrosValor, setLucrosValor] = useState("");
  const [lucrosData, setLucrosData] = useState(new Date().toISOString().slice(0, 10));
  const [lucrosObs, setLucrosObs] = useState("");
  const [lucrosPreview, setLucrosPreview] = useState(null);
  const [lucrosPreviewLoading, setLucrosPreviewLoading] = useState(false);
  const [lucrosConfirmando, setLucrosConfirmando] = useState(false);

  const [salarioValor, setSalarioValor] = useState("");
  const [salarioData, setSalarioData] = useState(new Date().toISOString().slice(0, 10));
  const [salarioObs, setSalarioObs] = useState("");
  const [salarioPreview, setSalarioPreview] = useState(null);
  const [salarioPreviewLoading, setSalarioPreviewLoading] = useState(false);
  const [salarioConfirmando, setSalarioConfirmando] = useState(false);

  const [transfValor, setTransfValor] = useState("");
  const [transfData, setTransfData] = useState(new Date().toISOString().slice(0, 10));
  const [transfObs, setTransfObs] = useState("");
  const [transfPreview, setTransfPreview] = useState(null);
  const [transfPreviewLoading, setTransfPreviewLoading] = useState(false);
  const [transfConfirmando, setTransfConfirmando] = useState(false);

  const [operacoes, setOperacoes] = useState([]);
  const [loadingOps, setLoadingOps] = useState(false);
  const [desfazendoId, setDesfazendoId] = useState(null);
  const [reparandoId, setReparandoId] = useState(null);

  const [agendamentos, setAgendamentos] = useState([]);
  const [loadingAg, setLoadingAg] = useState(false);
  const [agForm, setAgForm] = useState({ ...VAZIO_AGENDAMENTO });
  const [agEditId, setAgEditId] = useState(null);
  const [salvandoAg, setSalvandoAg] = useState(false);
  const [gerandoMes, setGerandoMes] = useState(false);
  const [mesGeracao, setMesGeracao] = useState(mesAtualInput());

  const vinculoAtivo = vinculo?.status === "ativo";
  const vinculoPendente = vinculo?.status === "pendente";
  const temVinculo = vinculo && vinculo.status !== "revogado";
  const abaFinanceira = TABS_FINANCEIRAS.includes(tab);

  const loadVinculo = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const dataRes = await integracaoPfPjApi.getVinculo();
      setVinculo(dataRes.vinculo || null);
    } catch (err) {
      setErro(err.message || "Erro ao carregar vínculo.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOperacoes = useCallback(async () => {
    if (!vinculoAtivo) return;
    setLoadingOps(true);
    try {
      const res = await integracaoPfPjApi.listOperacoes();
      setOperacoes(res.operacoes || []);
    } catch (err) {
      setErro(err.message || "Erro ao carregar histórico.");
    } finally {
      setLoadingOps(false);
    }
  }, [vinculoAtivo]);

  const loadAgendamentos = useCallback(async () => {
    if (!vinculoAtivo) return;
    setLoadingAg(true);
    try {
      const res = await integracaoPfPjApi.listAgendamentos();
      setAgendamentos(res.agendamentos || []);
    } catch (err) {
      setErro(err.message || "Erro ao carregar agendamentos.");
    } finally {
      setLoadingAg(false);
    }
  }, [vinculoAtivo]);

  useEffect(() => { loadVinculo(); }, [loadVinculo]);
  useEffect(() => {
    if (tab === "historico" && vinculoAtivo) loadOperacoes();
  }, [tab, vinculoAtivo, loadOperacoes]);
  useEffect(() => {
    if (tab === "agendamentos" && vinculoAtivo) loadAgendamentos();
  }, [tab, vinculoAtivo, loadAgendamentos]);

  useEffect(() => {
    if (!vinculoAtivo && abaFinanceira && tab !== TAB_VINCULO) {
      setTab(TAB_VINCULO);
    }
  }, [vinculoAtivo, abaFinanceira, tab]);

  const handleBuscar = async () => {
    const e = email.trim();
    if (!e) { setErro("Informe o e-mail da conta PF."); return; }
    setBuscando(true);
    setErro(null);
    setPfPreview(null);
    try {
      const pf = await integracaoPfPjApi.buscarPf(e);
      setPfPreview(pf);
    } catch (err) {
      setErro(err.message || "Conta PF não encontrada.");
    } finally {
      setBuscando(false);
    }
  };

  const handleVincular = async () => {
    const e = email.trim();
    if (!e) return;
    setSalvando(true);
    setErro(null);
    setMsg(null);
    try {
      const { vinculo: v } = await integracaoPfPjApi.criarVinculo(e);
      setVinculo(v);
      setPfPreview(null);
      setMsg("Convite enviado. A pessoa física precisa aceitar em Perfil antes dos repasses PJ → PF.");
    } catch (err) {
      setErro(err.message || "Erro ao vincular.");
    } finally {
      setSalvando(false);
    }
  };

  const handleRevogar = async () => {
    if (!window.confirm("Revogar o vínculo com esta conta PF? Novos repasses PJ → PF ficarão bloqueados.")) return;
    setSalvando(true);
    setErro(null);
    setMsg(null);
    try {
      await integracaoPfPjApi.revogarVinculo();
      setVinculo(null);
      setPfPreview(null);
      setEmail("");
      setPreview(null);
      setTab(TAB_VINCULO);
      setMsg("Vínculo revogado.");
    } catch (err) {
      setErro(err.message || "Erro ao revogar.");
    } finally {
      setSalvando(false);
    }
  };

  const handlePreviewProLabore = async () => {
    setPreviewLoading(true);
    setErro(null);
    setPreview(null);
    try {
      const res = await integracaoPfPjApi.previewProLabore(valor, data, observacao);
      setPreview(res);
    } catch (err) {
      setErro(err.message || "Erro ao gerar preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreviewLucros = async () => {
    setLucrosPreviewLoading(true);
    setErro(null);
    setLucrosPreview(null);
    try {
      const res = await integracaoPfPjApi.previewLucros(lucrosValor, lucrosData, lucrosObs);
      setLucrosPreview(res);
    } catch (err) {
      setErro(err.message || "Erro ao gerar preview.");
    } finally {
      setLucrosPreviewLoading(false);
    }
  };

  const handleConfirmarLucros = async () => {
    setLucrosConfirmando(true);
    setErro(null);
    setMsg(null);
    try {
      await integracaoPfPjApi.confirmarLucros(lucrosValor, lucrosData, lucrosObs);
      setLucrosPreview(null);
      setLucrosValor("");
      setLucrosObs("");
      setMsg("Distribuição de Lucros registrada na PJ e na PF vinculada.");
      if (reloadAppState) reloadAppState({ skipFlush: true });
      setTab("historico");
      loadOperacoes();
    } catch (err) {
      setErro(err.message || "Erro ao confirmar Distribuição de Lucros.");
    } finally {
      setLucrosConfirmando(false);
    }
  };

  const handlePreviewSalario = async () => {
    setSalarioPreviewLoading(true);
    setErro(null);
    setSalarioPreview(null);
    try {
      const res = await integracaoPfPjApi.previewSalario(salarioValor, salarioData, salarioObs);
      setSalarioPreview(res);
    } catch (err) {
      setErro(err.message || "Erro ao gerar preview.");
    } finally {
      setSalarioPreviewLoading(false);
    }
  };

  const handleConfirmarSalario = async () => {
    setSalarioConfirmando(true);
    setErro(null);
    setMsg(null);
    try {
      await integracaoPfPjApi.confirmarSalario(salarioValor, salarioData, salarioObs);
      setSalarioPreview(null);
      setSalarioValor("");
      setSalarioObs("");
      setMsg("Salário registrado na PJ e na PF vinculada.");
      if (reloadAppState) reloadAppState({ skipFlush: true });
      setTab("historico");
      loadOperacoes();
    } catch (err) {
      setErro(err.message || "Erro ao confirmar Salário.");
    } finally {
      setSalarioConfirmando(false);
    }
  };

  const handlePreviewTransferencia = async () => {
    setTransfPreviewLoading(true);
    setErro(null);
    setTransfPreview(null);
    try {
      const res = await integracaoPfPjApi.previewTransferencia(transfValor, transfData, transfObs);
      setTransfPreview(res);
    } catch (err) {
      setErro(err.message || "Erro ao gerar preview.");
    } finally {
      setTransfPreviewLoading(false);
    }
  };

  const handleConfirmarTransferencia = async () => {
    setTransfConfirmando(true);
    setErro(null);
    setMsg(null);
    try {
      await integracaoPfPjApi.confirmarTransferencia(transfValor, transfData, transfObs);
      setTransfPreview(null);
      setTransfValor("");
      setTransfObs("");
      setMsg("Transferência PJ → PF registrada na PJ e na PF vinculada.");
      if (reloadAppState) reloadAppState({ skipFlush: true });
      setTab("historico");
      loadOperacoes();
    } catch (err) {
      setErro(err.message || "Erro ao confirmar Transferência PJ → PF.");
    } finally {
      setTransfConfirmando(false);
    }
  };

  const handleConfirmarProLabore = async () => {
    setConfirmando(true);
    setErro(null);
    setMsg(null);
    try {
      await integracaoPfPjApi.confirmarProLabore(valor, data, observacao);
      setPreview(null);
      setValor("");
      setObservacao("");
      setMsg("Pró-labore registrado na PJ e na PF vinculada.");
      if (reloadAppState) reloadAppState({ skipFlush: true });
      setTab("historico");
      loadOperacoes();
    } catch (err) {
      setErro(err.message || "Erro ao confirmar pró-labore.");
    } finally {
      setConfirmando(false);
    }
  };

  const handleRollback = async (op) => {
    const tipoOp = TIPO_OP_LABEL[op.tipoOperacao] || "operação";
    const valorFmt = fmtBRL(op.valor ?? reaisFromCentavos(op.valorCentavos));
    if (!window.confirm(
      `Desfazer ${tipoOp} de ${valorFmt}? Os lançamentos de saída na PJ e entrada na PF serão removidos.`
    )) return;
    setDesfazendoId(op.id);
    setErro(null);
    setMsg(null);
    try {
      const res = await integracaoPfPjApi.rollbackOperacao(op.id);
      const remPj = res?.removidosPj ?? 0;
      const remPf = res?.removidosPf ?? 0;
      setMsg(`Operação desfeita: ${remPj} lançamento(s) na PJ e ${remPf} na PF vinculada.`);
      if (reloadAppState) reloadAppState({ skipFlush: true });
      loadOperacoes();
    } catch (err) {
      setErro(err.message || "Erro ao desfazer.");
    } finally {
      setDesfazendoId(null);
    }
  };

  const handleRepair = async (op) => {
    const valorFmt = fmtBRL(op.valor ?? reaisFromCentavos(op.valorCentavos));
    if (!window.confirm(`Reparar vínculo da operação de ${valorFmt}? Valores serão alinhados e lançamentos ausentes recriados.`)) return;
    setReparandoId(op.id);
    setErro(null);
    setMsg(null);
    try {
      const res = await integracaoPfPjApi.repairOperacao(op.id);
      const parts = [];
      if (res.recreatedPj) parts.push("PJ recriada");
      if (res.recreatedPf) parts.push("PF recriada");
      if (res.fixedPj) parts.push(`${res.fixedPj} valor(es) PJ`);
      if (res.fixedPf) parts.push(`${res.fixedPf} valor(es) PF`);
      setMsg(parts.length ? `Reparo concluído: ${parts.join(", ")}.` : "Operação já estava consistente.");
      if (reloadAppState) reloadAppState({ skipFlush: true });
      loadOperacoes();
    } catch (err) {
      setErro(err.message || "Erro ao reparar.");
    } finally {
      setReparandoId(null);
    }
  };

  const resetAgForm = () => {
    setAgEditId(null);
    setAgForm({ ...VAZIO_AGENDAMENTO });
  };

  const handleSubmitAgendamento = async () => {
    setSalvandoAg(true);
    setErro(null);
    setMsg(null);
    try {
      const diaMes = Number(agForm.diaMes);
      if (!Number.isFinite(diaMes) || diaMes < 1 || diaMes > 31) {
        throw new Error("Dia do mês deve ser entre 1 e 31.");
      }
      if (agEditId) {
        await integracaoPfPjApi.updateAgendamento(agEditId, {
          tipoOperacao: agForm.tipoOperacao,
          valor: agForm.valor,
          diaMes,
          observacao: agForm.observacao,
          status: agForm.status,
        });
        setMsg("Agendamento atualizado.");
      } else {
        await integracaoPfPjApi.createAgendamento({
          tipoOperacao: agForm.tipoOperacao,
          valor: agForm.valor,
          diaMes,
          observacao: agForm.observacao,
        });
        setMsg("Agendamento cadastrado.");
      }
      resetAgForm();
      loadAgendamentos();
    } catch (err) {
      setErro(err.message || "Erro ao salvar agendamento.");
    } finally {
      setSalvandoAg(false);
    }
  };

  const handleEditAgendamento = (ag) => {
    setAgEditId(ag.id);
    setAgForm({
      tipoOperacao: ag.tipoOperacao,
      valor: String(ag.valor ?? reaisFromCentavos(ag.valorCentavos)),
      diaMes: String(ag.diaMes),
      observacao: ag.observacao || "",
      status: ag.status,
    });
  };

  const handleDeleteAgendamento = async (ag) => {
    const tipoOp = TIPO_OP_LABEL[ag.tipoOperacao] || "agendamento";
    if (!window.confirm(`Excluir agendamento de ${tipoOp} (dia ${ag.diaMes})?`)) return;
    setErro(null);
    try {
      await integracaoPfPjApi.deleteAgendamento(ag.id);
      if (agEditId === ag.id) resetAgForm();
      setMsg("Agendamento excluído.");
      loadAgendamentos();
    } catch (err) {
      setErro(err.message || "Erro ao excluir agendamento.");
    }
  };

  const handleToggleStatusAg = async (ag, status) => {
    setErro(null);
    try {
      await integracaoPfPjApi.updateAgendamento(ag.id, { status });
      loadAgendamentos();
    } catch (err) {
      setErro(err.message || "Erro ao alterar status.");
    }
  };

  const handleGerarRepassesMes = async () => {
    const ativos = agendamentos.filter((a) => a.status === "ativa").length;
    if (
      !window.confirm(
        `Gerar repasses de ${labelMesRef(mesGeracao)}?\n\n` +
          `Serão confirmadas as operações dos agendamentos ativos que ainda não foram gerados neste mês (${ativos} ativo(s)).`
      )
    ) {
      return;
    }
    setGerandoMes(true);
    setErro(null);
    setMsg(null);
    try {
      const res = await integracaoPfPjApi.gerarRepassesMes(mesGeracao);
      const n = res.totalGerados ?? res.gerados?.length ?? 0;
      const ign = res.totalIgnorados ?? res.ignorados?.length ?? 0;
      setMsg(
        `Repasses de ${labelMesRef(mesGeracao)}: ${n} gerado(s), ${ign} ignorado(s). ` +
          "Confira o histórico e os lançamentos na PJ e na PF."
      );
      if (reloadAppState) reloadAppState({ skipFlush: true });
      loadAgendamentos();
      loadOperacoes();
    } catch (err) {
      setErro(err.message || "Erro ao gerar repasses do mês.");
    } finally {
      setGerandoMes(false);
    }
  };

  const badge = vinculo ? statusBadgeVinculo(vinculo.status) : null;
  const pfNome = vinculo?.nomePf || vinculo?.emailPf || "PF vinculada";

  const descProLabore = (
    <>
      Pró-labore da PJ para <strong>{pfNome}</strong>: saída na empresa e entrada na conta PF vinculada.
    </>
  );
  const descLucros = (
    <>
      Distribuição de Lucros da PJ para <strong>{pfNome}</strong> (saída PJ + entrada PF).
    </>
  );
  const descSalario = (
    <>
      Salário pago pela PJ para <strong>{pfNome}</strong> (saída PJ + entrada PF).
    </>
  );
  const descTransf = (
    <>
      Transferência de recursos da PJ para <strong>{pfNome}</strong> (saída PJ + entrada PF).
    </>
  );

  return (
    <div className="of-page">
      <div className="of-hero">
        <div className="of-hero-inner">
          <div className="of-hero-badge">
            <Link2 size={13} strokeWidth={2} aria-hidden />
            Integração PF/PJ
          </div>
          <h2 className="of-hero-title">Repasses da PJ para a PF vinculada</h2>
          <p className="of-hero-sub">
            Vincule uma conta Pessoa Física e registre pró-labore, distribuição de lucros, salário
            ou transferência <strong>PJ → PF</strong>. Cada confirmação gera saída na PJ e entrada na PF
            automaticamente. Não há repasse da PF para a PJ nesta versão.
          </p>
        </div>
      </div>

      <div className="of-section">
        {contaPJ && <PlanLimitNotice feature="integracaoPfPj" />}
        {!contaPJ && (
          <div className="alert alert-warn" style={{ marginBottom: 16 }}>
            Esta área é exclusiva para contas Pessoa Jurídica.
          </div>
        )}

        <TabBar tab={tab} setTab={setTab} vinculoAtivo={vinculoAtivo} vinculoPendente={vinculoPendente} />

        {!vinculoAtivo && <AvisoVinculoInativo vinculo={vinculo} />}

        {tab === TAB_VINCULO && (
          <>
            {loading && (
              <div style={{ padding: 20, color: "var(--muted-foreground)", fontSize: 13 }}>Carregando...</div>
            )}

            {!loading && temVinculo && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <User size={18} strokeWidth={2} aria-hidden />
                  Vínculo com conta PF
                </div>
                <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
                  <div>
                    <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>Destino dos repasses (PF)</span>
                    <div style={{ fontWeight: 600 }}>{vinculo.nomePf || vinculo.emailPf}</div>
                    <div style={{ color: "var(--muted-foreground)", fontSize: 12 }}>{vinculo.emailPf}</div>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>Status</span>
                    <div style={{ marginTop: 4 }}>
                      {badge && (
                        <span className={`badge ${badge.cls}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <badge.Icon size={12} strokeWidth={2} aria-hidden />
                          {badge.label}
                        </span>
                      )}
                    </div>
                    {vinculo.status === "pendente" && (
                      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                        Aguardando aceite da PF em <strong>Perfil</strong>. Repasses PJ → PF ficam bloqueados até a confirmação.
                      </p>
                    )}
                    {vinculo.status === "ativo" && (
                      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                        Vínculo ativo. Use as abas de operação para lançar repasses da PJ para esta PF.
                      </p>
                    )}
                  </div>
                  {!viewOnly && (
                    <button type="button" className="btn btn-secondary btn-sm" style={{ width: "fit-content" }}
                      disabled={salvando} onClick={handleRevogar}>
                      Revogar vínculo
                    </button>
                  )}
                </div>
              </div>
            )}

            {!loading && !temVinculo && (
              <div className="card">
                <div className="card-title">Vincular conta PF (destino dos repasses)</div>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55, margin: "0 0 16px" }}>
                  Informe o e-mail da conta Pessoa Física no Fluxiva. Após o aceite, você poderá lançar
                  operações <strong>da PJ para essa PF</strong> — sempre saída na empresa e entrada na pessoa física.
                </p>
                {viewOnly ? (
                  <div className="alert alert-info" style={{ margin: 0 }}>Modo visualização.</div>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">E-mail da conta PF</label>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input className="form-input" type="email" placeholder="pf@email.com"
                          value={email} onChange={(e) => { setEmail(e.target.value); setPfPreview(null); }}
                          style={{ flex: "1 1 220px" }} />
                        <button type="button" className="btn btn-secondary" disabled={buscando || !email.trim()}
                          onClick={handleBuscar}>
                          {buscando ? "Buscando..." : "Verificar"}
                        </button>
                      </div>
                    </div>
                    {pfPreview && (
                      <div className="alert alert-info" style={{ marginTop: 12 }}>
                        <strong>{pfPreview.nome}</strong>
                        <span style={{ display: "block", fontSize: 12, marginTop: 4 }}>{pfPreview.email}</span>
                      </div>
                    )}
                    <div style={{ marginTop: 16 }}>
                      <button type="button" className="btn btn-primary" disabled={salvando || !pfPreview}
                        onClick={handleVincular}>
                        {salvando ? "Vinculando..." : "Enviar convite de vínculo"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {vinculoAtivo && tab === "prolabore" && (
          <div className="card">
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Banknote size={18} strokeWidth={2} aria-hidden />
              Pró-labore (PJ → PF)
            </div>
            <OperacaoForm
              vinculo={vinculo}
              viewOnly={viewOnly}
              valor={valor}
              setValor={setValor}
              data={data}
              setData={setData}
              observacao={observacao}
              setObservacao={setObservacao}
              preview={preview}
              clearPreview={() => setPreview(null)}
              previewLoading={previewLoading}
              confirmando={confirmando}
              onPreview={handlePreviewProLabore}
              onConfirm={handleConfirmarProLabore}
              previewBtnLabel="Ver preview"
              confirmBtnLabel="Confirmar Pró-labore"
              description={descProLabore}
            />
          </div>
        )}

        {vinculoAtivo && tab === "lucros" && (
          <div className="card">
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={18} strokeWidth={2} aria-hidden />
              Distribuição de Lucros (PJ → PF)
            </div>
            <OperacaoForm
              vinculo={vinculo}
              viewOnly={viewOnly}
              valor={lucrosValor}
              setValor={setLucrosValor}
              data={lucrosData}
              setData={setLucrosData}
              observacao={lucrosObs}
              setObservacao={setLucrosObs}
              preview={lucrosPreview}
              clearPreview={() => setLucrosPreview(null)}
              previewLoading={lucrosPreviewLoading}
              confirmando={lucrosConfirmando}
              onPreview={handlePreviewLucros}
              onConfirm={handleConfirmarLucros}
              previewBtnLabel="Ver preview"
              confirmBtnLabel="Confirmar Distribuição de Lucros"
              description={descLucros}
            />
          </div>
        )}

        {vinculoAtivo && tab === "salario" && (
          <div className="card">
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CircleDollarSign size={18} strokeWidth={2} aria-hidden />
              Salário (PJ → PF)
            </div>
            <OperacaoForm
              vinculo={vinculo}
              viewOnly={viewOnly}
              valor={salarioValor}
              setValor={setSalarioValor}
              data={salarioData}
              setData={setSalarioData}
              observacao={salarioObs}
              setObservacao={setSalarioObs}
              preview={salarioPreview}
              clearPreview={() => setSalarioPreview(null)}
              previewLoading={salarioPreviewLoading}
              confirmando={salarioConfirmando}
              onPreview={handlePreviewSalario}
              onConfirm={handleConfirmarSalario}
              previewBtnLabel="Ver preview"
              confirmBtnLabel="Confirmar Salário"
              description={descSalario}
            />
          </div>
        )}

        {vinculoAtivo && tab === "transferencia" && (
          <div className="card">
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ArrowRight size={18} strokeWidth={2} aria-hidden />
              Transferência PJ → PF
            </div>
            <OperacaoForm
              vinculo={vinculo}
              viewOnly={viewOnly}
              valor={transfValor}
              setValor={setTransfValor}
              data={transfData}
              setData={setTransfData}
              observacao={transfObs}
              setObservacao={setTransfObs}
              preview={transfPreview}
              clearPreview={() => setTransfPreview(null)}
              previewLoading={transfPreviewLoading}
              confirmando={transfConfirmando}
              onPreview={handlePreviewTransferencia}
              onConfirm={handleConfirmarTransferencia}
              previewBtnLabel="Ver preview"
              confirmBtnLabel="Confirmar Transferência PJ → PF"
              description={descTransf}
            />
          </div>
        )}

        {vinculoAtivo && tab === "agendamentos" && (
          <div className="card">
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CalendarDays size={18} strokeWidth={2} aria-hidden />
              Agendamentos (repasses recorrentes)
            </div>
            <AgendamentosPanel
              agendamentos={agendamentos}
              loading={loadingAg}
              viewOnly={viewOnly}
              mesGeracao={mesGeracao}
              setMesGeracao={setMesGeracao}
              form={agForm}
              setForm={setAgForm}
              editId={agEditId}
              setEditId={setAgEditId}
              salvandoAg={salvandoAg}
              gerandoMes={gerandoMes}
              onRefresh={loadAgendamentos}
              onSubmit={handleSubmitAgendamento}
              onCancelEdit={resetAgForm}
              onEdit={handleEditAgendamento}
              onDelete={handleDeleteAgendamento}
              onToggleStatus={handleToggleStatusAg}
              onGerarMes={handleGerarRepassesMes}
            />
          </div>
        )}

        {vinculoAtivo && tab === "historico" && (
          <div className="card">
            <div className="card-title">Histórico de repasses PJ → PF</div>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55, margin: "0 0 16px" }}>
              Cada linha é uma operação confirmada com lançamentos nos <strong>dois lados</strong>.
              Use <strong>Desfazer</strong> para remover saída na PJ e entrada na PF (rollback).
            </p>
            <HistoricoOperacoes
              operacoes={operacoes}
              loading={loadingOps}
              viewOnly={viewOnly}
              desfazendoId={desfazendoId}
              reparandoId={reparandoId}
              onRollback={handleRollback}
              onRepair={handleRepair}
            />
          </div>
        )}

        {erro && (
          <div className="alert alert-warn" style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertCircle size={16} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
            {erro}
          </div>
        )}
        {msg && <div className="alert alert-info" style={{ marginTop: 14 }}>{msg}</div>}
      </div>
    </div>
  );
}
