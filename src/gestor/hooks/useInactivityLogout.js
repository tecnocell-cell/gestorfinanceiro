import { useEffect, useRef } from "react";
import { useAuth } from "../AuthContext.jsx";

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hora

const EVENTS = ["mousemove", "keydown", "mousedown", "touchstart", "scroll", "click"];

/**
 * Desconecta automaticamente após 1 hora sem interação.
 * Só ativo quando o usuário está autenticado.
 */
export function useInactivityLogout() {
  const { token, logout } = useAuth();
  const timer = useRef(null);

  useEffect(() => {
    if (!token) return;

    const reset = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(logout, INACTIVITY_TIMEOUT_MS);
    };

    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset(); // inicia o timer ao montar

    return () => {
      clearTimeout(timer.current);
      EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [token, logout]);
}
