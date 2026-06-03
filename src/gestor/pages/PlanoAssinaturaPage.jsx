import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { billingApi } from "../api.js";
import { AlertTriangle } from "../components/icons.jsx";
import PlanLimitNotice from "../components/PlanLimitNotice.jsx";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

function formatCentavos(centavos) {
  if (centavos == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    centavos / 100
  );
}

function formatAddonPreco(centavos) {
  if (!centavos) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    centavos / 100
  );
}

const STATUS_LABEL = {
  trial: "Período de teste",
  ativa: "Ativa",
  atrasada: "Pagamento em atraso",
  cancelada: "Cancelada",
  vencida: "Vencida",
};

const FATURA_STATUS = {
  pendente: "Pendente",
  paga: "Paga",
  cancelada: "Cancelada",
  vencida: "Vencida",
};

const PAGAMENTO_STATUS = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  estornado: "Estornado",
};

function RecursosList({ recursos }) {
  if (!recursos) return null;

  const items = [
    recursos.limiteUsuarios != null ? `${recursos.limiteUsuarios} usuário(s)` : null,
    recursos.limiteWhatsappNumeros != null
      ? `${recursos.limiteWhatsappNumeros} número(s) WhatsApp`
      : null,
    recursos.limiteLancamentos == null
      ? "Lançamentos ilimitados"
      : `Até ${recursos.limiteLancamentos} lançamentos`,
    recursos.whatsappTexto ? "WhatsApp: texto" : null,
    recursos.whatsappAudio ? "WhatsApp: áudio" : null,
    recursos.whatsappComprovante ? "WhatsApp: comprovante" : null,
    recursos.iaComprovante ? "Leitura de comprovante (IA)" : null,
    recursos.centroCusto ? "Centro de custo" : null,
    recursos.dreCompleto ? "DRE completo" : recursos.segmento === "pj" && recursos.centroCusto ? "DRE simplificado" : null,
    recursos.projetos ? "Projetos financeiros" : null,
    recursos.integracaoPfPj ? "Integração PF/PJ" : null,
    recursos.apiAccess ? "API access" : null,
    recursos.suportePrioritario ? "Suporte prioritário" : null,
    recursos.openFinance ? "Open Finance (incluso)" : null,
  ].filter(Boolean);

  const addon = recursos.openFinanceAddon;
  if (addon && !recursos.openFinance) {
    items.push(
      `Open Finance add-on (em breve${addon.futuroPrecoSugeridoCentavos ? ` · ${formatAddonPreco(addon.futuroPrecoSugeridoCentavos)}` : ""})`
    );
  }

  if (recursos._premiumBloqueado) {
    items.push("Recursos premium limitados (regularize a assinatura)");
  }

  return (
    <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--muted)" }}>
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export default function PlanoAssinaturaPage() {
  const { user } = useAuth();
  const [assinatura, setAssinatura] = useState(null);
  const [planos, setPlanos] = useState([]);
  const [faturas, setFaturas] = useState([]);
  const [pagamentos, setPagamentos] = useState([]);
  const [pagamentosReais, setPagamentosReais] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(null);
  const [pixCheckout, setPixCheckout] = useState(null);
  const [showHistorico, setShowHistorico] = useState(false);
  const [usage, setUsage] = useState(null);

  const segmentoLabel =
    user?.tipo_perfil === "fisica" ? "Pessoa Física (PF)" : "Pessoa Jurídica (PJ)";

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [sub, plans, fat, pays, uso] = await Promise.all([
        billingApi.assinatura(),
        billingApi.planos(),
        billingApi.faturas().catch(() => ({ faturas: [] })),
        billingApi.pagamentos().catch(() => ({ pagamentos: [] })),
        billingApi.usage().catch(() => null),
      ]);
      setAssinatura(sub.assinatura);
      setUsage(uso);
      setPagamentosReais(Boolean(sub.pagamentos_reais ?? plans.pagamentos_reais));
      setPlanos(plans.planos || []);
      setFaturas(fat.faturas || []);
      setPagamentos(pays.pagamentos || []);
    } catch (e) {
      setError(e.message || "Erro ao carregar planos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSimulate = async (slug) => {
    if (slug === assinatura?.plano?.slug) return;
    setMsg("");
    setError("");
    setBusy(slug);
    try {
      const data = await billingApi.simularUpgrade(slug);
      setMsg(data.message || "Plano atualizado (simulação).");
      setAssinatura(data.assinatura);
      setPixCheckout(null);
      await load();
    } catch (e) {
      setError(e.message || "Falha ao simular upgrade.");
    } finally {
      setBusy(null);
    }
  };

  const handleCheckout = async (slug) => {
    if (slug === assinatura?.plano?.slug && assinatura?.status === "ativa") return;
    setMsg("");
    setError("");
    setBusy(`checkout-${slug}`);
    try {
      const data = await billingApi.checkout(slug);
      setPixCheckout(data);
      setMsg("Cobrança PIX gerada. Pague para ativar o plano automaticamente.");
      await load();
    } catch (e) {
      setError(e.message || "Falha ao gerar checkout.");
    } finally {
      setBusy(null);
    }
  };

  const handleCancelar = async () => {
    if (!window.confirm("Cancelar assinatura? O acesso continua até o fim do período já pago.")) {
      return;
    }
    setMsg("");
    setError("");
    setBusy("cancelar");
    try {
      const data = await billingApi.cancelar();
      setMsg(data.message || "Assinatura cancelada.");
      setAssinatura(data.assinatura);
      await load();
    } catch (e) {
      setError(e.message || "Falha ao cancelar.");
    } finally {
      setBusy(null);
    }
  };

  const currentSlug = assinatura?.plano?.slug;
  const canCancel =
    assinatura &&
    ["ativa", "atrasada", "trial"].includes(assinatura.status);

  const usageRows = [
    { key: "lancamentos", label: "Lançamentos" },
    { key: "clientes", label: "Clientes" },
    { key: "projetos", label: "Projetos" },
    { key: "centrosCusto", label: "Centros de custo" },
    { key: "whatsappNumeros", label: "Números WhatsApp" },
  ];

  return (
    <div>
      <PlanLimitNotice />
      {!pagamentosReais && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            borderColor: "var(--amber-dark, #b45309)",
            background: "oklch(0.98 0.02 85)",
          }}
        >
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={18} strokeWidth={2} aria-hidden />
            Cobrança real não configurada
          </div>
          <p style={{ fontSize: 13, margin: 0, color: "var(--muted)" }}>
            Configure ASAAS_API_KEY no servidor para PIX e webhooks. A simulação de planos continua
            disponível em ambiente de teste.
          </p>
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: "var(--muted)" }}>Carregando…</p>}

      {error && (
        <div className="login-error" style={{ marginBottom: 12 }}>
          <AlertTriangle size={15} strokeWidth={2} aria-hidden />
          <span>{error}</span>
        </div>
      )}
      {msg && (
        <div style={{ marginBottom: 12, fontSize: 13, color: "var(--green-dark)" }}>{msg}</div>
      )}

      {pixCheckout?.pix?.copy_paste && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">PIX — pagamento pendente</div>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            Plano: {pixCheckout.plano_slug} · Vencimento: {formatDate(pixCheckout.vencimento)}
          </p>
          <textarea
            readOnly
            value={pixCheckout.pix.copy_paste}
            rows={4}
            style={{ width: "100%", fontSize: 11, marginTop: 8 }}
          />
          {pixCheckout.pix.encoded_image && (
            <img
              src={`data:image/png;base64,${pixCheckout.pix.encoded_image}`}
              alt="QR Code PIX"
              style={{ maxWidth: 200, marginTop: 8 }}
            />
          )}
        </div>
      )}

      {usage && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Uso do plano</div>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px" }}>
            Status: {STATUS_LABEL[usage.status] || usage.status} · Plano {usage.plano?.nome}
          </p>
          <table className="data-table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th>Recurso</th>
                <th>Em uso</th>
                <th>Limite</th>
              </tr>
            </thead>
            <tbody>
              {usageRows.map(({ key, label }) => {
                const usado = usage.uso?.[key] ?? 0;
                const lim = usage.limites?.[key];
                return (
                  <tr key={key}>
                    <td>{label}</td>
                    <td>{usado}</td>
                    <td>{lim == null ? "Ilimitado" : lim}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {assinatura && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Plano e assinatura</div>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 10px" }}>
            Perfil: {segmentoLabel}
          </p>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <div className="form-label">Plano</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{assinatura.plano?.nome}</div>
            </div>
            <div>
              <div className="form-label">Status</div>
              <div style={{ fontSize: 14 }}>
                {STATUS_LABEL[assinatura.status] || assinatura.status}
              </div>
            </div>
            <div>
              <div className="form-label">Trial até</div>
              <div style={{ fontSize: 14 }}>{formatDate(assinatura.trial_ate)}</div>
            </div>
            <div>
              <div className="form-label">Válido até</div>
              <div style={{ fontSize: 14 }}>{formatDate(assinatura.fim_em)}</div>
            </div>
            <div>
              <div className="form-label">Próxima cobrança</div>
              <div style={{ fontSize: 14 }}>{formatDate(assinatura.proxima_cobranca)}</div>
            </div>
            <div>
              <div className="form-label">Acesso até (cancelamento)</div>
              <div style={{ fontSize: 14 }}>{formatDate(assinatura.acesso_ate)}</div>
            </div>
          </div>
          <RecursosList recursos={assinatura.recursos} />
          {assinatura.avisos?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {assinatura.avisos.map((a) => (
                <p
                  key={a}
                  style={{ fontSize: 12, color: "var(--amber-dark, #b45309)", margin: "4px 0" }}
                >
                  {a}
                </p>
              ))}
            </div>
          )}
          {canCancel && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: 12 }}
              disabled={!!busy}
              onClick={handleCancelar}
            >
              {busy === "cancelar" ? "Cancelando…" : "Cancelar assinatura"}
            </button>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Planos disponíveis ({segmentoLabel})</div>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {planos.map((p) => {
            const isCurrent = p.slug === currentSlug && assinatura?.status !== "trial";
            const isTrialCurrent = p.slug === currentSlug && assinatura?.status === "trial";
            return (
              <div
                key={p.id}
                className="card"
                style={{
                  margin: 0,
                  border: isCurrent ? "2px solid var(--green-dark)" : undefined,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 16 }}>{p.nome}</div>
                <div style={{ fontSize: 20, margin: "8px 0" }}>{p.preco_formatado}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {p.intervalo === "anual" ? "Cobrança anual" : "Cobrança mensal"}
                </div>
                <p style={{ fontSize: 13, color: "var(--muted)", minHeight: 40 }}>{p.descricao}</p>
                <RecursosList recursos={p.recursos} />
                {isCurrent ? (
                  <span style={{ fontSize: 12, color: "var(--green-dark)" }}>Plano atual</span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                    {pagamentosReais && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ width: "100%" }}
                        disabled={!!busy}
                        onClick={() => handleCheckout(p.slug)}
                      >
                        {busy === `checkout-${p.slug}` ? "Gerando PIX…" : "Assinar plano"}
                      </button>
                    )}
                    {pagamentosReais && assinatura?.status === "ativa" && !isTrialCurrent && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: "100%" }}
                        disabled={!!busy}
                        onClick={() => handleCheckout(p.slug)}
                      >
                        {busy === `checkout-${p.slug}` ? "Gerando…" : "Trocar plano"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: "100%" }}
                      disabled={!!busy}
                      onClick={() => handleSimulate(p.slug)}
                    >
                      {busy === p.slug ? "Simulando…" : "Simular upgrade"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setShowHistorico((v) => !v)}
        >
          {showHistorico ? "Ocultar histórico" : "Ver histórico de faturas e pagamentos"}
        </button>
        {showHistorico && (
          <div style={{ marginTop: 16 }}>
            <div className="card-title" style={{ fontSize: 14 }}>
              Faturas
            </div>
            {faturas.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhuma fatura.</p>
            ) : (
              <table className="data-table" style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Pago em</th>
                  </tr>
                </thead>
                <tbody>
                  {faturas.map((f) => (
                    <tr key={f.id}>
                      <td>{formatDate(f.vencimento)}</td>
                      <td>{formatCentavos(f.valor_centavos)}</td>
                      <td>{FATURA_STATUS[f.status] || f.status}</td>
                      <td>{formatDate(f.pago_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="card-title" style={{ fontSize: 14, marginTop: 16 }}>
              Pagamentos
            </div>
            {pagamentos.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhum pagamento.</p>
            ) : (
              <table className="data-table" style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pagamentos.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDate(p.created_at)}</td>
                      <td>{formatCentavos(p.valor_centavos)}</td>
                      <td>{PAGAMENTO_STATUS[p.status] || p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
