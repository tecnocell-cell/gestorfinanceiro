/**
 * PlanilhaImportWizard — importação CSV/XLSX com mapeamento (Etapa 4.7)
 */
import { useState, useRef } from "react";
import { importacoesApi } from "../api.js";
import { fmtBRL, fmtDate } from "../finance.js";
import { Upload, CheckCircle, Clock, ChevronLeft } from "../components/icons.jsx";

async function readPlanilhaFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (ext === "csv" || ext === "txt") {
    return { format: "csv", content: await file.text() };
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return { format: "xlsx", content: btoa(binary) };
}

function PreviewTable({ transacoes }) {
  if (!transacoes?.length) return null;
  return (
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
          {transacoes.map((tx, i) => (
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
  );
}

function StatsCards({ total, novas, duplicadas, labels = {} }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
      <div style={{ background: "var(--rn-page-canvas)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 14px", textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--foreground)" }}>
          {total}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600, marginTop: 2 }}>
          {labels.total || "Total"}
        </div>
      </div>
      <div style={{ background: "var(--success-soft)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 14px", textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--success-fg)" }}>
          {novas}
        </div>
        <div style={{ fontSize: 11, color: "var(--success-fg)", fontWeight: 600, marginTop: 2 }}>
          {labels.novas || "Novas"}
        </div>
      </div>
      <div style={{ background: "var(--warning-soft)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "12px 14px", textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--warning-fg)" }}>
          {duplicadas}
        </div>
        <div style={{ fontSize: 11, color: "var(--warning-fg)", fontWeight: 600, marginTop: 2 }}>
          {labels.duplicadas || "Duplicadas"}
        </div>
      </div>
    </div>
  );
}

export default function PlanilhaImportWizard({ contas, planoContas, onClose, onSuccess }) {
  const [step, setStep]               = useState(1);
  const [contaId, setContaId]         = useState(contas[0]?.id || "");
  const [planoId, setPlanoId]         = useState("");
  const [file, setFile]               = useState(null);
  const [fileFormat, setFileFormat]     = useState(null);
  const [fileContent, setFileContent]   = useState("");
  const [headers, setHeaders]           = useState([]);
  const [previewRows, setPreviewRows]   = useState([]);
  const [columnMap, setColumnMap]       = useState({ data: "", historico: "", valor: "", tipo: "" });
  const [loading, setLoading]           = useState(false);
  const [confirmando, setConfirmando]   = useState(false);
  const [resultado, setResultado]       = useState(null);
  const [confirmacao, setConfirmacao]   = useState(null);
  const [erro, setErro]                 = useState(null);
  const fileRef                         = useRef();

  const contasAtivas = contas.filter((c) => !c.inativo);
  const isXlsx = fileFormat === "xlsx";

  const previewApi = isXlsx ? importacoesApi.previewXLSX : importacoesApi.previewCSV;
  const confirmApi = isXlsx ? importacoesApi.confirmarXLSX : importacoesApi.confirmarCSV;

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setErro(null);
    setResultado(null);
    setConfirmacao(null);
  };

  const loadStructure = async () => {
    if (!file) { setErro("Selecione um arquivo CSV ou XLSX."); return false; }
    setLoading(true);
    setErro(null);
    try {
      const { format, content } = await readPlanilhaFile(file);
      setFileFormat(format);
      setFileContent(content);
      const res = await previewApi(contaId, planoId || null, file.name, content, null);
      setHeaders(res.headers || []);
      setPreviewRows(res.previewRows || []);
      const suggested = res.suggestedMapping || {};
      setColumnMap({
        data: suggested.data || "",
        historico: suggested.historico || "",
        valor: suggested.valor || "",
        tipo: suggested.tipo || "",
      });
      return true;
    } catch (err) {
      setErro(err.message || "Erro ao ler o arquivo.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleGoToMapping = async () => {
    if (!contaId) { setErro("Selecione a conta bancaria."); return; }
    const ok = await loadStructure();
    if (ok) setStep(3);
  };

  const handlePreview = async () => {
    if (!columnMap.data || !columnMap.valor || !columnMap.historico) {
      setErro("Mapeie as colunas data, valor e historico.");
      return;
    }
    setLoading(true);
    setErro(null);
    setConfirmacao(null);
    try {
      const res = await previewApi(
        contaId,
        planoId || null,
        file?.name || "planilha",
        fileContent,
        columnMap
      );
      setResultado(res);
      setStep(4);
    } catch (err) {
      setErro(err.message || "Erro ao analisar transacoes.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmar = async () => {
    if (!fileContent || !contaId) return;
    setConfirmando(true);
    setErro(null);
    try {
      const res = await confirmApi(
        contaId,
        planoId || null,
        file?.name || "planilha",
        fileContent,
        columnMap
      );
      setConfirmacao(res);
      setStep(5);
      onSuccess?.();
    } catch (err) {
      setErro(err.message || "Erro ao confirmar importacao.");
    } finally {
      setConfirmando(false);
    }
  };

  const stepTitle = step === 1 ? "Importar CSV/XLSX — Configuracao"
                  : step === 2 ? "Importar CSV/XLSX — Upload"
                  : step === 3 ? "Importar CSV/XLSX — Mapeamento"
                  : step === 4 ? "Importar CSV/XLSX — Preview"
                  : "Importacao concluida";

  const mappingReady = columnMap.data && columnMap.valor && columnMap.historico;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: step >= 3 ? 760 : 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {step > 1 && step < 5 && (
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
                Importe extratos em planilha CSV ou XLSX. Voce podera mapear as colunas antes de confirmar.
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
                  fontSize: 13, fontWeight: 500, color: "var(--muted-foreground)",
                  cursor: "pointer", userSelect: "none", listStyle: "none",
                }}>
                  Configurações avançadas
                </summary>
                <div className="form-group" style={{ marginTop: 14, marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 500, color: "var(--muted-foreground)" }}>
                    Categoria / Plano padrão <span style={{ fontWeight: 400 }}>(opcional)</span>
                  </label>
                  <select className="form-select" value={planoId} onChange={(e) => setPlanoId(e.target.value)}>
                    <option value="">Nenhuma — classificar depois</option>
                    {planoContas.filter((p) => !p.inativo).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.icone ? p.icone + " " : ""}{p.descricao} — {p.tipo}
                      </option>
                    ))}
                  </select>
                </div>
              </details>
              {erro && <div className="alert alert-warn" style={{ margin: 0 }}>{erro}</div>}
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55, margin: 0 }}>
                Selecione o arquivo <strong>.csv</strong> ou <strong>.xlsx</strong> exportado pelo banco.
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
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Clique para selecionar</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Suporta .csv e .xlsx</div>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls,.CSV,.XLSX,.XLS" hidden onChange={handleFile} />
              </div>
              {erro && <div className="alert alert-warn" style={{ margin: 0 }}>{erro}</div>}
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.55, margin: 0 }}>
                Associe cada campo as colunas da planilha. Coluna <strong>tipo</strong> e opcional
                (Entrada/Saida); sem ela, valores positivos viram Entrada e negativos Saída.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                {[
                  { key: "data", label: "Data *" },
                  { key: "historico", label: "Historico / Descricao *" },
                  { key: "valor", label: "Valor *" },
                  { key: "tipo", label: "Tipo (opcional)" },
                ].map(({ key, label }) => (
                  <div className="form-group" key={key} style={{ margin: 0 }}>
                    <label className="form-label">{label}</label>
                    <select className="form-select" value={columnMap[key] || ""}
                      onChange={(e) => setColumnMap((m) => ({ ...m, [key]: e.target.value }))}>
                      <option value="">{key === "tipo" ? "Nenhuma" : "Selecione..."}</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {previewRows.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                    Primeiras linhas ({previewRows.length} de amostra)
                  </div>
                  <div className="table-wrap" style={{ maxHeight: 180, overflow: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          {headers.map((h) => <th key={h}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i}>
                            {headers.map((h) => (
                              <td key={h} style={{ fontSize: 12, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                  title={row[h] || ""}>
                                {row[h] || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {erro && <div className="alert alert-warn" style={{ margin: 0 }}>{erro}</div>}
            </div>
          )}

          {step === 4 && resultado && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {resultado.novas > 0 ? (
                <div className="alert alert-info" style={{ margin: 0, fontSize: 12 }}>
                  Revise as transacoes. Somente as <strong>novas</strong> serao gravadas ao confirmar.
                </div>
              ) : (
                <div className="alert alert-warn" style={{ margin: 0, fontSize: 12 }}>
                  Todas as transacoes desta planilha ja foram importadas.
                </div>
              )}
              <StatsCards total={resultado.total} novas={resultado.novas} duplicadas={resultado.duplicadas} />
              <PreviewTable transacoes={resultado.transacoes} />
              {erro && <div className="alert alert-warn" style={{ margin: 0 }}>{erro}</div>}
            </div>
          )}

          {step === 5 && confirmacao && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
                {confirmacao.importados > 0
                  ? <CheckCircle size={40} strokeWidth={1.5} style={{ color: "var(--success-fg)", flexShrink: 0 }} />
                  : <Clock size={40} strokeWidth={1.5} style={{ color: "var(--warning-fg)", flexShrink: 0 }} />
                }
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>
                    {confirmacao.importados > 0 ? "Importacao concluida" : "Nenhuma transacao nova importada"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 2 }}>
                    {confirmacao.importados > 0
                      ? "Dashboard e Lancamentos ja refletem os novos registros."
                      : "Todas as transacoes ja constavam no sistema."}
                  </div>
                </div>
              </div>
              <StatsCards
                total={confirmacao.total}
                novas={confirmacao.importados}
                duplicadas={confirmacao.duplicados}
                labels={{ total: "Total", novas: "Importados", duplicadas: "Duplicados" }}
              />
              {confirmacao.loteId && (
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
                  Lote: {confirmacao.loteId}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step < 4 ? (
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
                  onClick={handleGoToMapping}>
                  {loading ? "Lendo arquivo..." : "Proximo"}
                </button>
              )}
              {step === 3 && (
                <button type="button" className="btn btn-primary" disabled={!mappingReady || loading}
                  onClick={handlePreview}>
                  {loading ? "Analisando..." : "Ver preview"}
                </button>
              )}
            </>
          ) : step === 4 ? (
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
