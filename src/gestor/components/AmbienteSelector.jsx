import { useState, useCallback, useRef, useEffect } from "react";
import { useGestor } from "../GestorContext.jsx";
import { useAuth } from "../AuthContext.jsx";

const ICONE = { pessoal: "🏠", empresa: "🏢" };

function iconeAmbiente(tipo) {
  return ICONE[tipo] || "🏢";
}

export default function AmbienteSelector() {
  const { state, setState, reloadAppState } = useGestor();
  const { token } = useAuth();

  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [nome, setNome] = useState("");
  const [segmento, setSegmento] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [erro, setErro] = useState("");
  const dropdownRef = useRef(null);

  const ambientes = state?.ambientes ?? [];
  const ambienteAtualId = state?.ambienteAtualId;
  const ambienteAtual = ambientes.find((a) => a.id === ambienteAtualId);

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setShowForm(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const selecionar = useCallback(async (id) => {
    if (id === ambienteAtualId || switching) return;
    setSwitching(true);
    setOpen(false);
    try {
      await fetch(`/api/ambientes/${id}/selecionar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
      });
      setState((prev) => ({ ...prev, ambienteAtualId: id }));
      await reloadAppState({ skipFlush: false });
    } finally {
      setSwitching(false);
    }
  }, [ambienteAtualId, switching, setState, reloadAppState, authHeader]);

  const criarEmpresa = useCallback(async () => {
    if (!nome.trim()) { setErro("Informe o nome da empresa."); return; }
    setErro("");
    setCreating(true);
    try {
      const res = await fetch("/api/ambientes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          nome: nome.trim(),
          tipo: "empresa",
          ...(cnpj.trim() ? { cnpj: cnpj.trim() } : {}),
          ...(segmento.trim() ? { segmento: segmento.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || "Erro ao criar empresa."); return; }

      const novoId = data.ambiente?.id;
      if (novoId) {
        await fetch(`/api/ambientes/${novoId}/selecionar`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
        });
        setState((prev) => ({ ...prev, ambienteAtualId: novoId }));
        await reloadAppState({ skipFlush: false });
      }
      setShowForm(false);
      setOpen(false);
      setNome("");
      setSegmento("");
      setCnpj("");
    } catch {
      setErro("Erro ao criar empresa. Tente novamente.");
    } finally {
      setCreating(false);
    }
  }, [nome, segmento, cnpj, setState, reloadAppState, authHeader]);

  if (!ambientes.length) return null;

  const labelAtual = ambienteAtual
    ? `${iconeAmbiente(ambienteAtual.tipo)} ${ambienteAtual.nome}`
    : "Minhas Finanças";

  return (
    <div className="amb-selector" ref={dropdownRef}>
      {/* Botão principal — mostra seleção atual */}
      <button
        type="button"
        className={`amb-selector__trigger${switching ? " amb-selector__trigger--loading" : ""}`}
        onClick={() => { setOpen((v) => !v); setShowForm(false); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={switching}
      >
        <span className="amb-selector__label">{labelAtual}</span>
        <span className="amb-selector__caret">{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="amb-dropdown" role="listbox">
          {/* Lista de ambientes */}
          <ul className="amb-dropdown__list">
            {ambientes.map((a) => (
              <li
                key={a.id}
                role="option"
                aria-selected={a.id === ambienteAtualId}
                className={`amb-dropdown__item${a.id === ambienteAtualId ? " amb-dropdown__item--active" : ""}`}
                onClick={() => selecionar(a.id)}
              >
                <span className="amb-dropdown__icon">{iconeAmbiente(a.tipo)}</span>
                <span className="amb-dropdown__nome">{a.nome}</span>
                {a.id === ambienteAtualId && <span className="amb-dropdown__check">✓</span>}
              </li>
            ))}
          </ul>

          <div className="amb-dropdown__divider" />

          {/* Formulário inline de nova empresa */}
          {showForm ? (
            <div className="amb-dropdown__form">
              <p className="amb-dropdown__form-title">Nova Empresa</p>
              <input
                className="amb-dropdown__input"
                type="text"
                placeholder="Nome da empresa *"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && criarEmpresa()}
              />
              <input
                className="amb-dropdown__input"
                type="text"
                placeholder="Segmento (opcional)"
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
              />
              <input
                className="amb-dropdown__input"
                type="text"
                placeholder="CNPJ (opcional)"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
              />
              {erro && <p className="amb-dropdown__erro">{erro}</p>}
              <div className="amb-dropdown__form-actions">
                <button
                  type="button"
                  className="amb-dropdown__btn amb-dropdown__btn--cancel"
                  onClick={() => { setShowForm(false); setErro(""); }}
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="amb-dropdown__btn amb-dropdown__btn--confirm"
                  onClick={criarEmpresa}
                  disabled={creating}
                >
                  {creating ? "Criando…" : "Criar"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="amb-dropdown__add"
              onClick={() => { setShowForm(true); setNome(""); setSegmento(""); setCnpj(""); setErro(""); }}
            >
              ➕ Nova Empresa
            </button>
          )}
        </div>
      )}
    </div>
  );
}
