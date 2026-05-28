/**
 * useWhatsApp — Hook para gerenciar o estado da sessão WhatsApp do tenant.
 *
 * Estados:
 *   "disconnected"  — sem sessão ativa
 *   "connecting"    — aguardando scan do QR code
 *   "connected"     — WhatsApp conectado
 *
 * QR: prioriza data.qrcode de GET /api/whatsapp/status; fallback GET /qrcode.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { whatsappApi } from "../api.js";

const POLL_STATUS_MS = 4_000;
const POLL_QR_MS = 8_000;

export function useWhatsApp() {
  const [status, setStatus] = useState(null);
  const [phoneNumber, setPhone] = useState(null);
  const [qrcode, setQrcode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const statusTimer = useRef(null);
  const qrTimer = useRef(null);
  const statusRef = useRef(null);

  statusRef.current = status;

  const applyQrcode = useCallback((qr) => {
    if (!qr) return false;
    setQrcode(qr);
    setStatus("connecting");
    statusRef.current = "connecting";
    setError(null);
    return true;
  }, []);

  const fetchQr = useCallback(async () => {
    if (statusRef.current !== "connecting" && statusRef.current !== null) {
      return false;
    }
    try {
      const data = await whatsappApi.qrcode();
      if (data.qrcode) {
        return applyQrcode(data.qrcode);
      }
    } catch {
      // 202 ou rede — mantém estado atual
    }
    return false;
  }, [applyQrcode]);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await whatsappApi.status();

      if (data.qrcode) {
        setPhone(data.phone_number || null);
        applyQrcode(data.qrcode);
        return;
      }

      if (data.status === "connected") {
        setStatus("connected");
        statusRef.current = "connected";
        setPhone(data.phone_number || null);
        setQrcode(null);
        setError(null);
        return;
      }

      if (data.status === "connecting") {
        setStatus("connecting");
        statusRef.current = "connecting";
        setPhone(data.phone_number || null);
        setError(null);
        await fetchQr();
        return;
      }

      if (data.status === "disconnected") {
        const gotQr = await fetchQr();
        if (gotQr) return;

        setStatus("disconnected");
        statusRef.current = "disconnected";
        setPhone(null);
        setQrcode(null);
        if (data.error) {
          setError(data.error);
        }
      }
    } catch {
      // mantém estado anterior
    }
  }, [applyQrcode, fetchQr]);

  const stopPolling = useCallback(() => {
    clearInterval(statusTimer.current);
    clearInterval(qrTimer.current);
    statusTimer.current = null;
    qrTimer.current = null;
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    statusTimer.current = setInterval(fetchStatus, POLL_STATUS_MS);
    qrTimer.current = setInterval(fetchQr, POLL_QR_MS);
  }, [fetchStatus, fetchQr, stopPolling]);

  useEffect(() => {
    if (status === "connecting") {
      startPolling();
    } else {
      stopPolling();
    }
    return stopPolling;
  }, [status, startPolling, stopPolling]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    setQrcode(null);

    try {
      await whatsappApi.connect();
      setStatus("connecting");
      statusRef.current = "connecting";

      const poll = () => {
        fetchStatus();
        fetchQr();
      };
      setTimeout(poll, 1_000);
      setTimeout(poll, 3_000);
      setTimeout(poll, 6_000);
    } catch (err) {
      setError(err.message || "Erro ao conectar.");
    } finally {
      setLoading(false);
    }
  }, [fetchStatus, fetchQr]);

  const disconnect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await whatsappApi.disconnect();
      setStatus("disconnected");
      statusRef.current = "disconnected";
      setPhone(null);
      setQrcode(null);
    } catch (err) {
      setError(err.message || "Erro ao desconectar.");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    status,
    phoneNumber,
    qrcode,
    loading,
    error,
    connect,
    disconnect,
    refresh: fetchStatus,
  };
}
