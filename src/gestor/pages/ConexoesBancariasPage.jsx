/**
 * ConexoesBancariasPage — Open Finance / Conexões Bancárias
 *
 * Etapa 4.6C — Histórico profissional de importações (somente leitura)
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useGestor }      from "../GestorContext.jsx";
import { conexoesApi, importacoesApi } from "../api.js";
import { fmtBRL, fmtDate } from "../finance.js";
import {
  Bell, FileText, Table, PenLine, ArrowRight, Link2, AlertCircle,
  Upload, CheckCircle, XCircle, Clock, ChevronLeft, Eye, ExternalLink,
} from "../components/icons.jsx";

const BANCOS = [
  { slug: "nubank",    nome: "Nubank",         sigla: "Nu",   cor: "oklch(0.52 0.22 295)", descricao: "Conta + Cartão de crédito"   },
  { slug: "itau",      nome: "Itaú",            sigla: "Itaú", cor: "oklch(0.58 0.17 52)",  descricao: "Conta Corrente · PF e PJ"    },
  { slug: "bradesco",  nome: "Bradesco",        sigla: "B",    cor: "oklch(0.50 0.22 27)",  descricao: "Conta Corrente e Poupança"   },
  { slug: "bb",        nome: "Banco do Brasil", sigla: "BB",   cor: "oklch(0.63 0.14 82)",  descricao: "Conta Corrente · PF e PJ"    },
  { slug: "caixa",     nome: "Caixa",           sigla: "CEF",  cor: "oklch(0.44 0.18 240)", descricao: "Poupança + Conta Corrente"   },
  { slug: "inter",     nome: "Inter",           sigla: "Int",  cor: "oklch(0.62 0.18 52)",  descricao: "Conta Digital · PIX"         },
  { slug: "c6",        nome: "C6 Bank",         sigla: "C6",   cor: "oklch(0.28 0.02 0)",   descricao: "Conta Digital · PF e PJ"     },
  { slug: "santander", nome: "Santander",       sigla: "San",  cor: "oklch(0.48 0.22 27)",  descricao: "Conta Corrente e Investimentos" },
];

const ROADMAP = [
  { fase: "Disponível", data: "Agora",     titulo: "Importação OFX / QIF",         descricao: "Preview, deduplicação e gravação com histórico", done: true  },
  { fase: "Em breve",   data: "2025-2026", titulo: "Importação CSV multi-banco", descricao: "Nubank, Inter, Mercado Pago — com mapeamento de colunas",   done: false },
  { fase: "Planejado",  data: "2026",      titulo: "Conector Open Finance",      descricao: "Integração com APIs reguladas pelo Banco Central",          done: false },
  { fase: "Futuro",     data: "2026+",     titulo: "Sincronização Automática",   descricao: "Extratos direto da conta, sem upload manual",               done: false },
];

const fmtData = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

function BancoCard({ banco, avisado, loading, disabled, onAviso }) {
  return (
    <div className="of-banco-card">
      <div className="of-banco-header">
        <div className="of-banco-sigla" style={{ background: banco.cor }}>{banco.sigla}</div>
        <div className="of-badge-breve">Em breve</div>
      </div>
      <div className="of-banco-nome">{banco.nome}</div>
      <div className="of-banco-desc">{banco.descricao}</div>
      <button
        type="button"
        className={"btn btn-sm of-aviso-btn" + (avisado ? " of-aviso-btn-done" : "")}
        onClick={() => !avisado && !disabled && onAviso(banco.slug)}
        disabled={avisado || disabled || loading}
      >
        {avisado ? <>ok Interesse registrado</> : <><Bell size={14} strokeWidth={2} aria-hidden /> Avise-me</>}
      </button>
    </div>
  );
}

function RoadmapItem({ item, isLast }) {
  return (
    <div className="of-roadmap-item">
      <div className="of-roadmap-dot-wrap">
        <div className={"of-roadmap-dot" + (item.done ? " done" : "")} />
        {!isLast && <div className="of-roadmap-line" />}
      </div>
      <div className="of-roadmap-content">
        <div className="of-roadmap-fase">
          <span className={"badge " + (item.done ? "badge-cp-pago" : "badge-cp-pendente")}>{item.fase}</span>
          <span className="of-roadmap-data">{item.data}</span>
        </div>
        <div className="of-roadmap-titulo">{item.titulo}</div>
        <div className="of-roadmap-desc">{item.descricao}</div>
      </div>
    </div>
  );
}

function OFXWizard({ contas, planoContas, onClose, onSuccess }) {
  const [step, setStep]           = useState(1);
  const [contaId, setContaId]     = useState(contas[0]?.id || "");
  const [planoId, setPlanoId]     = useState("");
  const [file, setFile]           = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [loading, setLoading]     = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [confirmacao, setConfirmacao] = useState(null);
  const [erro, setErro]           = useState(null);
  const fileRef                   = useRef();

  const contasAtivas = contas.filter((c) => !c.inativo);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setErro(null);
  };

  const handlePreview = async () => {
    if (!file) { setErro("Selecione um arquivo OFX ou QIF."); return; }
    if (!contaId) { setErro("Selecione a conta bancaria."); return; }
    setLoading(true);
    setErro(null);
    setConfirmacao(null);
    try {
      const content = await file.text();
      setFileContent(content);
      const res = await importacoesApi.previewOFX(contaId, planoId || null, file.name, content);
      setResultado(res);
      setStep(3);
    } catch (err) {
      setErro(err.message || "Erro ao analisar o arquivo. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = async () => {
    if (!fileContent || !contaId) return;
    setConfirmando(true);
    setErro(null);
    try {
      const res = await importacoesApi.confirmarOFX(
        contaId,
        planoId || null,
        file?.name || "extrato.ofx",
        fileContent
      );
      setConfirmacao(res);
      setStep(4);
      onSuccess?.();
    } catch (err) {
      setErro(err.message || "Erro ao confirmar importacao. Tente novamente.");
    } finally {
      setConfirmando(false);
    }
  };

  const stepTitle = step === 1 ? "Importar OFX — Configuracao"
                  : step === 2 ? "Importar OFX — Upload"
                  : step === 3 ? "Importar OFX — Preview"
                  : "Importacao concluida";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: step >= 3 ? 720 : 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {step > 1 && step < 4 && (
              <button type="button" className="btn btn-secondary btn-sm btn-icon"
                onClick={() => setStep((s) => s - 1)} title="Voltar">
                <ChevronLeft size={15} strokeWidth={2} />
              </button>
            )}
            <span className="modal-title">{stepTitle}</span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>X</button>
        </div>

        <div className="modal-body">
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55, margin: 0 }}>
                O arquivo OFX contém transações de várias naturezas.
                As categorias poderão ser definidas posteriormente ou classificadas automaticamente.
              </p>
              <div className="form-group">
                <label className="form-label">Conta bancaria <span style={{ color: "var(--danger)" }}>*</span></label>
                <select className="form-select" value={contaId} onChange={(e) => setContaId(e.target.value)}>
                  <option value="">Selecione a conta...</option>
                  {contasAtivas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.apelido || c.nome}{c.tipo ? " (" + c.tipo + ")" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <details style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <summary style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--muted-foreground)",
                  cursor: "pointer",
                  userSelect: "none",
                  listStyle: "none",
                }}>
                  Configurações avançadas
                </summary>
                <div className="form-group" style={{ marginTop: 14, marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 500, color: "var(--muted-foreground)" }}>
                    Categoria / Plano padrão{" "}
                    <span style={{ fontWeight: 400 }}>(opcional)</span>
                  </label>
                  <select className="form-select" value={planoId} onChange={(e) => setPlanoId(e.target.value)}>
                    <option value="">Nenhuma — classificar depois</option>
                    {planoContas.filter((p) => !p.inativo).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.icone ? p.icone + " " : ""}{p.descricao} — {p.tipo}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, display: "block", lineHeight: 1.45 }}>
                    Fallback apenas para lançamentos que permanecerem sem categoria após a importação.
                    Não aplica o extrato inteiro a uma única categoria.
                  </span>
                </div>
              </details>
              {erro && <div className="alert alert-warn" style={{ margin: 0 }}>{erro}</div>}
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55, margin: 0 }}>
                Selecione o arquivo <strong>.ofx</strong> ou <strong>.qif</strong> exportado pelo banco.
                Voce vera o preview antes de confirmar a importacao.
              </p>
              <div className="import-box" style={{ cursor: "pointer", textAlign: "center" }}
                onClick={() => fileRef.current?.click()}>
                <Upload size={28} strokeWidth={1.5} style={{ color: "var(--muted-foreground)", marginBottom: 8 }} />
                {file ? (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
                      {(file.size / 1024).toFixed(1)} KB — clique para trocar
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                      Clique para selecionar o arquivo
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                      Suporta .ofx e .qif (Itau, Bradesco, BB, Caixa, Nubank, Inter e outros)
                    </div>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".ofx,.qif,.OFX,.QIF" hidden onChange={handleFile} />
              </div>
              <div className="alert alert-info" style={{ margin: 0, fontSize: 12 }}>
                <strong>Como exportar o OFX:</strong> no app ou site do banco,
                acesse Extrato e escolha Exportar formato OFX ou QIF.
              </div>
              {erro && <div className="alert alert-warn" style={{ margin: 0 }}>{erro}</div>}
            </div>
          )}

          {step === 3 && resultado && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {resultado.novas > 0 ? (
                <div className="alert alert-info" style={{ margin: 0, fontSize: 12 }}>
                  Revise as transacoes abaixo. Somente as <strong>novas</strong> serao gravadas ao confirmar.
                </div>
              ) : (
                <div className="alert alert-warn" style={{ margin: 0, fontSize: 12 }}>
                  Todas as transacoes deste extrato ja foram importadas. Nada sera gravado.
                </div>
              )}
              {resultado.banco && (
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  Banco detectado:{" "}
                  <span className="badge badge-blue" style={{ textTransform: "capitalize" }}>{resultado.banco}</span>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                <div style={{ background: "var(--rn-page-canvas)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--foreground)" }}>
                    {resultado.total}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600, marginTop: 2 }}>Total</div>
                </div>
                <div style={{ background: "var(--success-soft)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--success-fg)" }}>
                    {resultado.novas}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--success-fg)", fontWeight: 600, marginTop: 2 }}>Novas</div>
                </div>
                <div style={{ background: "var(--warning-soft)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--warning-fg)" }}>
                    {resultado.duplicadas}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--warning-fg)", fontWeight: 600, marginTop: 2 }}>Duplicadas</div>
                </div>
              </div>
              {(resultado.transacoes || []).length > 0 && (
                <div className="table-wrap" style={{ maxHeight: 320, overflow: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Historico</th>
                        <th style={{ textAlign: "right" }}>Valor</th>
                        <th>Tipo</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.transacoes.map((tx, i) => (
                        <tr key={i} style={tx.status === "duplicada" ? { opacity: 0.72 } : undefined}>
                          <td className="td-mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(tx.data)}</td>
                          <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                              title={tx.historico || ""}>
                            {tx.historico || "—"}
                          </td>
                          <td className="td-mono" style={{
                            textAlign: "right",
                            color: tx.tipo === "Entrada" ? "var(--success-fg)" : "var(--danger-fg)",
                          }}>
                            {fmtBRL(tx.valor)}
                          </td>
                          <td style={{ fontSize: 12, textTransform: "capitalize" }}>{tx.tipo || "—"}</td>
                          <td>
                            <span className={"badge " + (tx.status === "nova" ? "badge-cp-pago" : "badge-cp-pendente")}>
                              {tx.status === "nova" ? "Nova" : "Duplicada"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {erro && <div className="alert alert-warn" style={{ margin: 0 }}>{erro}</div>}
            </div>
          )}

          {step === 4 && confirmacao && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
                {confirmacao.importados > 0
                  ? <CheckCircle size={40} strokeWidth={1.5} style={{ color: "var(--success-fg)", flexShrink: 0 }} />
                  : <Clock size={40} strokeWidth={1.5} style={{ color: "var(--warning-fg)", flexShrink: 0 }} />
                }
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)" }}>
                    {confirmacao.importados > 0 ? "Importacao concluida" : "Nenhuma transacao nova importada"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
                    {confirmacao.importados > 0
                      ? "Dashboard e Lancamentos ja refletem os novos registros."
                      : "Todas as transacoes deste extrato ja constavam no sistema."}
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                <div style={{ background: "var(--success-soft)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--success-fg)" }}>
                    {confirmacao.importados}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--success-fg)", fontWeight: 600, marginTop: 2 }}>Importados</div>
                </div>
                <div style={{ background: "var(--warning-soft)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--warning-fg)" }}>
                    {confirmacao.duplicados}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--warning-fg)", fontWeight: 600, marginTop: 2 }}>Duplicados</div>
                </div>
                <div style={{ background: "var(--rn-page-canvas)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color: confirmacao.erros > 0 ? "var(--danger-fg)" : "var(--muted-foreground)" }}>
                    {confirmacao.erros}
                  </div>
                  <div style={{ fontSize: 11, color: confirmacao.erros > 0 ? "var(--danger-fg)" : "var(--muted-foreground)", fontWeight: 600, marginTop: 2 }}>Erros</div>
                </div>
              </div>
              {confirmacao.loteId && (
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
                  Lote: {confirmacao.loteId}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step < 3 ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              {step === 1 && (
                <button type="button" className="btn btn-primary" disabled={!contaId}
                  onClick={() => { setErro(null); setStep(2); }}>
                  Proximo
                </button>
              )}
              {step === 2 && (
                <button type="button" className="btn btn-primary" disabled={!file || loading}
                  onClick={handlePreview}>
                  {loading ? "Analisando..." : "Ver preview"}
                </button>
              )}
            </>
          ) : step === 3 ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={confirmando}>Cancelar</button>
              <button type="button" className="btn btn-primary"
                disabled={confirmando || !resultado?.novas}
                onClick={handleConfirmar}>
                {confirmando ? "Importando..." : "Confirmar importacao"}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onClose}>Fechar</button>
          )}
        </div>
      </div>
    </div>
  );
}

function statusBadgeClass(s) {
  if (s === "sucesso") return "badge-cp-pago";
  if (s === "parcial") return "badge-cp-pendente";
  return "badge-cp-atrasado";
}

function ImportacaoDetalheModal({ importacaoId, onClose, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState(null);
  const [detalhe, setDetalhe] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErro(null);
      try {
        const data = await importacoesApi.get(importacaoId);
        if (!cancelled) setDetalhe(data);
      } catch (err) {
        if (!cancelled) setErro(err.message || "Erro ao carregar detalhes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [importacaoId]);

  const imp = detalhe?.importacao;
  const lancs = detalhe?.lancamentosImportados || [];

  const handleVerLancamentos = () => {
    if (imp?.lote_id) {
      window.alert(
        `Na tela de Lancamentos, use a busca pelo lote:\n\n${imp.lote_id}\n\n` +
        "Nao ha filtro automatico por lote nesta versao."
      );
    }
    onClose();
    onNavigate?.("lancamentos");
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Detalhes da importacao</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>X</button>
        </div>
        <div className="modal-body">
          {loading && (
            <div style={{ padding: "24px 0", color: "var(--muted-foreground)", fontSize: 13 }}>
              Carregando detalhes...
            </div>
          )}
          {erro && <div className="alert alert-warn">{erro}</div>}
          {!loading && !erro && imp && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px 20px", fontSize: 13 }}>
                <div>
                  <div style={{ color: "var(--muted-foreground)", fontSize: 11, marginBottom: 2 }}>Banco</div>
                  {imp.banco_slug
                    ? <span className="badge badge-blue" style={{ textTransform: "capitalize" }}>{imp.banco_slug}</span>
                    : "—"}
                </div>
                <div>
                  <div style={{ color: "var(--muted-foreground)", fontSize: 11, marginBottom: 2 }}>Formato</div>
                  <span className="td-mono">{imp.formato || "—"}</span>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ color: "var(--muted-foreground)", fontSize: 11, marginBottom: 2 }}>Arquivo</div>
                  {imp.nome_arquivo || "—"}
                </div>
                <div>
                  <div style={{ color: "var(--muted-foreground)", fontSize: 11, marginBottom: 2 }}>Data da importacao</div>
                  {fmtData(imp.created_at)}
                </div>
                <div>
                  <div style={{ color: "var(--muted-foreground)", fontSize: 11, marginBottom: 2 }}>Status</div>
                  <span className={"badge " + statusBadgeClass(imp.status)} style={{ textTransform: "capitalize" }}>
                    {imp.status}
                  </span>
                </div>
                <div>
                  <div style={{ color: "var(--muted-foreground)", fontSize: 11, marginBottom: 2 }}>Lote</div>
                  <span className="td-mono" style={{ fontSize: 12 }}>{imp.lote_id || "—"}</span>
                </div>
                <div>
                  <div style={{ color: "var(--muted-foreground)", fontSize: 11, marginBottom: 2 }}>Total processado</div>
                  <span className="td-mono">{imp.total_linhas}</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                <div style={{ background: "var(--rn-page-canvas)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{imp.total_linhas}</div>
                  <div style={{ fontSize: 10, color: "var(--muted-foreground)", fontWeight: 600 }}>Total</div>
                </div>
                <div style={{ background: "var(--success-soft)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--success-fg)" }}>{imp.importados}</div>
                  <div style={{ fontSize: 10, color: "var(--success-fg)", fontWeight: 600 }}>Importados</div>
                </div>
                <div style={{ background: "var(--warning-soft)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--warning-fg)" }}>{imp.duplicatas}</div>
                  <div style={{ fontSize: 10, color: "var(--warning-fg)", fontWeight: 600 }}>Duplicados</div>
                </div>
                <div style={{ background: "var(--rn-page-canvas)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: imp.erros > 0 ? "var(--danger-fg)" : "var(--muted-foreground)" }}>{imp.erros}</div>
                  <div style={{ fontSize: 10, color: imp.erros > 0 ? "var(--danger-fg)" : "var(--muted-foreground)", fontWeight: 600 }}>Erros</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  Lancamentos deste lote ({lancs.length})
                </div>
                {lancs.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", padding: "12px 0" }}>
                    Nenhum lancamento encontrado para o lote {imp.lote_id || "—"}.
                    {imp.importados === 0 && " Esta importacao nao gravou transacoes novas."}
                  </div>
                ) : (
                  <div className="table-wrap" style={{ maxHeight: 280, overflow: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Historico</th>
                          <th style={{ textAlign: "right" }}>Valor</th>
                          <th>Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lancs.map((l) => (
                          <tr key={l.id}>
                            <td className="td-mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(l.data)}</td>
                            <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                title={l.historico || ""}>
                              {l.historico || "—"}
                            </td>
                            <td className="td-mono" style={{
                              textAlign: "right",
                              color: l.tipo === "Entrada" ? "var(--success-fg)" : "var(--danger-fg)",
                            }}>
                              {fmtBRL(l.valor)}
                            </td>
                            <td style={{ fontSize: 12 }}>{l.tipo || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Fechar</button>
          {imp?.lote_id && onNavigate && (
            <button type="button" className="btn btn-primary" onClick={handleVerLancamentos}>
              <ExternalLink size={14} strokeWidth={2} aria-hidden />
              Ver lancamentos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoricoImportacoes({ importacoes, total, loading, erro, onVerDetalhes, onVerLancamentos }) {
  if (loading) return (
    <div style={{ padding: "20px 0", color: "var(--muted-foreground)", fontSize: 13 }}>Carregando historico...</div>
  );
  if (erro) return <div className="alert alert-warn">{erro}</div>;
  if (!importacoes.length) return (
    <div style={{ padding: "20px 0", color: "var(--muted-foreground)", fontSize: 13 }}>
      Nenhuma importacao confirmada ainda. Use &quot;Importar OFX&quot; acima para importar seu primeiro extrato.
    </div>
  );
  const statusIcon = (s) => {
    if (s === "sucesso") return <CheckCircle size={14} strokeWidth={2} style={{ color: "var(--success-fg)" }} />;
    if (s === "parcial") return <Clock size={14} strokeWidth={2} style={{ color: "var(--warning-fg)" }} />;
    return <XCircle size={14} strokeWidth={2} style={{ color: "var(--danger-fg)" }} />;
  };
  return (
    <>
      {total > importacoes.length && (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>
          Exibindo {importacoes.length} de {total} importacoes.
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Banco</th>
              <th>Arquivo</th>
              <th style={{ textAlign: "right" }}>Importados</th>
              <th style={{ textAlign: "right" }}>Duplicados</th>
              <th>Status</th>
              <th>Lote</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {importacoes.map((imp) => (
              <tr key={imp.id}>
                <td className="td-mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtData(imp.created_at)}</td>
                <td>
                  {imp.banco_slug
                    ? <span className="badge badge-blue" style={{ textTransform: "capitalize" }}>{imp.banco_slug}</span>
                    : <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>—</span>}
                </td>
                <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={imp.nome_arquivo || ""}>
                  {imp.nome_arquivo || <span style={{ color: "var(--muted-foreground)" }}>—</span>}
                </td>
                <td className="td-mono" style={{ textAlign: "right", color: "var(--success-fg)" }}>{imp.importados}</td>
                <td className="td-mono" style={{ textAlign: "right", color: "var(--muted-foreground)" }}>{imp.duplicatas}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {statusIcon(imp.status)}
                    <span style={{ fontSize: 12, textTransform: "capitalize" }}>{imp.status}</span>
                  </div>
                </td>
                <td className="td-mono" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                  {imp.lote_id || "—"}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-secondary btn-sm"
                      onClick={() => onVerDetalhes(imp.id)} title="Ver detalhes">
                      <Eye size={13} strokeWidth={2} aria-hidden />
                      Detalhes
                    </button>
                    {imp.lote_id && imp.importados > 0 && (
                      <button type="button" className="btn btn-secondary btn-sm"
                        onClick={() => onVerLancamentos(imp)} title="Ver lancamentos">
                        <ExternalLink size={13} strokeWidth={2} aria-hidden />
                        Lancamentos
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function ConexoesBancariasPage({ onNavigate }) {
  const { tipo, viewOnly, contas, planoContas, reloadAppState } = useGestor();
  const isPF = tipo === "fisica";

  const [avisados, setAvisados]               = useState(new Set());
  const [loadingInteresse, setLoadingInteresse] = useState(true);
  const [savingSlug, setSavingSlug]           = useState(null);
  const [interesseError, setInteresseError]   = useState(null);
  const [wizardOpen, setWizardOpen]           = useState(false);
  const [importacoes, setImportacoes]         = useState([]);
  const [importacoesTotal, setImportacoesTotal] = useState(0);
  const [loadingHist, setLoadingHist]         = useState(true);
  const [histErro, setHistErro]               = useState(null);
  const [detalheId, setDetalheId]             = useState(null);

  const loadInteresses = useCallback(async () => {
    setLoadingInteresse(true); setInteresseError(null);
    try {
      const { interesses } = await conexoesApi.listInteresse();
      setAvisados(new Set((interesses || []).map((i) => i.banco_slug)));
    } catch { setInteresseError("Nao foi possivel carregar seus avisos."); }
    finally { setLoadingInteresse(false); }
  }, []);

  const loadHistorico = useCallback(async () => {
    setLoadingHist(true); setHistErro(null);
    try {
      const { importacoes: list, total } = await importacoesApi.list({ limit: 50 });
      setImportacoes(list || []);
      setImportacoesTotal(total ?? (list?.length || 0));
    } catch { setHistErro("Nao foi possivel carregar o historico."); }
    finally { setLoadingHist(false); }
  }, []);

  const handleVerDetalhes = useCallback((id) => setDetalheId(id), []);

  const handleVerLancamentos = useCallback((imp) => {
    if (imp?.lote_id) {
      window.alert(
        `Na tela de Lancamentos, use a busca pelo lote:\n\n${imp.lote_id}\n\n` +
        "Nao ha filtro automatico por lote nesta versao."
      );
    }
    onNavigate?.("lancamentos");
  }, [onNavigate]);

  useEffect(() => { loadInteresses(); loadHistorico(); }, [loadInteresses, loadHistorico]);

  const handleAviso = async (slug) => {
    if (viewOnly) return;
    setSavingSlug(slug); setInteresseError(null);
    try {
      await conexoesApi.registerInteresse(slug);
      setAvisados((prev) => new Set([...prev, slug]));
    } catch (err) { setInteresseError(err.message || "Erro ao registrar interesse."); }
    finally { setSavingSlug(null); }
  };

  const handleImportSuccess = useCallback(() => {
    loadHistorico();
    if (reloadAppState) reloadAppState();
  }, [loadHistorico, reloadAppState]);

  const totalAvisados = avisados.size;

  return (
    <div className="of-page">

      <div className="of-status-banner" role="status">
        <AlertCircle size={18} strokeWidth={2} aria-hidden />
        <div>
          <strong>Conexao automatica ainda nao disponivel.</strong>
          {" "}Importacao OFX com deduplicacao e historico esta disponivel.
          Open Finance no roadmap.
        </div>
      </div>

      <div className="of-hero">
        <div className="of-hero-inner">
          <div className="of-hero-badge">
            <Link2 size={13} strokeWidth={2} aria-hidden />
            Open Finance · Em preparacao
          </div>
          <h2 className="of-hero-title">Conexoes Bancarias</h2>
          <p className="of-hero-sub">
            Importe extratos OFX com preview, deduplicacao e historico de importacoes.
            A integracao com Open Finance Brasil esta planejada para 2026.
          </p>
          <div className="of-hero-chips">
            <span className="of-chip">Deduplicacao por FITID</span>
            <span className="of-chip">Historico de importacoes</span>
            <span className="of-chip">Sem armazenar senhas</span>
            <span className="of-chip">Open Finance (futuro)</span>
          </div>
        </div>
      </div>

      <div className="of-section">
        <div className="of-section-header">
          <div>
            <div className="of-section-title">Importacao de extrato OFX / QIF</div>
            <div className="of-section-sub">
              Envie o arquivo, revise o preview e confirme para gravar somente transacoes novas.
            </div>
          </div>
          {!viewOnly && (
            <button type="button" className="btn btn-primary" onClick={() => setWizardOpen(true)} style={{ flexShrink: 0 }}>
              <Upload size={15} strokeWidth={2} aria-hidden />
              Importar OFX
            </button>
          )}
        </div>

        <div className="of-import-grid" style={{ marginBottom: 0 }}>
          <div className="of-import-card of-import-card--action"
            onClick={() => !viewOnly && setWizardOpen(true)}
            style={{ cursor: viewOnly ? "default" : "pointer" }}>
            <div className="of-import-icon-wrap" aria-hidden><FileText size={22} strokeWidth={1.75} /></div>
            <div className="of-import-titulo">OFX / QIF</div>
            <div className="of-import-desc">
              Formato padrao exportado pelos principais bancos brasileiros.
              Compativel com Itau, Bradesco, BB, Caixa, Nubank, Inter e mais.
            </div>
            <div className="of-import-dica">No app do banco: Extrato - Exportar - OFX</div>
            <div className="of-import-footer">
              <span className="badge badge-cp-pago of-import-badge">Disponivel agora</span>
              {!viewOnly && (
                <button type="button" className="btn btn-sm of-import-action-btn"
                  onClick={(e) => { e.stopPropagation(); setWizardOpen(true); }}>
                  Preview <ArrowRight size={14} strokeWidth={2} aria-hidden />
                </button>
              )}
            </div>
          </div>

          <div className="of-import-card">
            <div className="of-import-icon-wrap" aria-hidden><Table size={22} strokeWidth={1.75} /></div>
            <div className="of-import-titulo">CSV / XLSX</div>
            <div className="of-import-desc">
              Planilha de extrato. Exportada pelo Mercado Pago, Nubank, Inter e outros bancos digitais.
            </div>
            <div className="of-import-dica">No app do banco: Extrato - Exportar CSV</div>
            <div className="of-import-footer">
              <span className="badge badge-cp-pago of-import-badge">Disponivel</span>
              {onNavigate && (
                <button type="button" className="btn btn-sm of-import-action-btn"
                  onClick={() => onNavigate(isPF ? "lancamentos" : "importacoes")}>
                  {isPF ? "Lancamentos" : "Importacoes"} <ArrowRight size={14} strokeWidth={2} aria-hidden />
                </button>
              )}
            </div>
          </div>

          <div className="of-import-card">
            <div className="of-import-icon-wrap" aria-hidden><PenLine size={22} strokeWidth={1.75} /></div>
            <div className="of-import-titulo">Extrato Manual</div>
            <div className="of-import-desc">Cadastre lancamentos a partir do extrato impresso ou PDF.</div>
            <div className="of-import-dica">Menu: Lancamentos - Novo Lancamento</div>
            <div className="of-import-footer">
              <span className="badge badge-cp-pago of-import-badge">Disponivel</span>
              {onNavigate && (
                <button type="button" className="btn btn-sm of-import-action-btn"
                  onClick={() => onNavigate("lancamentos")}>
                  Ir para Lancamentos <ArrowRight size={14} strokeWidth={2} aria-hidden />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="of-section">
        <div className="of-section-title">Historico de importacoes</div>
        <div className="of-section-sub" style={{ marginBottom: 16 }}>
          Registro das ultimas importacoes confirmadas. Transacoes duplicadas sao ignoradas automaticamente.
        </div>
        <HistoricoImportacoes
          importacoes={importacoes}
          total={importacoesTotal}
          loading={loadingHist}
          erro={histErro}
          onVerDetalhes={handleVerDetalhes}
          onVerLancamentos={handleVerLancamentos}
        />
      </div>

      <div className="of-section">
        <div className="of-section-header">
          <div>
            <div className="of-section-title">Bancos na fila de integracao automatica</div>
            <div className="of-section-sub">
              Registre interesse para ser avisado quando o conector Open Finance estiver disponivel.
              {totalAvisados > 0 && (
                <span className="of-interesse-count">
                  {totalAvisados} interesse{totalAvisados !== 1 ? "s" : ""} registrado{totalAvisados !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        {interesseError && <div className="alert alert-warn" style={{ marginBottom: 14 }}>{interesseError}</div>}
        <div className="of-bancos-grid">
          {BANCOS.map((banco) => (
            <BancoCard key={banco.slug} banco={banco} avisado={avisados.has(banco.slug)}
              loading={loadingInteresse || savingSlug === banco.slug}
              disabled={viewOnly} onAviso={handleAviso} />
          ))}
        </div>
      </div>

      <div className="of-section of-section-alt">
        <div className="of-section-title">Roadmap de integracao</div>
        <div className="of-section-sub" style={{ marginBottom: 24 }}>
          Importacao OFX operacional com preview e confirmacao.
        </div>
        <div className="of-roadmap">
          {ROADMAP.map((item, i) => (
            <RoadmapItem key={item.titulo} item={item} isLast={i === ROADMAP.length - 1} />
          ))}
        </div>
      </div>

      <div className="of-footer-note">
        <span style={{ fontSize: 15 }}>lock</span>
        <span>
          Quando implementado, o Open Finance seguira o padrao regulado pelo Banco Central.
          Nenhuma senha bancaria sera armazenada.
        </span>
      </div>

      {wizardOpen && (
        <OFXWizard contas={contas || []} planoContas={planoContas || []}
          onClose={() => setWizardOpen(false)} onSuccess={handleImportSuccess} />
      )}
      {detalheId && (
        <ImportacaoDetalheModal
          importacaoId={detalheId}
          onClose={() => setDetalheId(null)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
