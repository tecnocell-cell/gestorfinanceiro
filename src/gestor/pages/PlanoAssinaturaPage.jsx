import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { billingApi } from "../api.js";
import { AlertTriangle } from "../components/icons.jsx";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
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
  vencida: "Vencida",
  cancelada: "Cancelada",
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [simulating, setSimulating] = useState(null);

  const segmentoLabel =
    user?.tipo_perfil === "fisica" ? "Pessoa Física (PF)" : "Pessoa Jurídica (PJ)";

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [sub, plans] = await Promise.all([
        billingApi.assinatura(),
        billingApi.planos(),
      ]);
      setAssinatura(sub.assinatura);
      setPlanos(plans.planos || []);
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
    setSimulating(slug);
    try {
      const data = await billingApi.simularUpgrade(slug);
      setMsg(data.message || "Plano atualizado (simulação).");
      setAssinatura(data.assinatura);
    } catch (e) {
      setError(e.message || "Falha ao simular upgrade.");
    } finally {
      setSimulating(null);
    }
  };

  const currentSlug = assinatura?.plano?.slug;

  return (
    <div>
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
          Pagamentos reais ainda não configurados
        </div>
        <p style={{ fontSize: 13, margin: 0, color: "var(--muted)" }}>
          Não há cobrança por cartão nesta versão. Use &quot;Simular upgrade&quot; para testar planos.
          Open Finance automático (Pluggy) será add-on opcional — importação OFX/CSV segue em todos os planos.
        </p>
      </div>

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

      {assinatura && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Plano atual</div>
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
              <div style={{ fontSize: 14 }}>{STATUS_LABEL[assinatura.status] || assinatura.status}</div>
            </div>
            <div>
              <div className="form-label">Trial até</div>
              <div style={{ fontSize: 14 }}>{formatDate(assinatura.trial_ate)}</div>
            </div>
            <div>
              <div className="form-label">Válido até</div>
              <div style={{ fontSize: 14 }}>{formatDate(assinatura.fim_em)}</div>
            </div>
          </div>
          <RecursosList recursos={assinatura.recursos} />
          {assinatura.recursos?.openFinanceAddon && !assinatura.recursos?.openFinance && (
            <div className="alert alert-info" style={{ marginTop: 12, fontSize: 12 }}>
              <strong>Open Finance add-on:</strong>{" "}
              {assinatura.recursos.openFinanceAddon.descricao}.{" "}
              {assinatura.recursos.openFinanceAddon.observacao}
            </div>
          )}
          {assinatura.avisos?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {assinatura.avisos.map((a) => (
                <p key={a} style={{ fontSize: 12, color: "var(--amber-dark, #b45309)", margin: "4px 0" }}>
                  {a}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-title">Planos disponíveis ({segmentoLabel})</div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {planos.map((p) => {
            const isCurrent = p.slug === currentSlug;
            const canSimulate = !isCurrent;
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
                ) : canSimulate ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginTop: 12, width: "100%" }}
                    disabled={!!simulating}
                    onClick={() => handleSimulate(p.slug)}
                  >
                    {simulating === p.slug ? "Simulando…" : "Simular upgrade"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
