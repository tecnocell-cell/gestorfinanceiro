import { useState, useCallback } from "react";
import { useGestor } from "../GestorContext.jsx";
import { useAuth } from "../AuthContext.jsx";

const TIPOS = [
  { value: "pessoal", label: "Pessoal" },
  { value: "empresa", label: "Empresa" },
];

/**
 * Seletor de ambiente financeiro + botão de criação.
 * O seletor só aparece quando o usuário tem mais de 1 ambiente.
 * O botão "Novo ambiente" aparece sempre (para criar o segundo).
 */
export default function AmbienteSelector() {
  const { state, setState, reloadAppState } = useGestor();
  const { token } = useAuth();
  const [creating, setCreating] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState("empresa");
  const [erro, setErro] = useState("");

  const ambientes = state?.ambientes;
  const ambienteAtualId = state?.ambienteAtualId;

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const handleChangeAmbiente = useCallback(async (e) => {
    const novoId = e.target.value;
    if (novoId === ambienteAtualId || switching) return;
    setSwitching(true);
    try {
      await fetch(`/api/ambientes/${novoId}/selecionar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
      });
      // Atualiza ambienteAtualId localmente e recarrega estado completo
      setState((prev) => ({ ...prev, ambienteAtualId: novoId }));
      await reloadAppState({ skipFlush: false });
    } catch {
      // silencioso
    } finally {
      setSwitching(false);
    }
  }, [ambienteAtualId, switching, setState, reloadAppState, authHeader]);

  const handleCriarAmbiente = useCallback(async () => {
    if (!novoNome.trim()) { setErro("Informe o nome do ambiente."); return; }
    setErro("");
    setCreating(true);
    try {
      const res = await fetch("/api/ambientes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ nome: novoNome.trim(), tipo: novoTipo }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || "Erro ao criar ambiente."); return; }

      const novoId = data.ambiente?.id;
      if (novoId) {
        // Seleciona o novo ambiente e recarrega
        await fetch(`/api/ambientes/${novoId}/selecionar`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
        });
        setState((prev) => ({ ...prev, ambienteAtualId: novoId }));
        await reloadAppState({ skipFlush: false });
      }
      setShowModal(false);
      setNovoNome("");
      setNovoTipo("empresa");
    } catch {
      setErro("Erro ao criar ambiente. Tente novamente.");
    } finally {
      setCreating(false);
    }
  }, [novoNome, novoTipo, setState, reloadAppState, authHeader]);

  const temMultiplos = Array.isArray(ambientes) && ambientes.length > 1;

  return (
    <>
      <div className="ambiente-selector">
        {temMultiplos && (
          <select
            value={ambienteAtualId || ""}
            onChange={handleChangeAmbiente}
            disabled={switching}
            aria-label="Selecionar ambiente financeiro"
            className="ambiente-selector__select"
          >
            {ambientes.map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="ambiente-selector__novo"
          onClick={() => { setShowModal(true); setErro(""); }}
          title="Novo ambiente financeiro"
          aria-label="Criar novo ambiente"
        >
          + Ambiente
        </button>
      </div>

      {showModal && (
        <div className="ambiente-modal-overlay" role="dialog" aria-modal="true">
          <div className="ambiente-modal">
            <h3 className="ambiente-modal__title">Novo ambiente</h3>
            <div className="ambiente-modal__field">
              <label>Nome</label>
              <input
                type="text"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Empresa Principal"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCriarAmbiente()}
              />
            </div>
            <div className="ambiente-modal__field">
              <label>Tipo</label>
              <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)}>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            {erro && <p className="ambiente-modal__erro">{erro}</p>}
            <div className="ambiente-modal__actions">
              <button
                type="button"
                onClick={() => { setShowModal(false); setErro(""); }}
                disabled={creating}
                className="ambiente-modal__btn ambiente-modal__btn--cancel"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCriarAmbiente}
                disabled={creating}
                className="ambiente-modal__btn ambiente-modal__btn--confirm"
              >
                {creating ? "Criando…" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
