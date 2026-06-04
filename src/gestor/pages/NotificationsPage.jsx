import { useCallback, useEffect, useState } from "react";
import { notificationsApi } from "../api.js";
import { sanitizePublicMessage } from "../planRules.js";

const TIPO_LABEL = {
  cobranca: "Cobrança",
  assinatura: "Assinatura",
  seguranca: "Segurança",
  convite: "Convite",
  suporte: "Suporte",
  sistema: "Sistema",
};

const FILTROS = [
  ["", "Todas"],
  ["cobranca", "Cobrança"],
  ["assinatura", "Assinatura"],
  ["seguranca", "Segurança"],
  ["convite", "Convite"],
  ["suporte", "Suporte"],
  ["sistema", "Sistema"],
];

function fmtWhen(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = filtro ? `?tipo=${filtro}` : "";
      const data = await notificationsApi.list(params);
      setItems(data.notificacoes || []);
      setUnread(data.nao_lidas || 0);
    } catch (e) {
      setError(e.message || "Erro ao carregar notificações.");
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id) => {
    await notificationsApi.markRead(id);
    await load();
  };

  const markAll = async () => {
    await notificationsApi.markAllRead();
    await load();
  };

  const goPortal = () => {
    window.dispatchEvent(new CustomEvent("gestor-navigate", { detail: { page: "plano-assinatura" } }));
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <h1 className="page-title">Notificações</h1>
        <p className="page-sub" style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
          Cobrança, assinatura, convites e avisos do sistema.
          {unread > 0 && (
            <strong style={{ marginLeft: 8, color: "var(--danger)" }}>
              {unread} não lida{unread !== 1 ? "s" : ""}
            </strong>
          )}
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {FILTROS.map(([id, label]) => (
          <button
            key={id || "all"}
            type="button"
            className={`saas-filter-chip${filtro === id ? " saas-filter-chip--active" : ""}`}
            onClick={() => setFiltro(id)}
          >
            {label}
          </button>
        ))}
        {unread > 0 && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={markAll}>
            Marcar todas como lidas
          </button>
        )}
      </div>

      {error && (
        <div className="login-error" style={{ marginBottom: 12 }}>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Carregando…</p>
      ) : items.length === 0 ? (
        <div className="empty-state card" style={{ padding: 24 }}>
          <p style={{ margin: 0 }}>Nenhuma notificação neste filtro.</p>
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={goPortal}>
            Ir ao Portal do Cliente
          </button>
        </div>
      ) : (
        <ul className="notif-center-list">
          {items.map((n) => (
            <li key={n.id} className={`notif-center-item card${n.lida ? " notif-center-item--read" : ""}`}>
              <div className="notif-center-head">
                <span className={`notif-tipo notif-tipo--${n.tipo}`}>
                  {TIPO_LABEL[n.tipo] || n.tipo}
                </span>
                <time style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{fmtWhen(n.created_at)}</time>
              </div>
              <h3 style={{ fontSize: 15, margin: "6px 0 4px" }}>{n.titulo}</h3>
              <p style={{ fontSize: 13, margin: 0, color: "var(--muted-foreground)" }}>
                {sanitizePublicMessage(n.mensagem)}
              </p>
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                {!n.lida && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => markRead(n.id)}>
                    Marcar como lida
                  </button>
                )}
                {(n.tipo === "cobranca" || n.tipo === "assinatura") && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={goPortal}>
                    Ver assinatura
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
