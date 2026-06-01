import { useState, useCallback, useEffect } from "react";
import { generateId } from "../finance.js";
import { tokenStorage } from "../api.js";

const STORAGE_PREFIX = "gestor_suporte_tickets_";

function storageKey() {
  const user = tokenStorage.getUser();
  const id = user?.id ?? user?.email ?? "anon";
  return `${STORAGE_PREFIX}${id}`;
}

function loadTickets() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTickets(tickets) {
  localStorage.setItem(storageKey(), JSON.stringify(tickets));
}

/**
 * Tickets de suporte — persistência local até API dedicada.
 */
export function useSupportTickets() {
  const [tickets, setTickets] = useState(loadTickets);

  useEffect(() => {
    setTickets(loadTickets());
  }, []);

  const refresh = useCallback(() => {
    setTickets(loadTickets());
  }, []);

  const createTicket = useCallback((payload) => {
    const ticket = {
      id: generateId(),
      assunto: payload.assunto.trim(),
      descricao: payload.descricao.trim(),
      status: "aberto",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      anexoNome: payload.anexoNome || null,
      anexoDataUrl: payload.anexoDataUrl || null,
      mensagens: 1,
    };
    setTickets((prev) => {
      const next = [ticket, ...prev];
      saveTickets(next);
      return next;
    });
    return ticket;
  }, []);

  const updateStatus = useCallback((id, status) => {
    setTickets((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t
      );
      saveTickets(next);
      return next;
    });
  }, []);

  const removeTicket = useCallback((id) => {
    setTickets((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveTickets(next);
      return next;
    });
  }, []);

  return { tickets, refresh, createTicket, updateStatus, removeTicket };
}
