import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../admin/AdminLayout.jsx";
import AdminSection from "../admin/AdminSection.jsx";
import { adminApi } from "../api.js";

const TABS = [
  { id: "checklist", label: "Checklist" },
  { id: "relatorio", label: "Relatório" },
  { id: "logs", label: "Logs" },
];

// ── Instruções curtas por item (section.key) ─────────────────────────────────

const ITEM_INSTRUCTIONS = {
  "pf.cadastro": "Crie um usuário PF via /registro e conclua o cadastro.",
  "pf.verificacao": "Confirme que o e-mail de verificação chegou e o código funciona.",
  "pf.onboarding": "Faça login com o PF e complete o onboarding.",
  "pf.whatsapp": "Conecte um número WhatsApp e envie uma mensagem de teste.",
  "pf.lancamento_manual": "Crie um lançamento manual e confirme no dashboard.",
  "pf.recorrencia": "Crie uma recorrência e confirme a geração automática.",
  "pf.marcar_pago": "Marque um lançamento como pago e verifique o saldo.",
  "pf.dashboard": "Confirme gráficos, saldo e totais corretos.",
  "pf.pdf": "Exporte o relatório PDF e confira os dados.",
  "pf.portal_cliente": "Acesse Plano/Assinatura no portal do cliente.",
  "pf.pix_mp": "Gere PIX via Mercado Pago e confirme QR + copia-e-cola.",
  "pf.webhook": "Simule pagamento no sandbox e confirme webhook processado.",
  "pf.assinatura_ativa": "Confirme status 'ativa' após pagamento confirmado.",
  "pj.cadastro": "Crie um usuário PJ via /registro.",
  "pj.empresa": "Configure CNPJ, razão social e dados da empresa.",
  "pj.cliente": "Cadastre um cliente e associe a um lançamento.",
  "pj.fornecedor": "Cadastre um fornecedor.",
  "pj.centro_custo": "Crie um centro de custo e associe a lançamentos.",
  "pj.dre": "Acesse o DRE e confirme que os dados estão corretos.",
  "pj.equipe": "Acesse o painel de equipe e veja os membros.",
  "pj.convite": "Convide um membro e aceite o convite recebido.",
  "pj.integracao_pj_pf": "Ative integração PJ→PF e confirme lançamentos espelhados.",
  "pj.pdf": "Exporte PDF PJ e verifique o conteúdo.",
  "pj.portal_cliente": "Acesse portal do cliente como PJ.",
  "pj.pix_mp": "Gere PIX Mercado Pago como PJ.",
  "pj.webhook": "Confirme webhook processado para o perfil PJ.",
  "pj.assinatura_ativa": "Assinatura PJ ficou ativa após pagamento.",
  "pagamento.pix_gerado": "Plano → Assinar → escolha PIX → confirme QR e copia-e-cola.",
  "pagamento.pagamento_aprovado": "No painel do gateway (sandbox), aprove o pagamento e verifique retorno.",
  "pagamento.webhook_processado": "Nos logs, confirme que o webhook chegou sem erro 500.",
  "pagamento.fatura_paga": "Admin → Cliente → Faturas → status deve ser 'paga'.",
  "pagamento.assinatura_ativa": "Admin → Cliente → status da assinatura deve ser 'ativa'.",
  "pagamento.trial_encerrado": "Confirme que o trial foi encerrado e não renova automaticamente.",
  "pagamento.proxima_cobranca": "Admin → Cliente → confirme que proxima_cobrança está definida.",
  "pagamento.webhook_idempotente": "Reenvie o mesmo webhook e confirme que não gera pagamento duplicado.",
  "email.smtp_ok": "Configure SMTP/Resend em .env e confirme envio de e-mail de teste.",
  "email.email_cobranca": "Gere uma cobrança e confirme que o e-mail chegou na caixa de entrada.",
  "email.email_pagamento": "Após pagamento confirmado, verifique e-mail 'Pagamento confirmado'.",
  "email.email_verificacao": "Crie novo usuário e confirme chegada do e-mail de verificação.",
  "whatsapp.conexao": "Conecte uma instância e confirme status 'connected' no painel.",
  "whatsapp.numero_autorizado": "Autorize o número em Admin → WhatsApp → Autorizados.",
  "whatsapp.lancamento_whatsapp": "Envie 'paguei 50 mercado' e confirme lançamento criado.",
  "whatsapp.notificacao_cobranca": "Confirme notificação de cobrança via WhatsApp (se habilitado).",
  "pdf.pdf_pf": "Exporte PDF na tela de relatórios como PF.",
  "pdf.pdf_pj": "Exporte PDF na tela de relatórios como PJ.",
  "pdf.pdf_legivel": "Abra o PDF e confirme dados, formatação e valores.",
  "suporte.pagina_ajuda": "Acesse /ajuda e confirme que a página carrega sem erro.",
  "suporte.contato_suporte": "Use o botão de suporte/contato e confirme que funciona.",
  "suporte.resposta_admin": "Verifique que o admin recebeu e respondeu o ticket.",
  "admin.ver_cliente_pf": "Admin → Clientes → filtre por PF e abra um cliente.",
  "admin.ver_cliente_pj": "Admin → Clientes → filtre por PJ e abra um cliente.",
  "admin.ver_plano": "Confirme que o plano aparece no detalhe do cliente.",
  "admin.ver_fatura": "Confirme que faturas aparecem no detalhe do cliente.",
  "admin.ver_pagamento": "Confirme que pagamentos aparecem no detalhe.",
  "admin.alterar_plano": "Use 'Alterar plano' no admin e confirme mudança efetivada.",
  "admin.reenviar_cobranca": "Use 'Reenviar cobrança' e confirme nova fatura pendente.",
  "admin.marcar_pago_manual": "Use 'Marcar pago' (master) e confirme assinatura ativa.",
  "admin.conferir_mrr_arr": "Admin → SaaS Metrics → confirme MRR e ARR calculados.",
};

// ── Seções e itens críticos ───────────────────────────────────────────────────

const CRITICAL_SECTION_IDS = new Set(["pagamento", "email", "whatsapp"]);
const CRITICAL_ITEM_KEYS = new Set(["webhook", "assinatura_ativa", "webhook_processado"]);

function collectCriticalPending(sections) {
  const out = [];
  for (const sec of sections) {
    for (const item of sec.items) {
      if (item.checked) continue;
      const isCriticalSection = CRITICAL_SECTION_IDS.has(sec.id);
      const isCriticalKey = CRITICAL_ITEM_KEYS.has(item.key);
      if (isCriticalSection || isCriticalKey) {
        out.push({ section: sec, item });
      }
    }
  }
  return out;
}

// ── Exportação ────────────────────────────────────────────────────────────────

function buildProximosPassos(sections) {
  const pendentes = [];
  for (const sec of sections) {
    for (const item of sec.items) {
      if (!item.checked) pendentes.push({ sec, item });
    }
  }
  if (!pendentes.length) return "Todos os passos concluídos!";
  const linhas = pendentes.map(({ sec, item }) => {
    const instr = ITEM_INSTRUCTIONS[`${sec.id}.${item.key}`] || "";
    return `[ ] ${sec.label}: ${item.label}${instr ? `\n    → ${instr}` : ""}`;
  });
  return `Próximos passos pendentes (${pendentes.length}):\n\n${linhas.join("\n\n")}`;
}

function buildMarkdownReport(data) {
  const status = data.meta?.status || "pendente";
  const lines = [
    `# Relatório de Homologação Real — Fluxiva`,
    ``,
    `**Data:** ${new Date().toLocaleDateString("pt-BR")}  `,
    `**Status:** ${status}  `,
    `**Progresso:** ${data.progress.done}/${data.progress.total} (${data.progress.percent}%)  `,
    `**Usuário PF:** ${data.meta?.usuario_pf || "—"}  `,
    `**Usuário PJ:** ${data.meta?.usuario_pj || "—"}  `,
    data.meta?.falhas ? `**Falhas:** ${data.meta.falhas}  ` : "",
    ``,
    `## Pendentes`,
  ];
  let hasPendentes = false;
  for (const sec of data.sections) {
    const pending = sec.items.filter((i) => !i.checked);
    if (!pending.length) continue;
    hasPendentes = true;
    lines.push(`\n### ${sec.label}`);
    for (const item of pending) {
      const instr = ITEM_INSTRUCTIONS[`${sec.id}.${item.key}`] || "";
      lines.push(`- [ ] **${item.label}**${instr ? ` — ${instr}` : ""}`);
    }
  }
  if (!hasPendentes) lines.push("_Nenhum pendente._");
  lines.push(`\n## Concluídos`);
  let hasConcluidos = false;
  for (const sec of data.sections) {
    const done = sec.items.filter((i) => i.checked);
    if (!done.length) continue;
    hasConcluidos = true;
    lines.push(`\n### ${sec.label}`);
    for (const item of done) {
      lines.push(`- [x] ${item.label}${item.checked_at ? ` _(${new Date(item.checked_at).toLocaleString("pt-BR")})_` : ""}`);
    }
  }
  if (!hasConcluidos) lines.push("_Nenhum concluído ainda._");
  return lines.filter((l) => l !== "").join("\n");
}

function copyToClipboard(text, onSuccess) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess, () => onSuccess());
  } else {
    onSuccess();
  }
}

// ── Componentes ───────────────────────────────────────────────────────────────

function SectionChecklist({ section, onToggle }) {
  return (
    <div className="card admin-inner-card">
      <div className="card-title" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span>{section.label}</span>
        <span className="admin-wa-pill admin-wa-pill--ok">
          {section.progress.done}/{section.progress.total}
        </span>
      </div>
      <ul className="admin-checklist">
        {section.items.map((item) => {
          const instr = !item.checked ? ITEM_INSTRUCTIONS[`${section.id}.${item.key}`] : null;
          return (
            <li key={item.key}>
              <label className="admin-checklist-label">
                <input
                  type="checkbox"
                  checked={!!item.checked}
                  onChange={(e) => onToggle(section.id, item.key, e.target.checked)}
                />
                <span>{item.label}</span>
              </label>
              {item.checked_at && (
                <span className="admin-card-hint" style={{ marginLeft: 26, display: "block" }}>
                  {new Date(item.checked_at).toLocaleString("pt-BR")}
                </span>
              )}
              {instr && (
                <span className="admin-card-hint" style={{ marginLeft: 26, display: "block", fontStyle: "italic" }}>
                  {instr}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    aprovado: "admin-wa-pill--ok",
    reprovado: "admin-wa-pill--off",
    pendente: "admin-wa-pill--warn",
  };
  return (
    <span className={`admin-wa-pill ${map[status] || map.pendente}`}>
      {status || "pendente"}
    </span>
  );
}

function CriticalPending({ sections }) {
  const items = collectCriticalPending(sections);
  if (!items.length) return null;
  return (
    <div className="card admin-inner-card" style={{ borderLeft: "3px solid var(--rn-danger, #e53)" }}>
      <div className="card-title" style={{ marginBottom: 8 }}>
        Pendências críticas ({items.length})
      </div>
      <ul className="admin-checklist">
        {items.map(({ section, item }) => {
          const instr = ITEM_INSTRUCTIONS[`${section.id}.${item.key}`] || "";
          return (
            <li key={`${section.id}.${item.key}`}>
              <span style={{ fontWeight: 500 }}>{section.label}: {item.label}</span>
              {instr && (
                <span className="admin-card-hint" style={{ display: "block", fontStyle: "italic" }}>
                  {instr}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AdminRealHomologacaoPage() {
  const [tab, setTab] = useState("checklist");
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [metaForm, setMetaForm] = useState({
    usuario_pf: "",
    usuario_pj: "",
    falhas: "",
    status: "pendente",
  });

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    adminApi
      .realHomologacao()
      .then((d) => {
        setData(d);
        setMetaForm({
          usuario_pf: d.meta?.usuario_pf || "",
          usuario_pj: d.meta?.usuario_pj || "",
          falhas: d.meta?.falhas || "",
          status: d.meta?.status || "pendente",
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadReport = useCallback(() => {
    setBusy(true);
    setError(null);
    adminApi
      .realHomologacaoReport()
      .then(setReport)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === "relatorio") loadReport();
  }, [tab, loadReport]);

  const toggle = async (section, key, checked) => {
    try {
      const d = await adminApi.patchRealHomologacao({ section, key, checked });
      setData(d);
      setMetaForm((m) => ({
        ...m,
        usuario_pf: d.meta?.usuario_pf || "",
        usuario_pj: d.meta?.usuario_pj || "",
        falhas: d.meta?.falhas || "",
        status: d.meta?.status || "pendente",
      }));
    } catch (e) {
      setError(e.message);
    }
  };

  const saveMeta = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const d = await adminApi.patchRealHomologacaoMeta(metaForm);
      setData(d);
      setMsg("Metadados salvos.");
      if (tab === "relatorio") await loadReport();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const exportReport = () => {
    if (!report) return;
    const text = JSON.stringify(report, null, 2);
    navigator.clipboard?.writeText(text).then(
      () => setMsg("Relatório copiado (JSON)."),
      () => setMsg(text.slice(0, 500))
    );
  };

  const copiarProximosPassos = () => {
    if (!data) return;
    const text = buildProximosPassos(data.sections);
    copyToClipboard(text, () => setMsg("Próximos passos copiados."));
  };

  const exportarJSON = () => {
    if (!data) return;
    const payload = {
      gerado_em: new Date().toISOString(),
      status: data.meta?.status || "pendente",
      progress: data.progress,
      meta: data.meta,
      sections: data.sections,
    };
    copyToClipboard(JSON.stringify(payload, null, 2), () => setMsg("Exportado como JSON."));
  };

  const exportarMarkdown = () => {
    if (!data) return;
    copyToClipboard(buildMarkdownReport(data), () => setMsg("Exportado como Markdown."));
  };

  return (
    <AdminLayout
      title="Homologação Real"
      subtitle="Teste ponta a ponta como cliente real antes de abrir o beta."
    >
      <div className="admin-tabs admin-payment-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`admin-tab${tab === t.id ? " admin-tab--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-warn">{error}</div>}
      {msg && !error && <div className="alert alert-success">{msg}</div>}
      {loading && <p className="admin-loading">Carregando…</p>}

      {!loading && data && tab === "checklist" && (
        <>
          <AdminSection
            title="Progresso geral"
            description={`${data.progress.done} de ${data.progress.total} passos (${data.progress.percent}%)`}
          >
            <div className="card admin-inner-card">
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 4,
                      background: "var(--border)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${data.progress.percent}%`,
                        height: "100%",
                        background: "var(--rn-primary)",
                      }}
                    />
                  </div>
                </div>
                <StatusPill status={data.meta?.status} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={copiarProximosPassos}
                >
                  Copiar próximos passos pendentes
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={exportarMarkdown}
                >
                  Exportar Markdown
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={exportarJSON}
                >
                  Exportar JSON
                </button>
              </div>
            </div>
          </AdminSection>

          <AdminSection title="Usuários de teste e parecer" description="Registre quem testou e o resultado final.">
            <div className="card admin-inner-card">
              <div className="form-grid" style={{ gap: 12 }}>
                <label>
                  <span className="form-label">Usuário PF testado</span>
                  <input
                    className="form-input"
                    value={metaForm.usuario_pf}
                    onChange={(e) => setMetaForm((m) => ({ ...m, usuario_pf: e.target.value }))}
                    placeholder="e-mail ou nome do cliente PF"
                  />
                </label>
                <label>
                  <span className="form-label">Usuário PJ testado</span>
                  <input
                    className="form-input"
                    value={metaForm.usuario_pj}
                    onChange={(e) => setMetaForm((m) => ({ ...m, usuario_pj: e.target.value }))}
                    placeholder="e-mail ou razão social"
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  <span className="form-label">Falhas encontradas</span>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={metaForm.falhas}
                    onChange={(e) => setMetaForm((m) => ({ ...m, falhas: e.target.value }))}
                    placeholder="Descreva bugs, bloqueios ou regressões"
                  />
                </label>
                <label>
                  <span className="form-label">Status final</span>
                  <select
                    className="form-input"
                    value={metaForm.status}
                    onChange={(e) => setMetaForm((m) => ({ ...m, status: e.target.value }))}
                  >
                    <option value="pendente">Pendente</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="reprovado">Reprovado</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 12 }}
                disabled={busy}
                onClick={saveMeta}
              >
                Salvar parecer
              </button>
            </div>
          </AdminSection>

          <AdminSection title="Cenários obrigatórios" description="Marque cada passo validado manualmente em produção ou sandbox.">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <CriticalPending sections={data.sections} />
              {data.sections.map((section) => (
                <SectionChecklist key={section.id} section={section} onToggle={toggle} />
              ))}
            </div>
          </AdminSection>
        </>
      )}

      {!loading && tab === "relatorio" && (
        <AdminSection title="Relatório de homologação" description="Resumo para go/no-go do beta.">
          {busy && <p className="admin-loading">Gerando relatório…</p>}
          {!busy && report && (
            <div className="card admin-inner-card">
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <div>
                  <div className="card-title" style={{ marginBottom: 4 }}>
                    Status: <StatusPill status={report.status} />
                  </div>
                  <p className="admin-card-hint" style={{ margin: 0 }}>
                    Gerado em {new Date(report.generated_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <button type="button" className="btn btn-secondary" onClick={exportReport}>
                  Copiar relatório
                </button>
              </div>
              <p><strong>Data:</strong> {report.data}</p>
              <p><strong>Usuário PF:</strong> {report.usuario_testado.pf || "—"}</p>
              <p><strong>Usuário PJ:</strong> {report.usuario_testado.pj || "—"}</p>
              <p>
                <strong>Progresso:</strong> {report.progress.done}/{report.progress.total} ({report.progress.percent}%)
              </p>
              {report.falhas_encontradas.texto && (
                <p><strong>Falhas:</strong> {report.falhas_encontradas.texto}</p>
              )}
              <p className="admin-card-hint">
                Sinais: {report.signals.pagamentos_recentes} pagamentos recentes · SMTP {report.signals.smtp || "—"} ·{" "}
                {report.signals.rc_criticos_pendentes} crítico(s) RC
              </p>
              <div className="card-title" style={{ marginTop: 16 }}>Passos concluídos ({report.passos_concluidos.length})</div>
              <ul className="admin-checklist">
                {report.passos_concluidos.map((p) => (
                  <li key={`${p.section}-${p.key}`}>
                    <span>{p.section_label}: {p.label}</span>
                  </li>
                ))}
              </ul>
              {report.pendentes.length > 0 && (
                <>
                  <div className="card-title" style={{ marginTop: 16 }}>Pendentes ({report.pendentes.length})</div>
                  <ul className="admin-checklist">
                    {report.pendentes.map((p) => (
                      <li key={`${p.section}-${p.key}`}>
                        <span>{p.section_label}: {p.label}</span>
                        {ITEM_INSTRUCTIONS[`${p.section}.${p.key}`] && (
                          <span className="admin-card-hint" style={{ display: "block", fontStyle: "italic" }}>
                            {ITEM_INSTRUCTIONS[`${p.section}.${p.key}`]}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </AdminSection>
      )}

      {!loading && data && tab === "logs" && (
        <AdminSection title="Logs da homologação" description="Últimas ações registradas no checklist.">
          <div className="card admin-inner-card">
            {(data.activity || []).length === 0 && (
              <p className="admin-card-hint">Nenhuma ação registrada ainda.</p>
            )}
            <ul className="admin-checklist">
              {(data.activity || []).map((log, i) => (
                <li key={i}>
                  <span>
                    {new Date(log.at).toLocaleString("pt-BR")} — {log.action}
                    {log.label ? `: ${log.label}` : ""}
                    {log.by ? ` (${log.by})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </AdminSection>
      )}
    </AdminLayout>
  );
}
