/**
 * WhatsAppPage — Módulo WhatsApp Financeiro (Fase 2: conexão QR)
 *
 * 3 estados de UI:
 *   disconnected → botão "Conectar WhatsApp"
 *   connecting   → QR code + instrução para escanear
 *   connected    → número do telefone + botão "Desconectar"
 *
 * Regras:
 *   - Nunca exibe webhook_secret nem EVOLUTION_API_KEY
 *   - Polling automático enquanto "connecting" (via useWhatsApp)
 *   - Inline styles apenas — nunca alterar styles.js nem arquivos CSS
 */
import React from "react";
import { useWhatsApp } from "../hooks/useWhatsApp.js";
import { useAuth } from "../AuthContext.jsx";
import { useGestor } from "../GestorContext.jsx";
import PfPageShell from "../components/pf/PfPageShell.jsx";

// ─── Paleta (inline — nunca tocamos em styles.js) ────────────────────────────
const C = {
  green:       "oklch(0.42 0.08 155)",
  greenLight:  "oklch(0.94 0.04 155)",
  greenBorder: "oklch(0.80 0.06 155)",
  red:         "oklch(0.58 0.22 27)",
  redLight:    "oklch(0.96 0.04 27)",
  redBorder:   "oklch(0.80 0.12 27)",
  grey:        "oklch(0.50 0.01 0)",
  greyLight:   "oklch(0.96 0.005 0)",
  greyBorder:  "oklch(0.88 0.005 0)",
  text:        "oklch(0.20 0.015 155)",
  textMuted:   "oklch(0.55 0.01 155)",
};

// ─── Componentes de estado ────────────────────────────────────────────────────

function Card({ children }) {
  return (
    <div style={{
      maxWidth: 480,
      margin: "0 auto",
      background: "#fff",
      border: `1px solid ${C.greyBorder}`,
      borderRadius: 16,
      padding: "40px 36px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      textAlign: "center",
    }}>
      {children}
    </div>
  );
}

function Title({ children }) {
  return (
    <h2 style={{
      margin: "0 0 8px",
      fontSize: 22,
      fontWeight: 700,
      color: C.text,
      letterSpacing: "-0.3px",
    }}>
      {children}
    </h2>
  );
}

function Subtitle({ children }) {
  return (
    <p style={{
      margin: "0 0 28px",
      fontSize: 14,
      color: C.textMuted,
      lineHeight: 1.5,
    }}>
      {children}
    </p>
  );
}

function Btn({ onClick, disabled, color, bg, border, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "11px 28px",
        borderRadius: 8,
        border: `1px solid ${border}`,
        background: bg,
        color,
        fontWeight: 600,
        fontSize: 15,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "opacity 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ── Estado: desconectado ──────────────────────────────────────────────────────
function DisconnectedState({ onConnect, loading, error }) {
  return (
    <Card>
      <div style={{ fontSize: 56, marginBottom: 20, lineHeight: 1 }}>💬</div>
      <Title>Conectar WhatsApp</Title>
      <Subtitle>
        Receba e confirme lançamentos financeiros diretamente pelo WhatsApp.
        Conecte seu número para começar.
      </Subtitle>

      {error && (
        <div style={{
          background: C.redLight,
          border: `1px solid ${C.redBorder}`,
          color: C.red,
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 20,
          fontSize: 13,
          textAlign: "left",
        }}>
          {error}
        </div>
      )}

      <Btn
        onClick={onConnect}
        disabled={loading}
        color="#fff"
        bg={C.green}
        border={C.green}
      >
        {loading ? "Iniciando…" : "Conectar WhatsApp"}
      </Btn>
    </Card>
  );
}

// ── Estado: aguardando QR ─────────────────────────────────────────────────────
function ConnectingState({ qrcode, onCancel, loading, error }) {
  return (
    <Card>
      <Title>Escaneie o QR Code</Title>
      <Subtitle>
        Abra o WhatsApp no celular → Menu (⋮) → Dispositivos vinculados → Vincular dispositivo
      </Subtitle>

      {error && (
        <div style={{
          background: C.redLight,
          border: `1px solid ${C.redBorder}`,
          color: C.red,
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 16,
          fontSize: 13,
          textAlign: "left",
        }}>
          {error}
        </div>
      )}

      {qrcode ? (
        <div style={{
          display: "inline-block",
          padding: 12,
          border: `1px solid ${C.greyBorder}`,
          borderRadius: 12,
          marginBottom: 24,
          background: "#fff",
        }}>
          <img
            src={qrcode}
            alt="QR Code WhatsApp"
            style={{ width: 220, height: 220, display: "block" }}
          />
        </div>
      ) : (
        <div style={{
          width: 220,
          height: 220,
          margin: "0 auto 24px",
          background: C.greyLight,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.textMuted,
          fontSize: 13,
          border: `1px solid ${C.greyBorder}`,
        }}>
          Carregando QR…
        </div>
      )}

      <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>
        O QR code expira em alguns minutos. Se necessário, a página atualiza automaticamente.
      </p>

      <Btn
        onClick={onCancel}
        disabled={loading}
        color={C.grey}
        bg="#fff"
        border={C.greyBorder}
      >
        {loading ? "Cancelando…" : "Cancelar"}
      </Btn>
    </Card>
  );
}

// ── Estado: conectado ─────────────────────────────────────────────────────────
function ConnectedState({ phoneNumber, onDisconnect, loading, error }) {
  const phone = phoneNumber
    ? phoneNumber.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, "+55 ($1) $2-$3")
    : "Número não disponível";

  return (
    <Card>
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: C.greenLight,
        border: `2px solid ${C.greenBorder}`,
        fontSize: 30,
        marginBottom: 20,
      }}>
        ✅
      </div>
      <Title>WhatsApp Conectado</Title>
      <p style={{
        fontSize: 15,
        fontWeight: 600,
        color: C.text,
        margin: "0 0 6px",
      }}>
        {phone}
      </p>
      <Subtitle>
        Seu WhatsApp está ativo. Envie mensagens para registrar lançamentos financeiros.
      </Subtitle>

      {error && (
        <div style={{
          background: C.redLight,
          border: `1px solid ${C.redBorder}`,
          color: C.red,
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 20,
          fontSize: 13,
          textAlign: "left",
        }}>
          {error}
        </div>
      )}

      <div style={{
        background: C.greenLight,
        border: `1px solid ${C.greenBorder}`,
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 24,
        textAlign: "left",
      }}>
        <p style={{ margin: 0, fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 6 }}>
          Como usar:
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>
          <li>Envie uma mensagem descrevendo o lançamento</li>
          <li>Confirme respondendo <strong>sim</strong> ou <strong>confirmo</strong></li>
          <li>O lançamento é registrado automaticamente</li>
        </ul>
      </div>

      <Btn
        onClick={onDisconnect}
        disabled={loading}
        color={C.red}
        bg={C.redLight}
        border={C.redBorder}
      >
        {loading ? "Desconectando…" : "Desconectar WhatsApp"}
      </Btn>
    </Card>
  );
}

// ── Banner: Gateway indisponível ──────────────────────────────────────────────
function GatewayDownBanner({ onRetry }) {
  return (
    <div style={{
      background: "oklch(0.97 0.04 60)",
      border: "1px solid oklch(0.82 0.10 60)",
      borderRadius: 10,
      padding: "14px 18px",
      marginBottom: 20,
      display: "flex",
      alignItems: "center",
      gap: 12,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 14, color: "oklch(0.40 0.10 60)" }}>
          Serviço WhatsApp indisponível
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "oklch(0.50 0.06 60)" }}>
          O Gateway WhatsApp (CT103) não está respondendo. Contate o administrador do sistema.
        </p>
      </div>
      <button
        onClick={onRetry}
        style={{
          flexShrink: 0,
          padding: "6px 14px",
          borderRadius: 6,
          border: "1px solid oklch(0.75 0.10 60)",
          background: "#fff",
          color: "oklch(0.40 0.10 60)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Tentar novamente
      </button>
    </div>
  );
}

// -- Modo PF: painel com numero oficial + auto-gerenciamento de numero autorizado --
function PfModePanel({ adminPhone }) {
  const fmtPhone = (p) =>
    p ? p.replace(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/, "+$1 ($2) $3-$4") : p;

  const formatted = fmtPhone(adminPhone);

  // Estado do numero autorizado do proprio usuario
  // undefined = carregando | null = nenhum cadastrado | objeto = cadastrado
  const [myNumber, setMyNumber]     = React.useState(undefined);
  const [inputPhone, setInputPhone] = React.useState("");
  const [saving, setSaving]         = React.useState(false);
  const [removing, setRemoving]     = React.useState(false);
  const [editing, setEditing]       = React.useState(false);
  const [apiError, setApiError]     = React.useState(null);
  const [success, setSuccess]       = React.useState(null);

  React.useEffect(() => {
    import("../api.js").then(({ whatsappApi }) => {
      whatsappApi.listAuthorized()
        .then(d => {
          const nums = d?.authorized || [];
          setMyNumber(nums.length > 0 ? nums[0] : null);
        })
        .catch(() => setMyNumber(null));
    });
  }, []);

  const handleSave = async () => {
    setApiError(null); setSuccess(null); setSaving(true);
    try {
      const { whatsappApi } = await import("../api.js");
      const phone = inputPhone.replace(/\D/g, "");
      if (!phone || phone.length < 8) {
        setApiError("Informe um numero valido com DDI e DDD. Ex: 5511999999999");
        return;
      }
      if (editing && myNumber) {
        await whatsappApi.deleteAuthorized(myNumber.id);
      }
      const d = await whatsappApi.addAuthorized({ phone_number: phone, label: "Meu numero" });
      setMyNumber(d.authorized);
      setInputPhone("");
      setEditing(false);
      setSuccess("Numero cadastrado! Agora voce pode enviar mensagens para o numero oficial CenterFlow.");
    } catch (e) {
      setApiError(e.message || "Erro ao cadastrar numero.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!myNumber) return;
    if (!confirm("Remover seu numero autorizado? Voce nao podera mais usar o WhatsApp CenterFlow ate cadastrar novamente.")) return;
    setApiError(null); setSuccess(null); setRemoving(true);
    try {
      const { whatsappApi } = await import("../api.js");
      await whatsappApi.deleteAuthorized(myNumber.id);
      setMyNumber(null);
      setEditing(false);
      setInputPhone("");
      setSuccess(null);
    } catch (e) {
      setApiError(e.message || "Erro ao remover numero.");
    } finally {
      setRemoving(false);
    }
  };

  const inp = {
    flex: 1, padding: "10px 12px",
    border: `1px solid ${C.greyBorder}`, borderRadius: 8,
    fontSize: 15, boxSizing: "border-box", letterSpacing: "0.3px",
  };

  let authorizedSection;
  if (myNumber === undefined) {
    authorizedSection = (
      <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>Carregando...</p>
    );
  } else if (myNumber && !editing) {
    // Numero ja cadastrado
    authorizedSection = (
      <div>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: C.greenLight, border: `1px solid ${C.greenBorder}`,
          borderRadius: 8, padding: "12px 14px", marginBottom: 10,
        }}>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 12, color: C.textMuted, fontWeight: 500 }}>
              Seu numero autorizado
            </p>
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 17, color: C.text }}>
              {fmtPhone(myNumber.phone_number)}
            </span>
          </div>
          <span style={{
            padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600,
            background: myNumber.active ? C.greenLight : C.greyLight,
            color: myNumber.active ? C.green : C.grey,
            border: `1px solid ${myNumber.active ? C.greenBorder : C.greyBorder}`,
          }}>
            {myNumber.active ? "Ativo" : "Inativo"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { setEditing(true); setInputPhone(""); setApiError(null); setSuccess(null); }}
            style={{
              flex: 1, padding: "8px", borderRadius: 7,
              border: `1px solid ${C.greyBorder}`, background: "#fff",
              color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            Trocar numero
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            style={{
              flex: 1, padding: "8px", borderRadius: 7,
              border: `1px solid ${C.redBorder}`, background: C.redLight,
              color: C.red, fontSize: 13, fontWeight: 600,
              cursor: removing ? "not-allowed" : "pointer", opacity: removing ? 0.6 : 1,
            }}
          >
            {removing ? "Removendo..." : "Remover numero"}
          </button>
        </div>
      </div>
    );
  } else {
    // Sem numero ou modo edicao
    authorizedSection = (
      <div>
        {editing && (
          <p style={{ margin: "0 0 10px", fontSize: 13, color: C.textMuted }}>
            Informe o novo numero. O anterior sera substituido ao salvar.
          </p>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            style={inp}
            value={inputPhone}
            onChange={e => { setInputPhone(e.target.value); setApiError(null); }}
            placeholder="5511999999999"
            type="tel"
          />
          <button
            onClick={handleSave}
            disabled={saving || !inputPhone}
            style={{
              padding: "10px 18px", borderRadius: 8,
              border: `1px solid ${C.green}`, background: C.green,
              color: "#fff", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap",
              cursor: saving || !inputPhone ? "not-allowed" : "pointer",
              opacity: saving || !inputPhone ? 0.55 : 1,
            }}
          >
            {saving ? "Salvando..." : "Cadastrar"}
          </button>
          {editing && (
            <button
              onClick={() => { setEditing(false); setInputPhone(""); setApiError(null); }}
              style={{
                padding: "10px 14px", borderRadius: 8,
                border: `1px solid ${C.greyBorder}`, background: "#fff",
                color: C.textMuted, fontSize: 14, cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          )}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: C.textMuted }}>
          Informe DDI + DDD + numero. Ex: 5511999999999
        </p>
      </div>
    );
  }

  return (
    <Card>
      <div style={{ fontSize: 56, marginBottom: 20, lineHeight: 1 }}>&#128172;</div>
      <Title>WhatsApp CenterFlow</Title>
      <Subtitle>
        Cadastre seu numero e envie mensagens para o numero oficial abaixo
        para registrar lancamentos financeiros pelo WhatsApp.
      </Subtitle>

      {/* Numero oficial */}
      <div style={{
        background: C.greenLight,
        border: `1px solid ${C.greenBorder}`,
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 20,
      }}>
        <p style={{ margin: "0 0 6px", fontSize: 13, color: C.textMuted, fontWeight: 500 }}>
          Numero oficial do CenterFlow
        </p>
        {formatted ? (
          <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: "0.5px" }}>
            {formatted}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: C.textMuted, fontStyle: "italic" }}>
            Numero ainda nao configurado pelo administrador.
          </p>
        )}
      </div>

      {/* Feedback erro / sucesso */}
      {apiError && (
        <div style={{
          background: C.redLight, border: `1px solid ${C.redBorder}`,
          color: C.red, borderRadius: 8, padding: "10px 14px",
          marginBottom: 14, fontSize: 13, textAlign: "left",
        }}>
          {apiError}
        </div>
      )}
      {success && (
        <div style={{
          background: C.greenLight, border: `1px solid ${C.greenBorder}`,
          color: C.green, borderRadius: 8, padding: "10px 14px",
          marginBottom: 14, fontSize: 13, textAlign: "left",
        }}>
          {success}
        </div>
      )}

      {/* Numero autorizado do usuario */}
      <div style={{
        background: C.greyLight,
        border: `1px solid ${C.greyBorder}`,
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 20,
        textAlign: "left",
      }}>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: C.text, fontWeight: 600 }}>
          Meu numero autorizado
        </p>
        {authorizedSection}
      </div>

      {/* Instrucoes — so exibe apos numero cadastrado */}
      {myNumber && !editing && (
        <div style={{
          background: C.greyLight,
          border: `1px solid ${C.greyBorder}`,
          borderRadius: 10,
          padding: "14px 16px",
          textAlign: "left",
        }}>
          <p style={{ margin: "0 0 6px", fontSize: 13, color: C.text, fontWeight: 600 }}>
            Como usar:
          </p>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: C.textMuted, lineHeight: 1.8 }}>
            <li>Salve o numero oficial na sua agenda</li>
            <li>Envie uma mensagem descrevendo o lancamento do seu numero acima</li>
            <li>Confirme respondendo <strong>sim</strong> ou <strong>confirmo</strong></li>
            <li>O lancamento e registrado automaticamente</li>
          </ol>
        </div>
      )}
    </Card>
  );
}

// ── Painel de numeros autorizados (PJ) ───────────────────────────────────────
function PjAuthorizedPanel() {
  const [numbers, setNumbers] = React.useState(null); // null = carregando
  const [form, setForm]       = React.useState({ phone_number: "", label: "" });
  const [addError, setAddError] = React.useState(null);
  const [adding, setAdding]   = React.useState(false);

  const load = React.useCallback(() => {
    import("../api.js").then(({ whatsappApi }) => {
      whatsappApi.listAuthorized()
        .then(d => setNumbers(d?.authorized || []))
        .catch(() => setNumbers([]));
    });
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const add = async () => {
    setAddError(null);
    setAdding(true);
    try {
      const { whatsappApi } = await import("../api.js");
      const phone = form.phone_number.replace(/\D/g, "");
      if (!phone) { setAddError("Informe o telefone."); return; }
      const d = await whatsappApi.addAuthorized({ phone_number: phone, label: form.label });
      setNumbers(prev => [...(prev || []), d.authorized]);
      setForm({ phone_number: "", label: "" });
    } catch (e) {
      setAddError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (row) => {
    try {
      const { whatsappApi } = await import("../api.js");
      const d = await whatsappApi.updateAuthorized(row.id, { active: !row.active });
      setNumbers(prev => prev.map(r => r.id === row.id ? { ...r, ...d.authorized } : r));
    } catch (e) { alert("Erro: " + e.message); }
  };

  const remove = async (row) => {
    if (!confirm(`Remover ${row.phone_number}?`)) return;
    try {
      const { whatsappApi } = await import("../api.js");
      await whatsappApi.deleteAuthorized(row.id);
      setNumbers(prev => prev.filter(r => r.id !== row.id));
    } catch (e) { alert("Erro: " + e.message); }
  };

  const fmtPhone = (p) =>
    p ? p.replace(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/, "+$1 ($2) $3-$4") : p;

  const inp = {
    width: "100%",
    padding: "8px 10px",
    border: `1px solid ${C.greyBorder}`,
    borderRadius: 6,
    fontSize: 14,
    boxSizing: "border-box",
  };

  return (
    <div style={{
      maxWidth: 560,
      margin: "24px auto 0",
      background: "#fff",
      border: `1px solid ${C.greyBorder}`,
      borderRadius: 16,
      padding: "28px 32px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: C.text }}>
        Numeros autorizados
      </h3>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: C.textMuted }}>
        Numeros que podem enviar comandos para esta conta. Se vazio, so o numero da conta conectada e aceito.
      </p>

      {/* Formulario de adicao */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end", marginBottom: addError ? 8 : 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>
            Telefone
          </label>
          <input
            style={inp}
            value={form.phone_number}
            onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
            placeholder="5511999999999"
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>
            Descricao (opcional)
          </label>
          <input
            style={inp}
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            placeholder="Principal, Contador..."
          />
        </div>
        <button
          onClick={add}
          disabled={adding || !form.phone_number}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: `1px solid ${C.green}`,
            background: C.green,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: adding || !form.phone_number ? "not-allowed" : "pointer",
            opacity: adding || !form.phone_number ? 0.55 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {adding ? "..." : "+ Adicionar"}
        </button>
      </div>

      {addError && (
        <div style={{
          background: C.redLight,
          border: `1px solid ${C.redBorder}`,
          color: C.red,
          borderRadius: 6,
          padding: "8px 12px",
          fontSize: 13,
          marginBottom: 12,
        }}>
          {addError}
        </div>
      )}

      {/* Lista */}
      {numbers === null ? (
        <p style={{ fontSize: 13, color: C.textMuted, textAlign: "center", padding: "16px 0" }}>
          Carregando...
        </p>
      ) : numbers.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textMuted, textAlign: "center", padding: "16px 0" }}>
          Nenhum numero cadastrado.
        </p>
      ) : (
        numbers.map(row => (
          <div key={row.id} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 0",
            borderBottom: `1px solid ${C.greyBorder}`,
          }}>
            <div>
              <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: C.text }}>
                {fmtPhone(row.phone_number)}
              </span>
              {row.label && (
                <span style={{ marginLeft: 8, fontSize: 12, color: C.textMuted }}>{row.label}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{
                padding: "3px 10px",
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 600,
                background: row.active ? C.greenLight : C.greyLight,
                color:      row.active ? C.green      : C.grey,
                border: `1px solid ${row.active ? C.greenBorder : C.greyBorder}`,
              }}>
                {row.active ? "Ativo" : "Inativo"}
              </span>
              <button
                onClick={() => toggle(row)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${row.active ? C.redBorder : C.greenBorder}`,
                  background: "#fff",
                  color: row.active ? C.red : C.green,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {row.active ? "Desativar" : "Ativar"}
              </button>
              <button
                onClick={() => remove(row)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${C.redBorder}`,
                  background: C.redLight,
                  color: C.red,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Remover
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Inbox de mensagens recebidas ────────────────────────────────────────────
function WhatsAppInbox() {
  const [msgs, setMsgs]         = React.useState(null); // null = carregando
  const [total, setTotal]       = React.useState(0);
  const [loading, setLoading]   = React.useState(false);
  const [offset, setOffset]     = React.useState(0);
  const LIMIT = 20;

  const load = React.useCallback(async (off = 0) => {
    setLoading(true);
    try {
      const { whatsappApi } = await import("../api.js");
      const d = await whatsappApi.inbox({ limit: LIMIT, offset: off });
      setMsgs(d?.inbox || []);
      setTotal(d?.total || 0);
      setOffset(off);
    } catch { setMsgs([]); } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(0); }, [load]);

  const fmtPhone = (p) =>
    p ? p.replace(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/, "+$1 ($2) $3-$4") : p;

  const fmtTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{
      maxWidth: 560, margin: "24px auto 0",
      background: "#fff", border: `1px solid ${C.greyBorder}`,
      borderRadius: 16, padding: "28px 32px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>
          WhatsApp Inbox
        </h3>
        <button
          onClick={() => load(0)}
          disabled={loading}
          style={{
            padding: "4px 12px", borderRadius: 6, fontSize: 12,
            border: `1px solid ${C.greyBorder}`, background: "#fff",
            color: C.textMuted, cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          ↺ Atualizar
        </button>
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: C.textMuted }}>
        Mensagens recebidas via WhatsApp. Somente leitura.
      </p>

      {msgs === null ? (
        <p style={{ fontSize: 13, color: C.textMuted, textAlign: "center", padding: "16px 0" }}>
          Carregando...
        </p>
      ) : msgs.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textMuted, textAlign: "center", padding: "16px 0" }}>
          Nenhuma mensagem recebida ainda.
        </p>
      ) : (
        <>
          {msgs.map(m => (
            <div key={m.id} style={{
              display: "flex", gap: 12, alignItems: "flex-start",
              padding: "10px 0", borderBottom: `1px solid ${C.greyBorder}`,
            }}>
              <span style={{ fontSize: 11, color: C.textMuted, whiteSpace: "nowrap", marginTop: 2, minWidth: 70 }}>
                {fmtTime(m.created_at)}
              </span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 2 }}>
                  {fmtPhone(m.from_number)}
                </span>
                <span style={{ fontSize: 14, color: C.text }}>
                  {m.message_text}
                </span>
              </div>
              <span style={{
                padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                background: m.status === "processed" ? C.greenLight : m.status === "ignored" ? C.greyLight : "oklch(0.97 0.04 60)",
                color:      m.status === "processed" ? C.green      : m.status === "ignored" ? C.grey      : "oklch(0.42 0.12 60)",
                border: `1px solid ${m.status === "processed" ? C.greenBorder : m.status === "ignored" ? C.greyBorder : "oklch(0.80 0.10 60)"}`,
              }}>
                {m.status === "processed" ? "Processado" : m.status === "ignored" ? "Ignorado" : "Pendente"}
              </span>
            </div>
          ))}

          {/* Paginacao simples */}
          {total > LIMIT && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>{total} mensagem(s) no total</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => load(Math.max(0, offset - LIMIT))}
                  disabled={offset === 0 || loading}
                  style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, border: `1px solid ${C.greyBorder}`, background: "#fff", cursor: offset === 0 ? "not-allowed" : "pointer", opacity: offset === 0 ? 0.4 : 1 }}
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => load(offset + LIMIT)}
                  disabled={offset + LIMIT >= total || loading}
                  style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, border: `1px solid ${C.greyBorder}`, background: "#fff", cursor: offset + LIMIT >= total ? "not-allowed" : "pointer", opacity: offset + LIMIT >= total ? 0.4 : 1 }}
                >
                  Próximo →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Histórico de pré-lançamentos ───────────────────────────────────────────
function WhatsAppPendingPanel() {
  const [items, setItems]       = React.useState(null);
  const [total, setTotal]       = React.useState(0);
  const [loading, setLoading]   = React.useState(false);
  const [offset, setOffset]     = React.useState(0);
  const LIMIT = 20;

  const load = React.useCallback(async (off = 0) => {
    setLoading(true);
    try {
      const { whatsappApi } = await import("../api.js");
      const d = await whatsappApi.pending({ limit: LIMIT, offset: off });
      setItems(d?.pending || []);
      setTotal(d?.total || 0);
      setOffset(off);
    } catch { setItems([]); } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(0); }, [load]);

  const fmtTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const fmtValor = (v) =>
    `R$ ${parseFloat(v || 0).toFixed(2).replace(".", ",")}`;

  const STATUS_STYLE = {
    pending_confirmation: {
      label: "Aguardando",
      bg: "oklch(0.97 0.04 60)",
      color: "oklch(0.42 0.12 60)",
      border: "oklch(0.80 0.10 60)",
    },
    confirmed: {
      label: "Confirmado ✅",
      bg: C.greenLight,
      color: C.green,
      border: C.greenBorder,
    },
    rejected: {
      label: "Rejeitado",
      bg: C.redLight,
      color: C.red,
      border: C.redBorder,
    },
  };

  return (
    <div style={{
      maxWidth: 560, margin: "24px auto 0",
      background: "#fff", border: `1px solid ${C.greyBorder}`,
      borderRadius: 16, padding: "28px 32px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.text }}>
          Pré-lançamentos WhatsApp
        </h3>
        <button
          onClick={() => load(0)}
          disabled={loading}
          style={{
            padding: "4px 12px", borderRadius: 6, fontSize: 12,
            border: `1px solid ${C.greyBorder}`, background: "#fff",
            color: C.textMuted, cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          ↺ Atualizar
        </button>
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: C.textMuted }}>
        Lançamentos identificados via WhatsApp. Responda SIM ou NAO no WhatsApp para confirmar.
      </p>

      {items === null ? (
        <p style={{ fontSize: 13, color: C.textMuted, textAlign: "center", padding: "16px 0" }}>
          Carregando...
        </p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 13, color: C.textMuted, textAlign: "center", padding: "16px 0" }}>
          Nenhum pré-lançamento ainda.
        </p>
      ) : (
        <>
          {items.map(item => {
            const st = STATUS_STYLE[item.status] || STATUS_STYLE.pending_confirmation;
            const isReceita = item.tipo === "Receita";
            return (
              <div key={item.id} style={{
                display: "flex", gap: 12, alignItems: "flex-start",
                padding: "12px 0", borderBottom: `1px solid ${C.greyBorder}`,
              }}>
                {/* Tipo badge */}
                <span style={{
                  flexShrink: 0, marginTop: 2,
                  padding: "2px 9px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                  background: isReceita ? C.greenLight : C.redLight,
                  color:      isReceita ? C.green      : C.red,
                  border: `1px solid ${isReceita ? C.greenBorder : C.redBorder}`,
                  whiteSpace: "nowrap",
                }}>
                  {isReceita ? "↑ Receita" : "↓ Despesa"}
                </span>

                {/* Valor + descrição */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>
                    {fmtValor(item.valor)}
                  </span>
                  {item.descricao && (
                    <span style={{ marginLeft: 8, fontSize: 13, color: C.textMuted }}>
                      {item.descricao}
                    </span>
                  )}
                  <span style={{ display: "block", fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {fmtTime(item.created_at)}
                  </span>
                </div>

                {/* Status */}
                <span style={{
                  flexShrink: 0,
                  padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                  background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                }}>
                  {st.label}
                </span>
              </div>
            );
          })}

          {total > LIMIT && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>{total} registro(s)</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => load(Math.max(0, offset - LIMIT))}
                  disabled={offset === 0 || loading}
                  style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, border: `1px solid ${C.greyBorder}`, background: "#fff", cursor: offset === 0 ? "not-allowed" : "pointer", opacity: offset === 0 ? 0.4 : 1 }}
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => load(offset + LIMIT)}
                  disabled={offset + LIMIT >= total || loading}
                  style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, border: `1px solid ${C.greyBorder}`, background: "#fff", cursor: offset + LIMIT >= total ? "not-allowed" : "pointer", opacity: offset + LIMIT >= total ? 0.4 : 1 }}
                >
                  Próximo →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// -- Pagina principal --
export default function WhatsAppPage() {
  const { status, phoneNumber, qrcode, loading, error, gatewayOk, connect, disconnect, recheckGateway } =
    useWhatsApp();
  const { user } = useAuth();
  // tipo já resolve impersonação: impersonatingUser?.tipo_perfil ?? user?.tipo_perfil ?? empresa.tipo
  const { tipo } = useGestor();

  const isPF = tipo === "fisica";

  // PF: busca numero oficial ao montar (numeros autorizados gerenciados dentro de PfModePanel)
  const [adminPhone, setAdminPhone] = React.useState(null);
  React.useEffect(() => {
    if (!isPF) return;
    import("../api.js").then(({ whatsappApi }) => {
      whatsappApi.pfConfig()
        .then(d => setAdminPhone(d?.admin_phone || null))
        .catch(() => {});
    });
  }, [isPF]);

  return (
    <PfPageShell title="WhatsApp">
      {isPF ? (
        <>
          <PfModePanel adminPhone={adminPhone} />
          <WhatsAppPendingPanel />
          <WhatsAppInbox />
        </>
      ) : (
        <>
          {gatewayOk === false && (
            <GatewayDownBanner onRetry={recheckGateway} />
          )}

          {status === null && !error && (
            <div style={{ textAlign: "center", padding: 40, color: C.textMuted, fontSize: 14 }}>
              Carregando...
            </div>
          )}

          {status === "disconnected" && (
            <DisconnectedState onConnect={connect} loading={loading} error={error} />
          )}

          {status === "connecting" && (
            <ConnectingState qrcode={qrcode} onCancel={disconnect} loading={loading} error={error} />
          )}

          {status === "connected" && (
            <ConnectedState
              phoneNumber={phoneNumber}
              onDisconnect={disconnect}
              loading={loading}
              error={error}
            />
          )}

          {/* Numeros autorizados — sempre visivel para PJ */}
          <PjAuthorizedPanel />
          <WhatsAppPendingPanel />
          <WhatsAppInbox />
        </>
      )}
    </PfPageShell>
  );
}
