/**
 * ConexoesBancariasPage — Open Finance / Conexões Bancárias
 *
 * Etapa 4.6A — Preview OFX (sem gravar lançamentos):
 * - POST /api/importacoes/ofx-preview — parse + deduplicação
 * - Wizard: conta+plano → upload → preview com tabela
 * - Histórico GET (vazio até Etapa 4.6B)
 * - "Avise-me" + roadmap mantidos
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useGestor }      from "../GestorContext.jsx";
import { conexoesApi, importacoesApi } from "../api.js";
import { fmtBRL, fmtDate } from "../finance.js";
import {
  Bell, FileText, Table, PenLine, ArrowRight, Link2, AlertCircle,
  Upload, CheckCircle, XCircle, Clock, ChevronLeft,
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
  { fase: "Disponível", data: "Agora",     titulo: "Preview OFX / QIF",         descricao: "Análise de extrato com deduplicação — gravação na Etapa 4.6B", done: true  },
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

function OFXWizard({ contas, planoContas, onClose }) {
  const [step, setStep]           = useState(1);
  const [contaId, setContaId]     = useState(contas[0]?.id || "");
  const [planoId, setPlanoId]     = useState("");
  const [file, setFile]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [resultado, setResultado] = useState(null);
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
    try {
      const fileContent = await file.text();
      const res = await importacoesApi.previewOFX(contaId, planoId || null, file.name, fileContent);
      setResultado(res);
      setStep(3);
    } catch (err) {
      setErro(err.message || "Erro ao analisar o arquivo. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const stepTitle = step === 1 ? "Preview OFX — Configuracao"
                  : step === 2 ? "Preview OFX — Upload"
                  : "Preview OFX — Resultado";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: step === 3 ? 720 : 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {step > 1 && step < 3 && (
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
                O servidor analisa e detecta duplicatas — <strong>nenhum lancamento sera gravado</strong> nesta etapa.
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
              <div className="alert alert-info" style={{ margin: 0, fontSize: 12 }}>
                <strong>Modo preview (Etapa 4.6A):</strong> nenhum lancamento foi gravado.
                A confirmacao e gravacao real virao na Etapa 4.6B.
              </div>
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
                            color: tx.tipo === "receita" ? "var(--success-fg)" : "var(--danger-fg)",
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
          ) : (
            <button type="button" className="btn btn-primary" onClick={onClose}>Fechar</button>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoricoImportacoes({ importacoes, loading, erro }) {
  if (loading) return (
    <div style={{ padding: "20px 0", color: "var(--muted-foreground)", fontSize: 13 }}>Carregando historico...</div>
  );
  if (erro) return <div className="alert alert-warn">{erro}</div>;
  if (!importacoes.length) return (
    <div style={{ padding: "20px 0", color: "var(--muted-foreground)", fontSize: 13 }}>
      Nenhuma importacao confirmada ainda. O preview (Etapa 4.6A) nao grava historico —
      use &quot;Importar OFX&quot; acima para validar parser e deduplicacao.
    </div>
  );
  const statusIcon = (s) => {
    if (s === "sucesso") return <CheckCircle size={14} strokeWidth={2} style={{ color: "var(--success-fg)" }} />;
    if (s === "parcial") return <Clock size={14} strokeWidth={2} style={{ color: "var(--warning-fg)" }} />;
    return <XCircle size={14} strokeWidth={2} style={{ color: "var(--danger-fg)" }} />;
  };
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th><th>Arquivo</th><th>Banco</th>
            <th style={{ textAlign: "right" }}>Importados</th>
            <th style={{ textAlign: "right" }}>Duplicados</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {importacoes.map((imp) => (
            <tr key={imp.id}>
              <td className="td-mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtData(imp.created_at)}</td>
              <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={imp.nome_arquivo || ""}>
                {imp.nome_arquivo || <span style={{ color: "var(--muted-foreground)" }}>—</span>}
              </td>
              <td>
                {imp.banco_slug
                  ? <span className="badge badge-blue" style={{ textTransform: "capitalize" }}>{imp.banco_slug}</span>
                  : <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>—</span>}
              </td>
              <td className="td-mono" style={{ textAlign: "right", color: "var(--success-fg)" }}>{imp.importados}</td>
              <td className="td-mono" style={{ textAlign: "right", color: "var(--muted-foreground)" }}>{imp.duplicatas}</td>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {statusIcon(imp.status)}
                  <span style={{ fontSize: 12, textTransform: "capitalize" }}>{imp.status}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ConexoesBancariasPage({ onNavigate }) {
  const { tipo, viewOnly, contas, planoContas } = useGestor();
  const isPF = tipo === "fisica";

  const [avisados, setAvisados]               = useState(new Set());
  const [loadingInteresse, setLoadingInteresse] = useState(true);
  const [savingSlug, setSavingSlug]           = useState(null);
  const [interesseError, setInteresseError]   = useState(null);
  const [wizardOpen, setWizardOpen]           = useState(false);
  const [importacoes, setImportacoes]         = useState([]);
  const [loadingHist, setLoadingHist]         = useState(true);
  const [histErro, setHistErro]               = useState(null);

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
      const { importacoes: list } = await importacoesApi.list();
      setImportacoes(list || []);
    } catch { setHistErro("Nao foi possivel carregar o historico."); }
    finally { setLoadingHist(false); }
  }, []);

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

  const totalAvisados = avisados.size;

  return (
    <div className="of-page">

      <div className="of-status-banner" role="status">
        <AlertCircle size={18} strokeWidth={2} aria-hidden />
        <div>
          <strong>Conexao automatica ainda nao disponivel.</strong>
          {" "}Preview OFX com deduplicacao esta disponivel (sem gravar lancamentos).
          Confirmacao na Etapa 4.6B; Open Finance no roadmap.
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
            Analise extratos OFX com deduplicacao antes de gravar lancamentos.
            A integracao com Open Finance Brasil esta planejada para 2026.
          </p>
          <div className="of-hero-chips">
            <span className="of-chip">Deduplicacao por FITID</span>
            <span className="of-chip">Preview sem gravacao</span>
            <span className="of-chip">Sem armazenar senhas</span>
            <span className="of-chip">Open Finance (futuro)</span>
          </div>
        </div>
      </div>

      <div className="of-section">
        <div className="of-section-header">
          <div>
            <div className="of-section-title">Preview de extrato OFX / QIF</div>
            <div className="of-section-sub">
              Envie o arquivo para ver transacoes, novas e duplicadas — sem alterar Lancamentos.
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
          Importacoes confirmadas (Etapa 4.6B). O preview atual nao preenche esta lista.
        </div>
        <HistoricoImportacoes importacoes={importacoes} loading={loadingHist} erro={histErro} />
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
          Preview OFX disponivel; gravacao confirmada na proxima etapa.
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
          onClose={() => setWizardOpen(false)} />
      )}
    </div>
  );
}
