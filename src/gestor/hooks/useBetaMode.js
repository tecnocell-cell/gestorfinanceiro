import { useState, useEffect } from "react";
import { betaApi } from "../api.js";

export function useBetaMode() {
  const [state, setState] = useState({
    loading: true,
    betaMode: false,
    message: null,
    feedbackChannel: null,
  });

  useEffect(() => {
    let cancelled = false;
    betaApi
      .config()
      .then((cfg) => {
        if (cancelled) return;
        setState({
          loading: false,
          betaMode: !!cfg.betaMode,
          message: cfg.message || null,
          feedbackChannel: cfg.feedbackChannel || null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ loading: false, betaMode: false, message: null, feedbackChannel: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
