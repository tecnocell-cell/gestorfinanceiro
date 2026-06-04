import { useState, useCallback, useEffect } from "react";
import { supportApi } from "../api.js";

/**
 * Chamados de suporte — API (Etapa 7.2)
 */
export function useSupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { tickets: list } = await supportApi.list();
      setTickets(
        (list || []).map((t) => ({
          id: t.id,
          assunto: t.assunto,
          descricao: t.descricao,
          categoria: t.categoria,
          status: t.status,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          anexoNome: t.anexo_nome,
          anexoDataUrl: t.anexo_data,
          mensagens: 1,
        }))
      );
    } catch (e) {
      setError(e.message || "Erro ao carregar chamados.");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createTicket = useCallback(
    async (payload) => {
      const { ticket } = await supportApi.create({
        categoria: payload.categoria || "outro",
        assunto: payload.assunto,
        descricao: payload.descricao,
        anexo_nome: payload.anexoNome || null,
        anexo_data: payload.anexoDataUrl || null,
      });
      await refresh();
      return ticket;
    },
    [refresh]
  );

  const updateStatus = useCallback(
    async (id, status) => {
      await supportApi.updateStatus(id, status);
      await refresh();
    },
    [refresh]
  );

  const removeTicket = useCallback(() => {
    /* remoção não exposta na API — mantido por compatibilidade de UI */
  }, []);

  return { tickets, loading, error, refresh, createTicket, updateStatus, removeTicket };
}
