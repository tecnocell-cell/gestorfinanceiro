import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { billingApi } from "../api.js";
import { AlertTriangle, CircleCheck, Sparkles } from "../components/icons.jsx";
import PlanLimitNotice from "../components/PlanLimitNotice.jsx";
import {
  PLAN_BADGES,
  planIconSlug,
  buildPlanFeatureItems,
  usageMetric,
} from "../planBillingUi.js";

const PAGE_CSS = `
.plan-page-header { margin-bottom: 20px; }
.plan-page-title { font-size: 1.5rem; font-weight: 700; margin: 0 0 4px; }
.plan-page-sub { font-size: 13px; color: var(--muted); margin: 0; }

.plan-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.plan-summary-item {
  background: linear-gradient(145deg, oklch(0.98 0.01 150), oklch(0.96 0.02 155));
  border: 1px solid oklch(0.92 0.02 150);
  border-radius: 14px;
  padding: 14px 16px;
  min-height: 72px;
}
.plan-summary-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 6px;
}
.plan-summary-value { font-size: 15px; font-weight: 700; color: var(--text); line-height: 1.3; }
.plan-summary-value--muted { font-size: 13px; font-weight: 600; color: var(--muted); }

.plan-cards-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  align-items: stretch;
}
.plan-card {
  display: flex;
  flex-direction: column;
  margin: 0;
  border-radius: 18px;
  border: 1px solid oklch(0.9 0.015 150);
  padding: 0;
  overflow: hidden;
  min-height: 420px;
  background: #fff;
  box-shadow: 0 8px 24px oklch(0.45 0.04 155 / 0.08);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.plan-card:hover { transform: translateY(-3px); box-shadow: 0 14px 32px oklch(0.4 0.05 155 / 0.12); }
.plan-card--current {
  border: 2px solid var(--green-dark, #166534);
  box-shadow: 0 12px 28px oklch(0.45 0.08 155 / 0.18);
}
.plan-card--highlight {
  background: linear-gradient(165deg, oklch(0.28 0.06 155), oklch(0.22 0.05 160));
  border-color: transparent;
  color: #fff;
}
.plan-card-head {
  padding: 20px 20px 12px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.plan-card-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: oklch(0.96 0.03 155);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.plan-card--highlight .plan-card-icon { background: oklch(1 0 0 / 0.12); }
.plan-card-icon img { width: 28px; height: 28px; object-fit: contain; }
.plan-card-title { font-size: 17px; font-weight: 700; margin: 0; line-height: 1.2; }
.plan-card-tagline { font-size: 12px; margin: 4px 0 0; opacity: 0.85; }
.plan-card-price-row {
  padding: 0 20px 12px;
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}
.plan-card-price { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
.plan-card-interval { font-size: 12px; opacity: 0.75; }
.plan-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 999px;
  margin-left: auto;
}
.plan-badge--popular { background: linear-gradient(135deg, #86efac, #22c55e); color: #042817; }
.plan-badge--premium { background: oklch(0.92 0.04 85); color: oklch(0.35 0.08 85); }
.plan-badge--business { background: oklch(0.35 0.06 260); color: #fff; }
.plan-card--highlight .plan-badge--popular { box-shadow: 0 4px 12px oklch(0 0 0 / 0.2); }
.plan-features {
  list-style: none;
  margin: 0;
  padding: 12px 20px;
  flex: 1;
}
.plan-features li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.45;
  margin-bottom: 8px;
  color: var(--muted);
}
.plan-card--highlight .plan-features li { color: oklch(0.95 0.02 150); }
.plan-features li svg { flex-shrink: 0; margin-top: 2px; color: var(--green-dark, #166534); }
.plan-card--highlight .plan-features li svg { color: #86efac; }
.plan-card-actions {
  padding: 16px 20px 20px;
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.plan-current-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--green-dark);
  background: oklch(0.95 0.04 150);
  border-radius: 999px;
  padding: 8px 12px;
}
.plan-empty-hint {
  padding: 24px;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
  border: 1px dashed oklch(0.85 0.02 150);
  border-radius: 14px;
}
`;

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

function PlanBadge({ slug, highlight }) {
  const badge = PLAN_BADGES[slug];
  if (!badge) return null;
  const cls =
    badge.tone === "business"
      ? "plan-badge plan-badge--business"
      : badge.tone === "premium"
        ? "plan-badge plan-badge--premium"
        : "plan-badge plan-badge--popular";
  return (
    <span className={cls}>
      {badge.tone === "popular" && <Sparkles size={12} aria-hidden />}
      {badge.label}
    </span>
  );
}

function PlanFeatureList({ recursos, highlight }) {
  const items = buildPlanFeatureItems(recursos);
  if (!items.length) {
    return (
      <p style={{ fontSize: 13, color: "var(--muted)", padding: "0 20px" }}>
        Recursos do plano indisponíveis. Execute as migrations 024 e 027 no servidor.
      </p>
    );
  }
  return (
    <ul className="plan-features">
      {items.map((text) => (
        <li key={text}>
          <CircleCheck size={16} strokeWidth={2} aria-hidden />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

function PlanCard({
  plano,
  assinatura,
  currentSlug,
  pagamentosReais,
  busy,
  onSimulate,
  onCheckout,
}) {
  const isCurrent = plano.slug === currentSlug && assinatura?.status !== "trial";
  const isTrialCurrent = plano.slug === currentSlug && assinatura?.status === "trial";
  const highlight = Boolean(PLAN_BADGES[plano.slug]?.tone === "popular");
  const cardClass = [
    "plan-card",
    isCurrent || isTrialCurrent ? "plan-card--current" : "",
    highlight ? "plan-card--highlight" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass}>
      <div className="plan-card-head">
        <div className="plan-card-icon">
          <img src={planIconSlug(plano.slug)} alt="" aria-hidden />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="plan-card-title">{plano.nome}</h3>
          <p className="plan-card-tagline">{plano.descricao || "Plano Fluxiva"}</p>
        </div>
        <PlanBadge slug={plano.slug} highlight={highlight} />
      </div>
      <div className="plan-card-price-row">
        <span className="plan-card-price">{plano.preco_formatado}</span>
        <span className="plan-card-interval">
          /{plano.intervalo === "anual" ? "ano" : "mês"}
        </span>
      </div>
      <PlanFeatureList recursos={plano.recursos} highlight={highlight} />
      <div className="plan-card-actions">
        {isCurrent || isTrialCurrent ? (
          <span className="plan-current-pill">
            <CircleCheck size={14} aria-hidden />
            {isTrialCurrent ? "Plano do trial" : "Plano atual"}
          </span>
        ) : (
          <>
            {pagamentosReais && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "100%" }}
                disabled={!!busy}
                onClick={() => onCheckout(plano.slug)}
              >
                {busy === `checkout-${plano.slug}` ? "Gerando PIX…" : "Assinar plano"}
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: "100%" }}
              disabled={!!busy}
              onClick={() => onSimulate(plano.slug)}
            >
              {busy === plano.slug ? "Simulando…" : "Simular upgrade"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PlanSummaryBar({ assinatura, usage, segmentoLabel }) {
  if (!assinatura) return null;
  const usuarios = usageMetric(usage?.uso?.usuarios, true);
  const whatsapp = usageMetric(usage?.uso?.whatsappNumeros, false);
  const waLim = usage?.limites?.whatsappNumeros ?? whatsapp.limite;

  const items = [
    { label: "Plano atual", value: assinatura.plano?.nome || "—" },
    { label: "Status", value: STATUS_LABEL[assinatura.status] || assinatura.status },
    { label: "Trial até", value: formatDate(assinatura.trial_ate) },
    { label: "Próxima cobrança", value: formatDate(assinatura.proxima_cobranca) },
    {
      label: "Usuários",
      value:
        usuarios.limite != null
          ? `${usuarios.usado} / ${usuarios.limite}`
          : `${usuarios.usado}`,
    },
    {
      label: "WhatsApp",
      value: waLim != null ? `${whatsapp.usado} / ${waLim}` : `${whatsapp.usado}`,
    },
  ];

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
        Resumo · {segmentoLabel}
      </div>
      <div className="plan-summary-grid">
        {items.map(({ label, value }) => (
          <div key={label} className="plan-summary-item">
            <div className="plan-summary-label">{label}</div>
            <div
              className={
                value === "—" ? "plan-summary-value plan-summary-value--muted" : "plan-summary-value"
              }
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
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
    assinatura && ["ativa", "atrasada", "trial"].includes(assinatura.status);

  const usageRows = [
    { key: "lancamentos", label: "Lançamentos" },
    { key: "clientes", label: "Clientes" },
    { key: "projetos", label: "Projetos" },
    { key: "centrosCusto", label: "Centros de custo" },
    { key: "usuarios", label: "Usuários da equipe", nested: true },
    { key: "whatsappNumeros", label: "Números WhatsApp" },
  ];

  return (
    <div className="plan-assinatura-page">
      <style>{PAGE_CSS}</style>
      <PlanLimitNotice />

      <div className="plan-page-header">
        <h1 className="plan-page-title">Plano e Assinatura</h1>
        <p className="plan-page-sub">
          Gerencie seu plano Fluxiva, limites e cobrança — alinhado aos planos da landing pública.
        </p>
      </div>

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

      {!loading && assinatura && (
        <PlanSummaryBar assinatura={assinatura} usage={usage} segmentoLabel={segmentoLabel} />
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
          <div className="card-title">Uso detalhado do plano</div>
          <table className="data-table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th>Recurso</th>
                <th>Em uso</th>
                <th>Limite</th>
              </tr>
            </thead>
            <tbody>
              {usageRows.map(({ key, label, nested }) => {
                const { usado, limite } = usageMetric(usage.uso?.[key], nested);
                const lim = nested ? limite : usage.limites?.[key];
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

      {assinatura?.avisos?.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          {assinatura.avisos.map((a) => (
            <p
              key={a}
              style={{ fontSize: 12, color: "var(--amber-dark, #b45309)", margin: "4px 0" }}
            >
              {a}
            </p>
          ))}
          {canCancel && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: 8 }}
              disabled={!!busy}
              onClick={handleCancelar}
            >
              {busy === "cancelar" ? "Cancelando…" : "Cancelar assinatura"}
            </button>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Planos disponíveis · {segmentoLabel}</div>
        {!loading && planos.length === 0 ? (
          <div className="plan-empty-hint">
            Nenhum plano comercial ativo para seu perfil. No servidor, execute{" "}
            <code>npm run migrate</code> (migrations 024 e 027).
          </div>
        ) : (
          <div className="plan-cards-grid">
            {planos.map((p) => (
              <PlanCard
                key={p.id}
                plano={p}
                assinatura={assinatura}
                currentSlug={currentSlug}
                pagamentosReais={pagamentosReais}
                busy={busy}
                onSimulate={handleSimulate}
                onCheckout={handleCheckout}
              />
            ))}
          </div>
        )}
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
