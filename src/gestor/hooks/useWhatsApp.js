/**
 * useWhatsApp — Hook para gerenciar o estado da sessão WhatsApp do tenant.
 *
 * Estados:
 *   "disconnected"  — sem sessão ativa
 *   "connecting"    — aguardando scan do QR code
 *   "connected"     — WhatsApp conectado
 *
 * Polling:
 *   - Enquanto status = "connecting": verifica /status a cada 3s e /qrcode a cada 4s
 *   - Após "connected" ou "disconnected": polling para
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { whatsappApi } from "../api.js";

const POLL_STATUS_MS = 4_000;
const POLL_QR_MS     = 8_000;

export function useWhatsApp() {
  const [status, setStatus]       = useState(null);   // null = carregando
  const [phoneNumber, setPhone]   = useState(null);
  const [qrcode, setQrcode]       = useState(null);
  const [loading, setLoading]     = useState(false);  // ação em andamento
  const [error, setError]         = useState(null);

  const statusTimer = useRef(null);
  const qrTimer     = useRef(null);
  const statusRef   = useRef(null);
  statusRef.current = status;

  // ── Busca status atual ──────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const data = await whatsappApi.status();
      const prev = statusRef.current;

      if (prev === "connecting" && data.status === "disconnected") {
        setError(
          "Conexão interrompida antes do QR. Aguarde alguns segundos ou clique em Conectar novamente."
        );
        setQrcode(null);
      }

      setStatus(data.status);
      statusRef.current = data.status;
      setPhone(data.phone_number || null);

      if (data.status === "connected") {
        setQrcode(null);
        setError(null);
      }
    } catch {
      // silencioso — mantém estado anterior
    }
  }, []);

  // ── Busca QR code ───────────────────────────────────────────────────────────
  const fetchQr = useCallback(async () => {
    if (status !== "connecting") return;
    try {
      const data = await whatsappApi.qrcode();
      if (data.qrcode) setQrcode(data.qrcode);
    } catch {
      // 202 (ainda não disponível) ou 409 (já conectou) — fetchStatus resolverá
    }
  }, [status]);

  // ── Polling ─────────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    clearInterval(statusTimer.current);
    clearInterval(qrTimer.current);
    statusTimer.current = null;
    qrTimer.current     = null;
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    statusTimer.current = setInterval(fetchStatus, POLL_STATUS_MS);
    qrTimer.current     = setInterval(fetchQr,     POLL_QR_MS);
  }, [fetchStatus, fetchQr, stopPolling]);

  // Inicia/para polling baseado no status
  useEffect(() => {
    if (status === "connecting") {
      startPolling();
    } else {
      stopPolling();
    }
    return stopPolling;
  }, [status, startPolling, stopPolling]);

  // Carga inicial
  useEffect(() => {
    fetchStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ações ────────────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    setQrcode(null);
    try {
      await whatsappApi.connect();
      setStatus("connecting");
      statusRef.current = "connecting";
      // Busca QR após Evolution processar (webhook costuma levar alguns segundos)
      setTimeout(fetchQr, 3_000);
    } catch (err) {
      setError(err.message || "Erro ao conectar.");
    } finally {
      setLoading(false);
    }
  }, [fetchQr]);

  const disconnect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await whatsappApi.disconnect();
      setStatus("disconnected");
      setPhone(null);
      setQrcode(null);
    } catch (err) {
      setError(err.message || "Erro ao desconectar.");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    status,        // "disconnected" | "connecting" | "connected" | null
    phoneNumber,
    qrcode,        // string base64 PNG ou null
    loading,
    error,
    connect,
    disconnect,
    refresh: fetchStatus,
  };
}
