/**
 * financePending.js — Fluxo de pendências financeiras via WhatsApp.
 *
 * Responsável por:
 *   - CRUD da tabela whatsapp_pending
 *   - Acesso ao estado (tabela estados, campo dados JSONB)
 *   - Confirmação: salva lancamento em estados.dados.empresas[i].lancamentos[]
 *   - Mensagens de confirmação e listagem de categorias
 */

import { randomUUID } from "crypto";
import { query } from "../db.js";

// ── Helpers de formatação ────────────────────────────────────────────────────

export function fmtMoney(val) {
  const n = Number(val || 0);
  const neg = n < 0;
  const abs = Math.abs(n);
  const [int, dec] = abs.toFixed(2).split(".");
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}R$ ${intFmt},${dec}`;
}

export function fmtDate(iso) {
  if (!iso) return "";
  const parts = String(iso).split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ── Acesso ao estado ─────────────────────────────────────────────────────────

export async function getEmpresaDados(usuarioId, ambienteIdOverride = null) {
  const { rows } = await query(
    "SELECT dados FROM estados WHERE usuario_id = $1",
    [usuarioId]
  );
  if (!rows.length) return null;

  const dados = rows[0].dados;
  const empresas = Array.isArray(dados?.empresas) ? dados.empresas : [];
  if (!empresas.length && !dados?.porAmbiente) return null;

  // Se ambienteIdOverride fornecido (ex: consulta WA após seleção de ambiente),
  // usa esse ID diretamente em vez do que está ativo no browser.
  const activeId = ambienteIdOverride || dados.ambienteAtualId || dados.empresaAtivaId;
  let empresa;
  let empresaIdx = 0;
  if (dados.porAmbiente && activeId && dados.porAmbiente[activeId]) {
    empresa = dados.porAmbiente[activeId];
    empresaIdx = empresas.findIndex((e) => e.id === activeId);
    if (empresaIdx < 0) empresaIdx = 0;
  } else {
    let idx = activeId ? empresas.findIndex((e) => e.id === activeId) : -1;
    if (idx < 0) idx = 0;
    empresa = empresas[idx];
    empresaIdx = idx;
  }
  if (!empresa) return null;

  return { dados, empresa, empresaIdx, empresas };
}

export async function getAmbientesDoUsuario(usuarioId) {
  const { rows } = await query(
    `SELECT id, nome, tipo, icone, ordem
     FROM ambientes_financeiros
     WHERE usuario_id = $1 AND ativo = true
     ORDER BY ordem ASC, created_at ASC`,
    [usuarioId]
  );
  return rows;
}

// ── Categorias ───────────────────────────────────────────────────────────────

/**
 * Retorna categorias ativas do tenant.
 * PJ: empresa.planoContas[] — PF fallback: dados.categoriasPF[]
 *
 * @param {string} usuarioId
 * @param {"Entrada"|"Saida"|null} tipo - filtra por compatibilidade
 */
export async function getCategories(usuarioId, tipo) {
  const state = await getEmpresaDados(usuarioId);
  if (!state) return [];

  const { dados, empresa } = state;
  const planoContas = Array.isArray(empresa?.planoContas) ? empresa.planoContas : [];

  if (planoContas.length) {
    return planoContas
      .filter((p) => !p.inativo)
      .filter((p) => {
        if (!tipo) return true;
        return tipo === "Entrada"
          ? p.tipo === "Receita"
          : p.tipo === "Despesa" || p.tipo === "Custo";
      })
      .map((p) => ({ id: p.id, descricao: p.descricao, tipo: p.tipo }));
  }

  // Fallback PF
  const categoriasPF =
    Array.isArray(dados?.categoriasPF) ? dados.categoriasPF :
    Array.isArray(empresa?.categoriasPF) ? empresa.categoriasPF : [];
  return categoriasPF
    .filter((c) => !c.inativo)
    .map((c) => ({ id: c.id, descricao: c.descricao, tipo: c.tipo }));
}

// ── Pending CRUD ─────────────────────────────────────────────────────────────

export async function getAnyPending(usuarioId) {
  const { rows } = await query(
    `SELECT id, payload, from_number, expires_at
       FROM whatsapp_pending
      WHERE usuario_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [usuarioId]
  );
  return rows[0] || null;
}

export async function createPending(usuarioId, fromNumber, payload) {
  await query("DELETE FROM whatsapp_pending WHERE usuario_id = $1", [usuarioId]);
  const { rows } = await query(
    `INSERT INTO whatsapp_pending (usuario_id, from_number, payload, tipo_criacao)
     VALUES ($1, $2, $3, 'avulso')
     RETURNING id`,
    [usuarioId, fromNumber, JSON.stringify(payload)]
  );
  return rows[0].id;
}

export async function updatePending(pendingId, payload) {
  await query(
    "UPDATE whatsapp_pending SET payload = $1 WHERE id = $2",
    [JSON.stringify(payload), pendingId]
  );
}

export async function deletePending(usuarioId) {
  await query("DELETE FROM whatsapp_pending WHERE usuario_id = $1", [usuarioId]);
}

// ── Confirmação — salva em estados.dados ─────────────────────────────────────

function nextCodigo(lancamentos) {
  const nums = (lancamentos || [])
    .map((l) => Number(l.codigo))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

function nextLote(lancamentos) {
  const today = todayIso();
  const nums = (lancamentos || [])
    .filter((l) => l.lote && String(l.lote).startsWith(today + "-"))
    .map((l) => parseInt(String(l.lote).split("-").pop(), 10) || 0);
  const n = nums.length ? Math.max(...nums) + 1 : 1;
  return `${today}-${n}`;
}

/**
 * Confirma o pending ativo: salva lancamento no JSONB do estado e apaga o pending.
 *
 * @param {string} usuarioId
 * @param {object} pending - linha da whatsapp_pending { id, payload }
 * @returns {object} lancamento inserido
 */
export async function confirmPendingLancamento(usuarioId, pending) {
  const state = await getEmpresaDados(usuarioId);
  if (!state) throw new Error("Estado não encontrado");

  let { dados, empresa, empresaIdx, empresas } = state;

  // Se o usuário escolheu um ambiente específico no fluxo multiambiente,
  // usar aquele em vez do ambienteAtualId do servidor (que pode ser diferente).
  const ambienteIdEscolhido = pending.payload?.ambienteId;
  if (ambienteIdEscolhido) {
    const idx = empresas.findIndex((e) => e.id === ambienteIdEscolhido);
    if (idx >= 0) {
      empresaIdx = idx;
      empresa = empresas[idx];
    }
  }
  const lancamentos = Array.isArray(empresa.lancamentos) ? empresa.lancamentos : [];
  const contas = Array.isArray(empresa.contas) ? empresa.contas : [];

  const lancData = pending.payload.lancamento;
  const isEntrada = lancData.tipo === "Entrada";

  // Resolver conta padrão se não definida no payload
  let contaEntradaId = lancData.contaEntradaId || null;
  let contaSaidaId = lancData.contaSaidaId || null;

  if (!contaEntradaId && !contaSaidaId) {
    const conta =
      contas.find((c) => !c.inativo && c.padrao === true) ||
      contas.find((c) => !c.inativo && c.tipo === "Caixa") ||
      contas.find((c) => !c.inativo) ||
      contas[0] || null;
    if (isEntrada) contaEntradaId = conta?.id || null;
    else contaSaidaId = conta?.id || null;
  }

  const lancamento = {
    id: randomUUID(),
    codigo: nextCodigo(lancamentos),
    lote: nextLote(lancamentos),
    data: lancData.data || todayIso(),
    tipo: lancData.tipo,
    valor: Number(lancData.valor),
    historico: String(lancData.historico || "").trim(),
    descricao: String(lancData.historico || "").trim(),
    planoId: lancData.planoId || "",
    contaEntradaId,
    contaSaidaId,
    natureza: isEntrada ? "Credito" : "Debito",
    pago: true,
    status: "pago",
    exportado: false,
    consiliado: false,
    tipoOrigem: "",
    tipoDestino: "",
    clienteId: null,
    fornecedorId: null,
    observacao: "Criado via WhatsApp",
    createdAt: new Date().toISOString(),
    source: "whatsapp",
  };

  const updatedEmpresa = { ...empresa, lancamentos: [...lancamentos, lancamento] };
  const novasEmpresas = empresas.map((e, i) =>
    i === empresaIdx ? updatedEmpresa : e
  );

  // Fase 2: sincroniza porAmbiente para manter isolamento de dados.
  // Usa o ambiente escolhido pelo usuário no fluxo (ambienteIdEscolhido) como chave,
  // ou cai para o ambienteAtualId do servidor como fallback.
  const chaveAmbiente = ambienteIdEscolhido || dados.ambienteAtualId;
  const updatedPorAmbiente =
    dados.porAmbiente && chaveAmbiente
      ? { ...dados.porAmbiente, [chaveAmbiente]: updatedEmpresa }
      : dados.porAmbiente;

  await query(
    "UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2",
    [JSON.stringify({ ...dados, empresas: novasEmpresas, porAmbiente: updatedPorAmbiente }), usuarioId]
  );

  await deletePending(usuarioId);
  return lancamento;
}

// ── Identidade do bot ────────────────────────────────────────────────────────

export const DIV = "──────────────────────";
export const BOT_AVATAR = `💼 *Fluxiva*\n${DIV}`;

// ── Mensagens fixas ──────────────────────────────────────────────────────────

export const MSG_CONFIRMADO =
  `✅ *Lançamento salvo!*\n\n` +
  `_Registrado com sucesso no seu financeiro._`;

export const MSG_CANCELADO =
  `❌ *Lançamento cancelado.*\n\n` +
  `_Nenhuma alteração foi feita._`;

export const MSG_EXPIRADO =
  `⏰ *Esse lançamento expirou.*\n\n` +
  `Envie a informação novamente para registrar.`;

export const MSG_ERRO_SALVAR =
  `⚠️ *Erro ao salvar lançamento.*\n\nTente novamente em instantes.`;

export const MSG_ERRO_PROCESSAR =
  `⚠️ *Erro ao processar a mensagem.*\n\nTente novamente em instantes.`;

// ── Construtores de mensagem ─────────────────────────────────────────────────

export function buildConfirmacaoMsg(payload) {
  const l = payload.lancamento;
  const isEntrada = l.tipo === "Entrada";
  const tipoIcon = isEntrada ? "📈" : "📉";
  const tipoLabel = isEntrada ? "Entrada" : "Saída";
  const catNome = payload.categoria_sugerida?.descricao || l.categoriaNome || "Sem categoria";

  return (
    `${BOT_AVATAR}\n` +
    `${tipoIcon} *Novo lançamento detectado*\n\n` +
    `  📌 Tipo        ${tipoLabel}\n` +
    `  💰 Valor       ${fmtMoney(l.valor)}\n` +
    `  📝 Descrição   ${l.historico || "—"}\n` +
    `  🏷️  Categoria   ${catNome}\n` +
    `${DIV}\n` +
    `Como deseja prosseguir?\n\n` +
    `1️⃣  Confirmar\n` +
    `2️⃣  Trocar categoria\n` +
    `3️⃣  Cancelar`
  );
}

export function buildCategoryListMsg(categorias) {
  const lista = categorias
    .slice(0, 20)
    .map((c, i) => `  ${i + 1}. ${c.descricao}`)
    .join("\n");
  return (
    `📂 *Categorias disponíveis*\n` +
    `${DIV}\n` +
    `${lista}\n` +
    `${DIV}\n` +
    `Responda com o *número* da categoria desejada.`
  );
}

const AMB_ICONE = { pessoal: "🏠", empresa: "🏢" };

export function buildAmbienteSelectorMsg(ambientes) {
  const lista = ambientes
    .map((a, i) => `  ${i + 1}. ${AMB_ICONE[a.tipo] || "🏢"} ${a.nome}`)
    .join("\n");
  return (
    `${BOT_AVATAR}\n` +
    `🏦 *Em qual financeiro deseja registrar?*\n\n` +
    `${lista}\n` +
    `${DIV}\n` +
    `_Responda com o número correspondente._`
  );
}

export function buildAmbienteConfirmadoMsg(ambienteNome, ambienteTipo) {
  const icone = AMB_ICONE[ambienteTipo] || "🏢";
  return (
    `✅ *Lançamento salvo!*\n\n` +
    `Lançado em: ${icone} *${ambienteNome}*`
  );
}
