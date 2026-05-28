/**
 * useWhatsApp — Hook para gerenciar o estado da sessão WhatsApp do tenant.
 *
 * Fonte única de QR: GET /api/whatsapp/status (campo data.qrcode).
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { whatsappApi } from "../api.js";

const POLL_STATUS_MS = 4_000;

export function useWhatsApp() {
  const [status, setStatus] = useState(null);
  const [phoneNumber, setPhone] = useState(null);
  const [qrcode, setQrcode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const statusTimer = useRef(null);
  const statusRef = useRef(null);
  const qrcodeRef = useRef(null);

  statusRef.current = status;
  qrcodeRef.current = qrcode;

  const fetchStatus = useCallback(async () => {
    try {
      const data = await whatsappApi.status();

      if (data.qrcode) {
        setQrcode(data.qrcode);
        qrcodeRef.current = data.qrcode;
        setStatus("connecting");
        statusRef.current = "connecting";
        setPhone(data.phone_number || null);
        setError(null);
        return;
      }

      if (data.status === "connected") {
        setStatus("connected");
        statusRef.current = "connected";
        setPhone(data.phone_number || null);
        setQrcode(null);
        qrcodeRef.current = null;
        setError(null);
        return;
      }

      if (data.status === "connecting") {
        setStatus("connecting");
        statusRef.current = "connecting";
        setPhone(data.phone_number || null);
        setError(null);
        return;
      }

      if (data.status === "disconnected") {
        if (qrcodeRef.current) {
          setStatus("connecting");
          statusRef.current = "connecting";
          setError(null);
          return;
        }

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
  }, []);

  const stopPolling = useCallback(() => {
    clearInterval(statusTimer.current);
    statusTimer.current = null;
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    statusTimer.current = setInterval(fetchStatus, POLL_STATUS_MS);
  }, [fetchStatus, stopPolling]);

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
    qrcodeRef.current = null;

    try {
      await whatsappApi.connect();
      setStatus("connecting");
      statusRef.current = "connecting";

      setTimeout(fetchStatus, 1_000);
      setTimeout(fetchStatus, 3_000);
      setTimeout(fetchStatus, 6_000);
    } catch (err) {
      setError(err.message || "Erro ao conectar.");
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  const disconnect = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await whatsappApi.disconnect();
      setStatus("disconnected");
      statusRef.current = "disconnected";
      setPhone(null);
      setQrcode(null);
      qrcodeRef.current = null;
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
