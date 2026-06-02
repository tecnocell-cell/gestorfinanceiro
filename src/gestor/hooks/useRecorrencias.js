import { useState, useCallback, useEffect } from "react";
import { recorrenciasApi, adminApi } from "../api.js";
import { useGestor } from "../GestorContext.jsx";

/**
 * Hook de recorrências — isolado por tenant.
 * - Usuário comum: busca as próprias recorrências via /api/recorrencias
 * - Admin em modo impersonation (viewOnly): busca recorrências do tenant via admin API
 *   (somente leitura — create/update/remove/gerar ficam bloqueados pelo viewOnly)
 */
export function useRecorrencias() {
  const { viewOnly, impersonatingUser } = useGestor();

  const [recorrencias, setRecorrencias] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      if (viewOnly && impersonatingUser?.id) {
        data = await adminApi.getUserRecorrencias(impersonatingUser.id);
      } else {
        data = await recorrenciasApi.list();
      }
      setRecorrencias(data.recorrencias || []);
    } catch (err) {
      setError(err.message);
      setRecorrencias([]);
    } finally {
      setLoading(false);
    }
  }, [viewOnly, impersonatingUser]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (data) => {
    if (viewOnly) throw new Error("Modo visualização: não é possível criar recorrências.");
    const result = await recorrenciasApi.create(data);
    setRecorrencias((prev) => [...prev, result.recorrencia]);
    return result.recorrencia;
  }, [viewOnly]);

  const update = useCallback(async (id, data) => {
    if (viewOnly) throw new Error("Modo visualização: não é possível editar recorrências.");
    const result = await recorrenciasApi.update(id, data);
    setRecorrencias((prev) => prev.map((r) => (r.id === id ? result.recorrencia : r)));
    return result.recorrencia;
  }, [viewOnly]);

  const remove = useCallback(async (id) => {
    if (viewOnly) throw new Error("Modo visualização: não é possível excluir recorrências.");
    await recorrenciasApi.remove(id);
    setRecorrencias((prev) => prev.filter((r) => r.id !== id));
  }, [viewOnly]);

  /**
   * Avança proxima_data no backend e retorna a nova data.
   * O lançamento real deve ser criado pelo chamador via lancCrud.add().
   */
  const gerar = useCallback(async (id, opts = {}) => {
    if (viewOnly) throw new Error("Modo visualização: não é possível gerar lançamentos.");
    const result = await recorrenciasApi.gerar(id, opts);
    if (result.avancou !== false) {
      setRecorrencias((prev) =>
        prev.map((r) => (r.id === id ? { ...r, proxima_data: result.proxima_data } : r))
      );
    }
    return result;
  }, [viewOnly]);

  return { recorrencias, loading, error, load, create, update, remove, gerar };
}

/** Adiciona getUserRecorrencias ao adminApi (pode ser chamado aqui para manter a api.js limpa) */
// Nota: getUserRecorrencias já existe em adminApi (server/index.js):
// GET /api/admin/users/:id/recorrencias
