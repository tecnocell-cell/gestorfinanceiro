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

// -- Modo PF: painel com numero oficial --
function PfModePanel({ adminPhone, myNumbers }) {
  const formatted = adminPhone
    ? adminPhone.replace(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/, "+$1 ($2) $3-$4")
    : null;

  const fmtPhone = (p) =>
    p ? p.replace(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/, "+$1 ($2) $3-$4") : p;

  return (
    <Card>
      <div style={{ fontSize: 56, marginBottom: 20, lineHeight: 1 }}>&#128172;</div>
      <Title>WhatsApp CenterFlow</Title>
      <Subtitle>
        Envie mensagens para o numero oficial abaixo para registrar lancamentos financeiros
        diretamente pelo WhatsApp.
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

      {/* Numeros autorizados do usuario */}
      <div style={{
        background: C.greyLight,
        border: `1px solid ${C.greyBorder}`,
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 20,
        textAlign: "left",
      }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: C.text, fontWeight: 600 }}>
          Seu numero autorizado
        </p>
        {!myNumbers ? (
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>Carregando...</p>
        ) : myNumbers.length === 0 ? (
          <div style={{ fontSize: 13, color: "oklch(0.55 0.12 30)", background: "oklch(0.96 0.04 30)", border: "1px solid oklch(0.85 0.08 30)", borderRadius: 6, padding: "8px 12px" }}>
            Nenhum numero autorizado. Solicite ao administrador para liberar seu acesso.
          </div>
        ) : (
          myNumbers.map(n => (
            <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid oklch(0.90 0.005 0)" }}>
              <div>
                <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: C.text }}>
                  {fmtPhone(n.phone_number)}
                </span>
                {n.label && <span style={{ marginLeft: 8, fontSize: 12, color: C.textMuted }}>{n.label}</span>}
              </div>
              <span style={{
                padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600,
                background: n.active ? C.greenLight : C.greyLight,
                color: n.active ? C.green : C.grey,
                border: `1px solid ${n.active ? C.greenBorder : C.greyBorder}`,
              }}>
                {n.active ? "Autorizado" : "Inativo"}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Instrucoes */}
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
          <li>Envie uma mensagem descrevendo o lancamento pelo numero autorizado acima</li>
          <li>Confirme respondendo <strong>sim</strong> ou <strong>confirmo</strong></li>
          <li>O lancamento e registrado automaticamente</li>
        </ol>
      </div>
    </Card>
  );
}

// -- Pagina principal --
export default function WhatsAppPage() {
  const { status, phoneNumber, qrcode, loading, error, gatewayOk, connect, disconnect, recheckGateway } =
    useWhatsApp();
  const { user } = useAuth();

  const isPF = user?.tipo_perfil === "fisica";

  // PF: busca numero oficial e numeros autorizados ao montar
  const [adminPhone, setAdminPhone] = React.useState(null);
  const [myNumbers, setMyNumbers]   = React.useState(null); // null = carregando
  React.useEffect(() => {
    if (!isPF) return;
    import("../api.js").then(({ whatsappApi }) => {
      whatsappApi.pfConfig()
        .then(d => setAdminPhone(d?.admin_phone || null))
        .catch(() => {});
      whatsappApi.myAuthorized()
        .then(d => setMyNumbers(d?.authorized || []))
        .catch(() => setMyNumbers([]));
    });
  }, [isPF]);

  return (
    <PfPageShell title="WhatsApp">
      {isPF ? (
        <PfModePanel adminPhone={adminPhone} myNumbers={myNumbers} />
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
        </>
      )}
    </PfPageShell>
  );
}
