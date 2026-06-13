/**
 * leadFlow.js — Fluxo comercial para números NÃO autorizados.
 *
 * Quando um número desconhecido envia mensagem para a instância admin PF,
 * este módulo responde com um menu comercial e encaminha para cadastro.
 *
 * Estado armazenado em memória (Map com TTL de 30 min).
 */

import { sendText } from "./evolutionProvider.js";
import { BOT_AVATAR, DIV } from "./financePending.js";

const LANDING_URL =
  (process.env.PUBLIC_LANDING_URL || "https://fluxiva.app")
    .replace(/\/$/, "");

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// ── Estado em memória (TTL 30 min) ───────────────────────────────────────────

const LEAD_TTL_MS = 30 * 60 * 1000;

/** @type {Map<string, { step: string, ts: number }>} */
const leadState = new Map();

function getLeadState(phone) {
  const s = leadState.get(phone);
  if (!s) return null;
  if (Date.now() - s.ts > LEAD_TTL_MS) {
    leadState.delete(phone);
    return null;
  }
  return s;
}

function setLeadState(phone, step) {
  leadState.set(phone, { step, ts: Date.now() });
}

function clearLeadState(phone) {
  leadState.delete(phone);
}

// ── Detecção ─────────────────────────────────────────────────────────────────

const MENU_TRIGGERS = new Set([
  "oi", "ola", "olá", "opa", "ei", "eai", "e ai", "e aí",
  "bom dia", "boa tarde", "boa noite", "hello", "hi", "hey",
  "menu", "inicio", "início", "ajuda", "help", "começar", "comecar",
  "tudo bem", "tudo bom",
]);

function isMenuTrigger(text) {
  return MENU_TRIGGERS.has(norm(text));
}

// ── Mensagens ─────────────────────────────────────────────────────────────────

function msgMenuComercial(phone) {
  const cadastroLink = `${LANDING_URL}/cadastro?phone=${encodeURIComponent(phone)}&source=whatsapp`;
  return (
    `${BOT_AVATAR}\n` +
    `Olá! 👋 Bem-vindo à *Fluxiva* — gestão financeira inteligente.\n\n` +
    `Este canal é exclusivo para clientes cadastrados.\n` +
    `O que você deseja fazer?\n\n` +
    `1️⃣  Conhecer a Fluxiva\n` +
    `2️⃣  Criar minha conta grátis\n` +
    `3️⃣  Sair\n` +
    `${DIV}\n` +
    `_Responda com o número da opção._`
  );
}

function msgSaibaMais() {
  return (
    `${BOT_AVATAR}\n` +
    `📊 *Fluxiva — Gestão Financeira*\n\n` +
    `  ✅ Controle de receitas e despesas\n` +
    `  ✅ Lançamentos via WhatsApp (texto ou áudio)\n` +
    `  ✅ Relatórios e extratos em tempo real\n` +
    `  ✅ Planos para finanças pessoais, MEI e empresas\n` +
    `  ✅ Trial gratuito\n\n` +
    `🌐 Acesse: *${LANDING_URL}*\n` +
    `${DIV}\n` +
    `Digite *2* para criar sua conta agora ou *menu* para voltar.`
  );
}

function msgCriarConta(phone) {
  const link = `${LANDING_URL}/cadastro?phone=${encodeURIComponent(phone)}&source=whatsapp`;
  return (
    `${BOT_AVATAR}\n` +
    `🚀 *Criar conta na Fluxiva*\n\n` +
    `Acesse o link abaixo para se cadastrar.\n` +
    `Seu número já será vinculado automaticamente:\n\n` +
    `🔗 ${link}\n` +
    `${DIV}\n` +
    `_Após o cadastro, envie uma mensagem aqui para começar!_`
  );
}

function msgSaida() {
  return (
    `${BOT_AVATAR}\n` +
    `Até mais! 👋\n\n` +
    `_Se quiser conhecer a Fluxiva, é só mandar um "oi"._`
  );
}

// ── Handler principal ─────────────────────────────────────────────────────────

/**
 * Processa mensagem de número não autorizado.
 * Exibe menu comercial e encaminha para cadastro.
 *
 * @param {string} instanceName
 * @param {string} fromNumber
 * @param {string} msgBody
 */
export async function handleLeadMessage(instanceName, fromNumber, msgBody) {
  const t = norm(msgBody);
  const state = getLeadState(fromNumber);

  const send = (text) =>
    sendText(instanceName, fromNumber, text).catch(() => {});

  // Sempre volta ao menu com triggers gerais
  if (isMenuTrigger(t) || !state) {
    setLeadState(fromNumber, "menu");
    await send(msgMenuComercial(fromNumber));
    console.log(`[leadFlow] menu exibido: ${fromNumber}`);
    return;
  }

  // Opção 1 — saiba mais
  if (t === "1") {
    setLeadState(fromNumber, "saiba_mais");
    await send(msgSaibaMais());
    return;
  }

  // Opção 2 — criar conta
  if (t === "2") {
    setLeadState(fromNumber, "cadastro");
    await send(msgCriarConta(fromNumber));
    return;
  }

  // Opção 3 — sair
  if (["3", "sair", "tchau", "flw", "bye", "nao", "não"].includes(t)) {
    clearLeadState(fromNumber);
    await send(msgSaida());
    return;
  }

  // No estado saiba_mais: "2" já tratado acima; qualquer outra coisa → menu
  if (state.step === "saiba_mais" && t === "menu") {
    setLeadState(fromNumber, "menu");
    await send(msgMenuComercial(fromNumber));
    return;
  }

  // Resposta não reconhecida → reapresenta menu
  setLeadState(fromNumber, "menu");
  await send(msgMenuComercial(fromNumber));
}
