import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "./icons.jsx";
import { notificationsApi } from "../api.js";
import { sanitizePublicMessage } from "../planRules.js";

function fmtWhen(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return "Agora";
    if (diff < 3600) return `${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

const TIPO_LABEL = {
  cobranca: "Cobrança",
  assinatura: "Assinatura",
  seguranca: "Segurança",
  convite: "Convite",
  suporte: "Suporte",
  sistema: "Sistema",
};

export default function NotificationBell({ onOpenCenter }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationsApi.list();
      setItems(data.notificacoes || []);
      setUnread(data.nao_lidas || 0);
    } catch {
      /* silencioso no topo */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 120_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const markRead = async (id) => {
    try {
      await notificationsApi.markRead(id);
      setItems((list) =>
        list.map((n) => (n.id === id ? { ...n, lida: true } : n))
      );
      setUnread((n) => Math.max(0, n - 1));
    } catch {
      /* */
    }
  };

  const markAll = async () => {
    try {
      await notificationsApi.markAllRead();
      setItems((list) => list.map((n) => ({ ...n, lida: true })));
      setUnread(0);
    } catch {
      /* */
    }
  };

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className="notif-bell-btn"
        aria-label={`Notificações${unread ? `, ${unread} não lidas` : ""}`}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
      >
        <Bell size={18} strokeWidth={1.75} aria-hidden />
        {unread > 0 && (
          <span className="notif-bell-badge" aria-hidden>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Painel de notificações">
          <div className="notif-panel-head">
            <strong>Notificações</strong>
            <div style={{ display: "flex", gap: 6 }}>
              {unread > 0 && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={markAll}>
                  Marcar todas
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setOpen(false);
                  onOpenCenter?.();
                }}
              >
                Ver todas
              </button>
            </div>
          </div>
          <div className="notif-panel-body">
            {loading && !items.length ? (
              <p className="notif-empty">Carregando…</p>
            ) : !items.length ? (
              <p className="notif-empty">Nenhuma notificação no momento.</p>
            ) : (
              <ul className="notif-list">
                {items.slice(0, 12).map((n) => (
                  <li
                    key={n.id}
                    className={`notif-item${n.lida ? " notif-item--read" : ""}`}
                  >
                    <div className="notif-item-meta">
                      <span className="notif-tipo">{TIPO_LABEL[n.tipo] || n.tipo}</span>
                      <span className="notif-when">{fmtWhen(n.created_at)}</span>
                    </div>
                    <div className="notif-item-title">{n.titulo}</div>
                    <p className="notif-item-msg">
                      {sanitizePublicMessage(n.mensagem)}
                    </p>
                    {!n.lida && (
                      <button
                        type="button"
                        className="notif-mark-read"
                        onClick={() => markRead(n.id)}
                      >
                        Marcar como lida
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
