import { useState, useCallback, useRef, useEffect } from "react";
import { useGestor } from "../GestorContext.jsx";
import { useAuth } from "../AuthContext.jsx";
import { usePlanMenu } from "../hooks/usePlanMenu.js";
import {
  ModalShell,
  ModalSection,
  ModalField,
  ModalFooter,
  ModalGrid,
} from "./ModalShell.jsx";

const ICONE = { pessoal: "🏠", empresa: "🏢" };

function iconeAmbiente(tipo) {
  return ICONE[tipo] || "🏢";
}

// ── Modal de criação de empresa ──────────────────────────────────────────────
function NovaEmpresaModal({ onClose, onCreated }) {
  const { token } = useAuth();
  const [nome, setNome] = useState("");
  const [segmento, setSegmento] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const handleSave = useCallback(async () => {
    if (!nome.trim()) { setErro("Informe o nome da empresa."); return; }
    setErro("");
    setLoading(true);
    try {
      const res = await fetch("/api/ambientes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          nome: nome.trim(),
          tipo: "empresa",
          ...(segmento.trim() ? { segmento: segmento.trim() } : {}),
          ...(cnpj.trim() ? { cnpj: cnpj.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error || "Erro ao criar empresa."); return; }
      onCreated(data.ambiente?.id);
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [nome, segmento, cnpj, authHeader, onCreated]);

  return (
    <ModalShell
      onClose={onClose}
      title="Nova Empresa"
      subtitle="Adicione outra empresa à sua conta"
      tone="neutral"
      size="sm"
      footer={
        <ModalFooter
          onClose={onClose}
          onSave={handleSave}
          saveLabel="Criar Empresa"
          loading={loading}
        />
      }
    >
      <ModalSection label="Identificação">
        <ModalField label="Nome da empresa" required>
          <input
            className="form-input"
            type="text"
            placeholder="Ex.: Loja Centro, Consultório Dr. Silva…"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </ModalField>
        <ModalGrid cols={2}>
          <ModalField label="Segmento" hint="Opcional">
            <input
              className="form-input"
              type="text"
              placeholder="Ex.: Comércio, Serviços…"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
            />
          </ModalField>
          <ModalField label="CNPJ" hint="Opcional">
            <input
              className="form-input"
              type="text"
              placeholder="00.000.000/0001-00"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
            />
          </ModalField>
        </ModalGrid>
        {erro && <p className="modal-field-hint" style={{ color: "var(--rn-danger, #f55)" }}>{erro}</p>}
      </ModalSection>
    </ModalShell>
  );
}

// ── Seletor principal ────────────────────────────────────────────────────────
export default function AmbienteSelector() {
  const { state, setState, reloadAppState } = useGestor();
  const { token } = useAuth();

  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef(null);

  const ambientes = state?.ambientes ?? [];
  const ambienteAtualId = state?.ambienteAtualId;
  const ambienteAtual = ambientes.find((a) => a.id === ambienteAtualId);

  const { maxAmbientes } = usePlanMenu(ambienteAtual?.tipo ?? "pessoal");
  const atingiuLimite = ambientes.length >= maxAmbientes;

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
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

  const handleCreated = useCallback(async (novoId) => {
    setShowModal(false);
    if (!novoId) return;
    await fetch(`/api/ambientes/${novoId}/selecionar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
    });
    setState((prev) => ({ ...prev, ambienteAtualId: novoId }));
    await reloadAppState({ skipFlush: false });
  }, [setState, reloadAppState, authHeader]);

  if (!ambientes.length) return null;

  const labelAtual = ambienteAtual
    ? `${iconeAmbiente(ambienteAtual.tipo)} ${ambienteAtual.nome}`
    : "Minhas Finanças";

  return (
    <>
      <div className="amb-selector" ref={dropdownRef}>
        <button
          type="button"
          className={`amb-selector__trigger${switching ? " amb-selector__trigger--loading" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={switching}
        >
          <span className="amb-selector__label">{labelAtual}</span>
          <span className="amb-selector__caret">{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div className="amb-dropdown" role="listbox">
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

            {atingiuLimite ? (
              <div className="amb-dropdown__upgrade">
                <span>Limite de {maxAmbientes} ambiente{maxAmbientes === 1 ? "" : "s"} atingido.</span>
                <a
                  href="#plano-assinatura"
                  className="amb-dropdown__upgrade-link"
                  onClick={() => {
                    setOpen(false);
                    window.dispatchEvent(new CustomEvent("gestor-navigate", { detail: { page: "plano-assinatura" } }));
                  }}
                >
                  Fazer upgrade
                </a>
              </div>
            ) : (
              <button
                type="button"
                className="amb-dropdown__add"
                onClick={() => { setOpen(false); setShowModal(true); }}
              >
                ➕ Nova Empresa
              </button>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <NovaEmpresaModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
