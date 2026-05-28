import { useState, useEffect, useCallback, useRef } from "react";
import { whatsappApi } from "../api.js";

const POLL_STATUS_MS = 4000;
const POLL_QR_MS = 3000;

export function useWhatsApp() {
  const [status, setStatus] = useState(null);
  const [phoneNumber, setPhone] = useState(null);
  const [qrcode, setQrcode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const statusTimer = useRef(null);
  const qrTimer = useRef(null);
  const statusRef = useRef(null);
  const qrcodeRef = useRef(null);

  statusRef.current = status;
  qrcodeRef.current = qrcode;

  const fetchQr = useCallback(async () => {
    try {
      const data = await whatsappApi.qrcode();

      if (data.qrcode) {
        setQrcode(data.qrcode);
        qrcodeRef.current = data.qrcode;
        setStatus("connecting");
        statusRef.current = "connecting";
        setError(null);
        return true;
      }
    } catch {
      // mantém estado atual
    }

    return false;
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await whatsappApi.status();

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
        await fetchQr();
        return;
      }

      if (data.status === "disconnected") {
        const gotQr = await fetchQr();

        if (gotQr) {
          setStatus("connecting");
          statusRef.current = "connecting";
          return;
        }

        setStatus("disconnected");
        statusRef.current = "disconnected";
        setPhone(null);
        setQrcode(null);

        if (data.error) {
          setError(data.error);
        }

        return;
      }
    } catch {
      // mantém estado anterior
    }
  }, [fetchQr]);

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

      setTimeout(fetchQr, 1000);
      setTimeout(fetchQr, 3000);
      setTimeout(fetchQr, 6000);
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
