/**
 * billingFlow.js — Fluxo de pagamento de mensalidade via WhatsApp.
 *
 * Comandos de entrada: "4", "mensalidade", "plano", "renovar", "assinar"
 *
 * Fluxo:
 *   1. detectBillingCommand(text) → true/false
 *   2. handleBillingCommand()     → verifica assinatura e mostra opções
 *   3. handleBillingPendingFlow() → trata resposta "1"(PIX) | "2"(Cartão) | "3"(Cancelar)
 *
 * Estado armazenado em whatsapp_pending com action = "billing_payment".
 */

import { query }            from "../db.js";
import { sendText, sendMedia } from "./evolutionProvider.js";
import {
  createPending,
  deletePending,
  BOT_AVATAR,
  DIV,
} from "./financePending.js";

/** Formata centavos → R$ X,XX */
function fmtMoney(centavos) {
  const n = Number(centavos || 0) / 100;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
import {
  createCheckout,
  regeneratePendingFaturaCheckout,
} from "../billing/billingService.js";
import { getPublicPaymentMethods } from "../billing/paymentGatewayFactory.js";

const APP_URL =
  (process.env.APP_URL || process.env.PUBLIC_API_URL || "https://financeiro.fluxiva.app")
    .replace(/\/$/, "");

const PORTAL_LINK = `${APP_URL}/#/plano`;

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// ── Triggers ─────────────────────────────────────────────────────────────────

const BILLING_TRIGGERS = new Set([
  "4", "mensalidade", "plano", "renovar", "assinar", "assinatura",
  "pagar plano", "pagar mensalidade", "renovar plano", "ver plano",
]);

export function detectBillingCommand(text) {
  return BILLING_TRIGGERS.has(norm(text));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getAssinatura(usuarioId) {
  const { rows } = await query(
    `SELECT a.id, a.status, a.trial_ate, a.acesso_ate, a.proxima_cobranca,
            p.slug AS plano_slug, p.nome AS plano_nome, p.preco_centavos
       FROM assinaturas a
       JOIN planos p ON p.id = a.plano_id
      WHERE a.usuario_id = $1
      LIMIT 1`,
    [usuarioId]
  );
  return rows[0] || null;
}

async function getFaturaPendente(usuarioId) {
  const { rows } = await query(
    `SELECT id, valor_centavos, vencimento, gateway
       FROM faturas
      WHERE usuario_id = $1 AND status = 'pendente'
      ORDER BY created_at DESC
      LIMIT 1`,
    [usuarioId]
  );
  return rows[0] || null;
}

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const diff = new Date(isoDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(diff / 86400000);
}

// ── Mensagens ────────────────────────────────────────────────────────────────

function msgEmDia(assinatura) {
  const venc = assinatura.proxima_cobranca || assinatura.acesso_ate;
  const dias = daysUntil(venc);
  const prazoStr = dias != null && dias >= 0
    ? `em *${dias} dia${dias !== 1 ? "s" : ""}*`
    : "";
  return (
    `${BOT_AVATAR}\n` +
    `✅ *Assinatura em dia!*\n\n` +
    `  📦 Plano   ${assinatura.plano_nome}\n` +
    `  💰 Valor   ${fmtMoney(assinatura.preco_centavos)}/mês\n` +
    (prazoStr ? `  📅 Próxima cobrança ${prazoStr}\n` : "") +
    `${DIV}\n` +
    `_Nenhuma ação necessária no momento._`
  );
}

function msgOpcoesPagamento(assinatura, fatura) {
  const valor = fatura
    ? fmtMoney(fatura.valor_centavos)
    : fmtMoney(assinatura.preco_centavos);

  let header;
  if (assinatura.status === "trial") {
    const dias = daysUntil(assinatura.trial_ate);
    header = dias != null && dias >= 0
      ? `⚠️ *Trial vence em ${dias} dia${dias !== 1 ? "s" : ""}*`
      : `🚨 *Trial encerrado*`;
  } else {
    header = `🔔 *Renovação da assinatura*`;
  }

  return (
    `${BOT_AVATAR}\n` +
    `${header}\n\n` +
    `  📦 Plano   ${assinatura.plano_nome}\n` +
    `  💰 Valor   ${valor}\n` +
    `${DIV}\n` +
    `Escolha a forma de pagamento:\n\n` +
    `1️⃣  QR Code PIX\n` +
    `2️⃣  Link para cartão de crédito/débito\n` +
    `3️⃣  Cancelar`
  );
}

function msgPixGerado(copiaECola) {
  return (
    `${BOT_AVATAR}\n` +
    `✅ *PIX gerado!*\n\n` +
    `  Escaneie o QR code acima ou copie o código abaixo:\n\n` +
    `\`\`\`\n${copiaECola}\n\`\`\`\n` +
    `${DIV}\n` +
    `_Após pagar, seu acesso é ativado automaticamente._`
  );
}

function msgPixSemImagem(copiaECola) {
  return (
    `${BOT_AVATAR}\n` +
    `✅ *PIX gerado!*\n\n` +
    `Copie o código abaixo e cole no seu app bancário:\n\n` +
    `\`\`\`\n${copiaECola}\n\`\`\`\n` +
    `${DIV}\n` +
    `_Após pagar, seu acesso é ativado automaticamente._`
  );
}

function msgCartao() {
  return (
    `${BOT_AVATAR}\n` +
    `💳 *Pagamento com cartão*\n\n` +
    `Acesse o portal e finalize com cartão de crédito ou débito:\n\n` +
    `🔗 ${PORTAL_LINK}\n` +
    `${DIV}\n` +
    `_Após pagar, seu acesso é ativado automaticamente._`
  );
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Verifica assinatura e inicia fluxo de pagamento.
 * Chamado quando o usuário digita "mensalidade", "4", etc.
 */
export async function handleBillingCommand(usuarioId, fromNumber, instanceName) {
  const assinatura = await getAssinatura(usuarioId);

  if (!assinatura) {
    await sendText(instanceName, fromNumber,
      `${BOT_AVATAR}\n⚠️ Nenhuma assinatura encontrada para sua conta.\n${DIV}\n_Acesse o app para mais informações._`
    ).catch(() => {});
    return;
  }

  const { status, trial_ate, proxima_cobranca, acesso_ate } = assinatura;

  // Verificar se está em dia
  const isAtiva = status === "ativa";
  const isTrial = status === "trial";
  const diasTrial = isTrial ? daysUntil(trial_ate) : null;
  const diasProx = isAtiva ? daysUntil(proxima_cobranca || acesso_ate) : null;

  const emDia = (isAtiva && diasProx != null && diasProx > 3) ||
                (isTrial && diasTrial != null && diasTrial > 3);

  if (emDia) {
    await sendText(instanceName, fromNumber, msgEmDia(assinatura)).catch(() => {});
    return;
  }

  // Precisa pagar — mostrar opções e salvar estado
  const fatura = await getFaturaPendente(usuarioId);
  const msg = msgOpcoesPagamento(assinatura, fatura);

  const payload = {
    action: "billing_payment",
    step: "aguardando_opcao",
    plano_slug: assinatura.plano_slug,
    fatura_id: fatura?.id || null,
  };

  await createPending(usuarioId, fromNumber, payload);
  await sendText(instanceName, fromNumber, msg).catch(() => {});

  console.log(`[billingFlow] opções enviadas: usuario=${usuarioId} plano=${assinatura.plano_slug}`);
}

/**
 * Processa resposta do usuário no fluxo de cobrança.
 * Chamado por handlePendingFlow quando action === "billing_payment".
 */
export async function handleBillingPendingFlow(usuarioId, fromNumber, instanceName, pending) {
  const t = norm(pending.body);
  const payload = pending.payload;

  // Cancelar
  if (["3", "cancelar", "cancel", "nao", "n", "não"].includes(t)) {
    await deletePending(usuarioId);
    await sendText(instanceName, fromNumber,
      `${BOT_AVATAR}\n❌ *Cancelado.*\n\n_Sem alterações. Use *mensalidade* quando quiser pagar._`
    ).catch(() => {});
    return;
  }

  // PIX
  if (["1", "pix"].includes(t)) {
    await deletePending(usuarioId);
    await sendText(instanceName, fromNumber, `${BOT_AVATAR}\n⏳ *Gerando PIX...*`).catch(() => {});

    try {
      const methods = await getPublicPaymentMethods();
      if (!methods.pagamento_online) {
        await sendText(instanceName, fromNumber,
          `${BOT_AVATAR}\n⚠️ Cobrança online não disponível no momento.\n\nAcesse o portal para pagar:\n🔗 ${PORTAL_LINK}`
        ).catch(() => {});
        return;
      }

      let checkout;
      if (payload.fatura_id) {
        checkout = await regeneratePendingFaturaCheckout(usuarioId, payload.fatura_id, payload.plano_slug);
      }
      if (!checkout || !checkout.ok) {
        checkout = await createCheckout(usuarioId, payload.plano_slug, { metodo: "pix" });
      }

      if (!checkout.ok) {
        await sendText(instanceName, fromNumber,
          `${BOT_AVATAR}\n⚠️ Não foi possível gerar o PIX: ${checkout.error}\n\nTente pelo portal:\n🔗 ${PORTAL_LINK}`
        ).catch(() => {});
        return;
      }

      const pix = checkout.pix || {};
      const copiaECola = pix.copy_paste || pix.copia_e_cola || pix.qr_code || null;
      const qrBase64 = pix.encoded_image || pix.qr_code_base64 || null;

      if (qrBase64) {
        // Enviar imagem do QR code
        await sendMedia(instanceName, fromNumber, {
          mediatype: "image",
          media: qrBase64,
          mimetype: "image/png",
          caption: "QR Code PIX — Fluxiva",
        }).catch(() => {});
        if (copiaECola) {
          await sendText(instanceName, fromNumber, msgPixGerado(copiaECola)).catch(() => {});
        }
      } else if (copiaECola) {
        await sendText(instanceName, fromNumber, msgPixSemImagem(copiaECola)).catch(() => {});
      } else {
        await sendText(instanceName, fromNumber,
          `${BOT_AVATAR}\n⚠️ PIX gerado mas QR code não disponível.\n\nAcesse o portal:\n🔗 ${PORTAL_LINK}`
        ).catch(() => {});
      }

      console.log(`[billingFlow] PIX enviado: usuario=${usuarioId}`);
    } catch (err) {
      console.error("[billingFlow] erro ao gerar PIX:", err.message);
      await sendText(instanceName, fromNumber,
        `${BOT_AVATAR}\n⚠️ Erro ao gerar PIX. Tente pelo portal:\n🔗 ${PORTAL_LINK}`
      ).catch(() => {});
    }
    return;
  }

  // Cartão
  if (["2", "cartao", "cartão", "credito", "crédito", "debito", "débito", "link"].includes(t)) {
    await deletePending(usuarioId);
    await sendText(instanceName, fromNumber, msgCartao()).catch(() => {});
    console.log(`[billingFlow] link cartão enviado: usuario=${usuarioId}`);
    return;
  }

  // Resposta não reconhecida — reapresenta
  const assinatura = await getAssinatura(usuarioId);
  const fatura = payload.fatura_id ? await getFaturaPendente(usuarioId) : null;
  await sendText(instanceName, fromNumber,
    msgOpcoesPagamento(assinatura || { plano_nome: "Fluxiva", preco_centavos: 0, status: "trial", trial_ate: null }, fatura)
  ).catch(() => {});
}
