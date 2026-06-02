/**
 * IntegracaoPfPjPage — Vínculo + Pró-labore + Lucros PJ ↔ PF (Etapas 5.0B–5.1)
 */
import { useState, useEffect, useCallback } from "react";
import { useGestor } from "../GestorContext.jsx";
import { isPessoaJuridica } from "../profileLabels.js";
import { integracaoPfPjApi } from "../api.js";
import { fmtBRL, fmtDate } from "../finance.js";
import {
  Link2, User, CheckCircle, Clock, XCircle, AlertCircle, Banknote, TrendingUp,
  CircleDollarSign, ArrowRight,
} from "../components/icons.jsx";

const TABS = [
  { id: "vinculo", label: "Vínculo" },
  { id: "prolabore", label: "Pró-labore" },
  { id: "lucros", label: "Distribuição de Lucros" },
  { id: "salario", label: "Salário" },
  { id: "transferencia", label: "Transferência PJ → PF" },
  { id: "historico", label: "Histórico" },
];

const TIPO_OP_LABEL = {
  pro_labore: "Pró-labore",
  distribuicao_lucros: "Distribuição de Lucros",
  salario: "Salário",
  transferencia_pj_pf: "Transferência PJ → PF",
};

function statusBadge(status) {
  if (status === "ativo") return { label: "Ativo", cls: "badge-cp-pago", Icon: CheckCircle };
  if (status === "pendente") return { label: "Aguardando PF", cls: "badge-cp-pendente", Icon: Clock };
  if (status === "ok") return { label: "OK", cls: "badge-cp-pago", Icon: CheckCircle };
  if (status === "rollback") return { label: "Desfeito", cls: "badge-cp-atrasado", Icon: XCircle };
  return { label: status, cls: "badge-cp-atrasado", Icon: XCircle };
}

function TabBar({ tab, setTab, vinculoAtivo }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`btn btn-sm ${tab === t.id ? "btn-primary" : "btn-secondary"}`}
          disabled={t.id !== "vinculo" && !vinculoAtivo}
          onClick={() => setTab(t.id)}
        >
          {t.label}
        </button>
      ))}
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
        Vínculo PF ativo necessário. Conclua o aceite na aba Vínculo.
      </div>
    );
  }
  if (viewOnly) {
    return <div className="alert alert-info" style={{ margin: 0 }}>Modo visualização.</div>;
  }
  return (
    <>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55, margin: "0 0 16px" }}>
        {description}
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
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
            Revise os lançamentos antes de confirmar
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <PreviewLancamento titulo="Saída na PJ" lado="Saída" lanc={preview.lancamentoPj} />
            <PreviewLancamento titulo="Entrada na PF" lado="Entrada" lanc={preview.lancamentoPf} />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 16, fontWeight: 700 }}
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

export default function IntegracaoPfPjPage() {
  const { viewOnly, reloadAppState, tipo } = useGestor();
  const contaPJ = isPessoaJuridica(tipo);
  const [tab, setTab] = useState("vinculo");

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

  const vinculoAtivo = vinculo?.status === "ativo";
  const temVinculo = vinculo && vinculo.status !== "revogado";

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

  useEffect(() => { loadVinculo(); }, [loadVinculo]);
  useEffect(() => {
    if (tab === "historico" && vinculoAtivo) loadOperacoes();
  }, [tab, vinculoAtivo, loadOperacoes]);

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
      setMsg("Convite enviado. A pessoa física precisa aceitar em Perfil.");
    } catch (err) {
      setErro(err.message || "Erro ao vincular.");
    } finally {
      setSalvando(false);
    }
  };

  const handleRevogar = async () => {
    if (!window.confirm("Revogar o vínculo com esta conta PF?")) return;
    setSalvando(true);
    setErro(null);
    setMsg(null);
    try {
      await integracaoPfPjApi.revogarVinculo();
      setVinculo(null);
      setPfPreview(null);
      setEmail("");
      setPreview(null);
      setTab("vinculo");
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
      setMsg("Distribuição de Lucros registrada nos dois lados.");
      if (reloadAppState) reloadAppState();
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
      setMsg("Salário registrado nos dois lados.");
      if (reloadAppState) reloadAppState();
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
      setMsg("Transferência PJ → PF registrada nos dois lados.");
      if (reloadAppState) reloadAppState();
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
      setMsg("Pró-labore registrado nos dois lados.");
      if (reloadAppState) reloadAppState();
      setTab("historico");
      loadOperacoes();
    } catch (err) {
      setErro(err.message || "Erro ao confirmar pró-labore.");
    } finally {
      setConfirmando(false);
    }
  };

  const handleRollback = async (op) => {
    const tipo = TIPO_OP_LABEL[op.tipoOperacao] || "operação";
    if (!window.confirm(`Desfazer esta ${tipo}? Os lançamentos PJ e PF serão removidos.`)) return;
    setDesfazendoId(op.id);
    setErro(null);
    try {
      await integracaoPfPjApi.rollbackOperacao(op.id);
      setMsg("Operação desfeita.");
      if (reloadAppState) reloadAppState();
      loadOperacoes();
    } catch (err) {
      setErro(err.message || "Erro ao desfazer.");
    } finally {
      setDesfazendoId(null);
    }
  };

  const badge = vinculo ? statusBadge(vinculo.status) : null;

  return (
    <div className="of-page">
      <div className="of-hero">
        <div className="of-hero-inner">
          <div className="of-hero-badge">
            <Link2 size={13} strokeWidth={2} aria-hidden />
            Integração PF/PJ
          </div>
          <h2 className="of-hero-title">Vincule sua conta PF</h2>
          <p className="of-hero-sub">
            Vincule sua conta PF e lance pró-labore, lucros, salário ou transferências
            com lançamentos automáticos nos dois lados.
          </p>
        </div>
      </div>

      <div className="of-section">
        {!contaPJ && (
          <div className="alert alert-warn" style={{ marginBottom: 16 }}>
            Esta área é exclusiva para contas Pessoa Jurídica. O perfil exibido no menu usa o mesmo
            critério do servidor; se o erro persistir, entre em contato com o suporte.
          </div>
        )}
        <TabBar tab={tab} setTab={setTab} vinculoAtivo={vinculoAtivo} />

        {tab === "vinculo" && (
          <>
            {loading && (
              <div style={{ padding: 20, color: "var(--muted-foreground)", fontSize: 13 }}>Carregando...</div>
            )}

            {!loading && temVinculo && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <User size={18} strokeWidth={2} aria-hidden />
                  Vínculo atual
                </div>
                <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
                  <div>
                    <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>Conta PF</span>
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
                        Aguardando aceite da PF em Perfil.
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
                <div className="card-title">Vincular minha conta PF</div>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55, margin: "0 0 16px" }}>
                  Informe o e-mail da conta Pessoa Física já cadastrada no Fluxiva.
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
                        {salvando ? "Vinculando..." : "Vincular minha conta PF"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {tab === "prolabore" && (
          <div className="card">
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Banknote size={18} strokeWidth={2} aria-hidden />
              Lançar Pró-labore
            </div>
            <OperacaoForm
              vinculo={vinculoAtivo ? vinculo : null}
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
              confirmBtnLabel="Confirmar e lançar pró-labore"
              description={
                <>
                  Gera automaticamente <strong>Saída na PJ</strong> e <strong>Entrada na PF</strong> vinculada
                  ({vinculo?.nomePf || vinculo?.emailPf || "—"}).
                </>
              }
            />
          </div>
        )}

        {tab === "lucros" && (
          <div className="card">
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={18} strokeWidth={2} aria-hidden />
              Distribuição de Lucros
            </div>
            <OperacaoForm
              vinculo={vinculoAtivo ? vinculo : null}
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
              confirmBtnLabel="Confirmar e lançar Distribuição de Lucros"
              description={
                <>
                  Registra <strong>Saída na PJ</strong> e <strong>Entrada na PF</strong> por Distribuição de Lucros
                  ({vinculo?.nomePf || vinculo?.emailPf || "—"}).
                </>
              }
            />
          </div>
        )}

        {tab === "salario" && (
          <div className="card">
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CircleDollarSign size={18} strokeWidth={2} aria-hidden />
              Salário
            </div>
            <OperacaoForm
              vinculo={vinculoAtivo ? vinculo : null}
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
              confirmBtnLabel="Confirmar e lançar Salário"
              description={
                <>
                  Registra <strong>Saída na PJ</strong> e <strong>Entrada na PF</strong> por salário
                  ({vinculo?.nomePf || vinculo?.emailPf || "—"}).
                </>
              }
            />
          </div>
        )}

        {tab === "transferencia" && (
          <div className="card">
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ArrowRight size={18} strokeWidth={2} aria-hidden />
              Transferência PJ → PF
            </div>
            <OperacaoForm
              vinculo={vinculoAtivo ? vinculo : null}
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
              confirmBtnLabel="Confirmar e lançar Transferência PJ → PF"
              description={
                <>
                  Registra <strong>Saída na PJ</strong> e <strong>Entrada na PF</strong> por transferência
                  ({vinculo?.nomePf || vinculo?.emailPf || "—"}).
                </>
              }
            />
          </div>
        )}

        {tab === "historico" && (
          <div className="card">
            <div className="card-title">Histórico de operações</div>
            {loadingOps && (
              <div style={{ padding: 12, color: "var(--muted-foreground)", fontSize: 13 }}>Carregando...</div>
            )}
            {!loadingOps && !operacoes.length && (
              <div style={{ padding: 12, color: "var(--muted-foreground)", fontSize: 13 }}>
                Nenhuma operação registrada.
              </div>
            )}
            {!loadingOps && operacoes.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Histórico</th>
                      <th style={{ textAlign: "right" }}>Valor</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operacoes.map((op) => {
                      const b = statusBadge(op.status);
                      return (
                        <tr key={op.id}>
                          <td className="td-mono" style={{ fontSize: 12 }}>{fmtDate(op.data)}</td>
                          <td style={{ fontSize: 12 }}>{TIPO_OP_LABEL[op.tipoOperacao] || op.tipoOperacao}</td>
                          <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                              title={op.historico}>{op.historico}</td>
                          <td className="td-mono" style={{ textAlign: "right" }}>{fmtBRL(op.valor)}</td>
                          <td>
                            <span className={`badge ${b.cls}`}>{b.label}</span>
                          </td>
                          <td>
                            {!viewOnly && op.status === "ok" && (
                              <button type="button" className="btn btn-secondary btn-sm"
                                disabled={desfazendoId === op.id}
                                onClick={() => handleRollback(op)}>
                                {desfazendoId === op.id ? "..." : "Desfazer"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
