import { useState, useCallback } from "react";
import { useGestor } from "../GestorContext.jsx";

/**
 * Seletor de ambiente financeiro.
 * Visível apenas quando o usuário tem mais de 1 ambiente.
 */
export default function AmbienteSelector() {
  const { state, setState } = useGestor();
  const [loading, setLoading] = useState(false);

  const ambientes = state?.ambientes;
  const ambienteAtualId = state?.ambienteAtualId;

  if (!ambientes || ambientes.length <= 1) return null;

  const handleChange = useCallback(async (e) => {
    const novoId = e.target.value;
    if (novoId === ambienteAtualId || loading) return;

    // Atualiza estado local imediatamente (o debounce de save vai persistir)
    setState((prev) => ({ ...prev, ambienteAtualId: novoId }));

    // Persiste via rota dedicada (sem aguardar debounce)
    setLoading(true);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      await fetch(`/api/ambientes/${novoId}/selecionar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch {
      // silencioso — o setState local já foi aplicado
    } finally {
      setLoading(false);
    }
  }, [ambienteAtualId, loading, setState]);

  return (
    <div className="ambiente-selector">
      <select
        value={ambienteAtualId || ""}
        onChange={handleChange}
        disabled={loading}
        aria-label="Selecionar ambiente financeiro"
        className="ambiente-selector__select"
      >
        {ambientes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
