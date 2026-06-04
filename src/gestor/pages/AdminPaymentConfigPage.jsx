import { useCallback, useEffect, useState } from "react";
import AdminLayout from "../admin/AdminLayout.jsx";
import AdminSection from "../admin/AdminSection.jsx";
import { adminPaymentApi } from "../api.js";

const TABS = [
  { id: "geral", label: "Geral" },
  { id: "mercado_pago", label: "Mercado Pago" },
  { id: "asaas", label: "Asaas" },
  { id: "webhooks", label: "Webhooks" },
  { id: "testes", label: "Testes" },
];

const TAB_HINT = {
  geral: "Status dos gateways, prioridade de cobrança e opções do portal do cliente.",
  mercado_pago: "PIX e cartão. Credenciais sensíveis são mascaradas após salvar.",
  asaas: "PIX via Asaas. Compatível com chave no .env do servidor.",
  webhooks: "URLs públicas para configurar nos painéis dos provedores.",
  testes: "Validação de conexão e suíte automatizada no servidor.",
};

const MP_FIELDS = [
  { key: "public_key", label: "Chave pública", secret: false, hint: "Exposta no frontend para tokenizar cartão." },
  { key: "access_token", label: "Token de acesso", secret: true },
  { key: "client_id", label: "Client ID", secret: false },
  { key: "client_secret", label: "Client Secret", secret: true },
  { key: "payer_email_fallback", label: "E-mail pagador (fallback)", secret: false },
  { key: "webhook_url", label: "URL do webhook (referência)", secret: false },
  { key: "webhook_secret", label: "Segredo do webhook", secret: true },
];

const ASAAS_FIELDS = [
  { key: "api_key", label: "Chave de API", secret: true },
  { key: "env", label: "Ambiente", secret: false, hint: "sandbox ou production" },
  { key: "webhook_token", label: "Token do webhook", secret: true },
  { key: "webhook_url", label: "URL do webhook (referência)", secret: false },
];

function providerRow(providers, id) {
  return providers?.find((p) => p.provider === id) || { provider: id, active: false, config: {} };
}

function ProviderPill({ active }) {
  return (
    <span className={`admin-wa-pill ${active ? "admin-wa-pill--ok" : "admin-wa-pill--off"}`}>
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function AlertFeedback({ error, message }) {
  return (
    <>
      {error && <div className="alert alert-warn">{error}</div>}
      {message && !error && <div className="alert alert-success">{message}</div>}
    </>
  );
}

function CopyUrlRow({ label, url }) {
  const copy = () => {
    navigator.clipboard?.writeText(url).then(
      () => alert("URL copiada."),
      () => alert(url)
    );
  };
  return (
    <div className="admin-payment-url-row">
      <div className="admin-payment-url-label">{label}</div>
      <code className="admin-payment-url-code">{url}</code>
      <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
        Copiar
      </button>
    </div>
  );
}

function ProviderFormCard({
  title,
  description,
  active,
  fields,
  form,
  setForm,
  sandboxKey = "sandbox_mode",
  onSave,
  onTest,
  onActivate,
  onDeactivate,
  busy,
}) {
  return (
    <div className="card admin-inner-card admin-payment-form-card">
      <div className="admin-payment-card-head">
        <div>
          <div className="card-title">{title}</div>
          <p className="admin-card-hint">{description}</p>
        </div>
        <ProviderPill active={active} />
      </div>

      <div className="admin-form-grid-2">
        {fields.map(({ key, label, secret, hint }) => (
          <div key={key} className="form-group">
            <label className="form-label" htmlFor={`pay-${key}`}>
              {label}
            </label>
            <input
              id={`pay-${key}`}
              className="form-input"
              type={secret ? "password" : "text"}
              value={form[key] || ""}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={secret ? "Deixe em branco para manter o valor salvo" : ""}
              autoComplete="off"
            />
            {hint && <p className="admin-card-hint" style={{ marginTop: 4, marginBottom: 0 }}>{hint}</p>}
          </div>
        ))}
      </div>

      <label className="admin-checklist-label" style={{ marginTop: 12 }}>
        <input
          type="checkbox"
          checked={form[sandboxKey] !== false}
          onChange={(e) => setForm((f) => ({ ...f, [sandboxKey]: e.target.checked }))}
        />
        <span>Modo sandbox (homologação)</span>
      </label>

      <div className="admin-card-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onSave} disabled={busy}>
          Salvar
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onTest} disabled={busy}>
          Testar conexão
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onActivate} disabled={busy || active}>
          Ativar provedor
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDeactivate} disabled={busy || !active}>
          Desativar
        </button>
      </div>
    </div>
  );
}

export default function AdminPaymentConfigPage() {
  const [tab, setTab] = useState("geral");
  const [data, setData] = useState(null);
  const [mpForm, setMpForm] = useState({});
  const [asaasForm, setAsaasForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await adminPaymentApi.list();
      setData(res);
      const mp = providerRow(res.providers, "mercado_pago");
      const asaas = providerRow(res.providers, "asaas");
      setMpForm({ ...mp.config, sandbox_mode: mp.config?.sandbox_mode !== false });
      setAsaasForm({ ...asaas.config, sandbox_mode: asaas.config?.sandbox_mode !== false });
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const wrapAction = async (fn) => {
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const save = (provider, config, active) =>
    wrapAction(async () => {
      await adminPaymentApi.patch(provider, { config, active });
      setMsg("Configuração salva.");
      await load();
    });

  const runTest = (provider) =>
    wrapAction(async () => {
      const r = await adminPaymentApi.test(provider);
      if (r.ok) {
        setMsg(r.message || "Conexão OK.");
      } else {
        setErr(r.error || "Falha no teste de conexão.");
      }
    });

  const activate = (provider) =>
    wrapAction(async () => {
      await adminPaymentApi.activate(provider);
      setMsg("Provedor ativado. Os demais foram desativados automaticamente.");
      await load();
    });

  const deactivate = (provider) =>
    wrapAction(async () => {
      await adminPaymentApi.deactivate(provider);
      setMsg("Provedor desativado.");
      await load();
    });

  const mp = providerRow(data?.providers, "mercado_pago");
  const asaas = providerRow(data?.providers, "asaas");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const activeGateway = mp.active ? "Mercado Pago" : asaas.active ? "Asaas" : "Nenhum (manual)";
  const cardPortalHint =
    import.meta.env.VITE_PAYMENT_CARD_ENABLED === "true"
      ? "Habilitado no servidor"
      : "Desabilitado — PAYMENT_CARD_ENABLED=true no .env";

  return (
    <AdminLayout
      title="Configurações de Pagamento"
      subtitle="Gateways globais do Fluxiva. Somente admin master. Um provedor ativo por vez."
    >
      <div className="admin-tabs admin-payment-tabs" role="tablist" aria-label="Configurações de pagamento">
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
      <p className="admin-tab-hint">{TAB_HINT[tab]}</p>

      <AlertFeedback error={err} message={msg} />

      {loading && (
        <AdminSection title="Carregando">
          <p className="admin-loading">Carregando configurações…</p>
        </AdminSection>
      )}

      {!loading && tab === "geral" && (
        <>
          <div className="admin-kpi-grid" style={{ marginBottom: "1.25rem" }}>
            <div className="admin-kpi" style={{ "--admin-kpi-color": "var(--forest-700)" }}>
              <div className="admin-kpi-value admin-kpi-value--text">{activeGateway}</div>
              <div className="admin-kpi-label">Gateway ativo</div>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi-value admin-kpi-value--text">
                {mp.active || asaas.active ? "Online" : "Manual"}
              </div>
              <div className="admin-kpi-label">Cobrança no portal</div>
            </div>
            <div className="admin-kpi">
              <div className="admin-kpi-value admin-kpi-value--text">
                {import.meta.env.VITE_PAYMENT_CARD_ENABLED === "true" ? "Habilitado" : "Desabilitado"}
              </div>
              <div className="admin-kpi-label">Cartão no portal</div>
            </div>
          </div>

          <AdminSection
            title="Prioridade de cobrança"
            description="Mercado Pago tem prioridade quando ativo; em seguida Asaas; sem gateway ativo, o cliente vê mensagem de ativação com suporte."
          >
            <div className="admin-payment-provider-grid">
              <div className="card admin-inner-card">
                <div className="admin-payment-card-head">
                  <div className="card-title">Mercado Pago</div>
                  <ProviderPill active={mp.active} />
                </div>
                <p className="admin-card-hint">PIX e cartão (token no navegador, sem armazenar cartão).</p>
                <div className={`admin-status-row ${mp.active ? "admin-status-row--ok" : "admin-status-row--warn"}`}>
                  <span className="admin-status-label">Status</span>
                  <span className="admin-status-detail">{mp.active ? "Provedor principal" : "Inativo"}</span>
                </div>
              </div>
              <div className="card admin-inner-card">
                <div className="admin-payment-card-head">
                  <div className="card-title">Asaas</div>
                  <ProviderPill active={asaas.active} />
                </div>
                <p className="admin-card-hint">PIX via Asaas. Legado por variável ASAAS_API_KEY no servidor.</p>
                <div className={`admin-status-row ${asaas.active ? "admin-status-row--ok" : "admin-status-row--warn"}`}>
                  <span className="admin-status-label">Status</span>
                  <span className="admin-status-detail">{asaas.active ? "Provedor principal" : "Inativo"}</span>
                </div>
              </div>
            </div>
          </AdminSection>

          <AdminSection title="Portal do cliente" description="O que o usuário final vê (sem termos técnicos de gateway).">
            <div className="card admin-inner-card admin-inner-card--narrow">
              <table className="admin-kv-table">
                <tbody>
                  <tr>
                    <th>Pagamento online</th>
                    <td>{mp.active || asaas.active ? "Disponível" : "Em ativação"}</td>
                  </tr>
                  <tr>
                    <th>PIX</th>
                    <td>{mp.active || asaas.active ? "Sim" : "—"}</td>
                  </tr>
                  <tr>
                    <th>Cartão</th>
                    <td>{cardPortalHint}</td>
                  </tr>
                  <tr>
                    <th>Boleto</th>
                    <td>Em breve</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </AdminSection>
        </>
      )}

      {!loading && tab === "mercado_pago" && (
        <AdminSection title="Mercado Pago" description="Configure credenciais do checkout transparente.">
          <ProviderFormCard
            title="Credenciais Mercado Pago"
            description="Ao salvar novamente, campos mascarados (com ****) mantêm o valor anterior no servidor."
            active={mp.active}
            fields={MP_FIELDS}
            form={mpForm}
            setForm={setMpForm}
            busy={busy}
            onSave={() => save("mercado_pago", mpForm, mp.active)}
            onTest={() => runTest("mercado_pago")}
            onActivate={() => activate("mercado_pago")}
            onDeactivate={() => deactivate("mercado_pago")}
          />
        </AdminSection>
      )}

      {!loading && tab === "asaas" && (
        <AdminSection title="Asaas" description="Alternativa de PIX para cobrança recorrente.">
          <ProviderFormCard
            title="Credenciais Asaas"
            description="Pode coexistir com ASAAS_API_KEY no .env até migrar tudo para esta tela."
            active={asaas.active}
            fields={ASAAS_FIELDS}
            form={asaasForm}
            setForm={setAsaasForm}
            busy={busy}
            onSave={() => save("asaas", asaasForm, asaas.active)}
            onTest={() => runTest("asaas")}
            onActivate={() => activate("asaas")}
            onDeactivate={() => deactivate("asaas")}
          />
        </AdminSection>
      )}

      {tab === "webhooks" && (
        <AdminSection
          title="URLs de webhook"
          description="Cadastre no painel do provedor. O servidor valida assinatura quando o segredo estiver configurado."
        >
          <div className="card admin-inner-card">
            <CopyUrlRow label="Mercado Pago" url={`${origin}/api/billing/webhook/mercado-pago`} />
            <CopyUrlRow label="Asaas" url={`${origin}/api/billing/webhook/asaas`} />
          </div>
          {data?.webhooks && (
            <div className="card admin-inner-card" style={{ marginTop: 12 }}>
              <div className="card-title">Referência da API</div>
              <pre className="admin-payment-json-preview">{JSON.stringify(data.webhooks, null, 2)}</pre>
            </div>
          )}
        </AdminSection>
      )}

      {tab === "testes" && (
        <AdminSection title="Testes e homologação" description="Validação antes de liberar cobrança em produção.">
          <div className="card admin-inner-card">
            <div className="card-title">Comandos no servidor</div>
            <p className="admin-card-hint">Com a API rodando e BILLING_USE_MOCK_GATEWAY=true para homologação local.</p>
            <pre className="admin-payment-json-preview">npm run test:78</pre>
            <div className="admin-card-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => runTest("mercado_pago")}
              >
                Testar Mercado Pago
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => runTest("asaas")}
              >
                Testar Asaas
              </button>
            </div>
          </div>
          <ul className="admin-checklist" style={{ marginTop: 16 }}>
            <li>
              <span className="admin-card-hint">
                Cadastro não exige pagamento — trial informado no resumo e na conclusão.
              </span>
            </li>
            <li>
              <span className="admin-card-hint">
                Webhooks idempotentes — eventos duplicados não ativam assinatura duas vezes.
              </span>
            </li>
          </ul>
        </AdminSection>
      )}
    </AdminLayout>
  );
}
