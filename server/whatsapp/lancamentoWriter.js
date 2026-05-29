/**
 * lancamentoWriter.js
 *
 * Adiciona um lançamento ao estado JSONB do usuário (tabela `estados`).
 * Usado após confirmação de pré-lançamento via WhatsApp.
 *
 * Lógica espelha GestorContext.saveLancamento do frontend:
 *   - tipo lançamento: "Entrada" (Receita) | "Saida" (Despesa)
 *   - planoId: primeiro plano compatível e ativo da empresa
 *   - conta:   primeira conta ativa (Caixa preferido)
 *   - data:    hoje
 *   - pago:    true (mensagem descreve evento já ocorrido)
 */

import { randomUUID } from "crypto";
import { query } from "../db.js";

// ── Utilitários ───────────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * Próximo código sequencial de lançamento para a empresa.
 */
function nextCodigo(lancamentos) {
  const nums = (lancamentos || [])
    .map((l) => Number(l.codigo))
    .filter((n) => Number.isFinite(n) && n > 0);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

/**
 * Gera identificador de lote: "YYYY-MM-DD-N" onde N é sequencial no dia.
 */
function nextLote(lancamentos) {
  const today = todayIso();
  const todayNums = (lancamentos || [])
    .filter((l) => l.lote && String(l.lote).startsWith(today + "-"))
    .map((l) => {
      const parts = String(l.lote).split("-");
      return parseInt(parts[parts.length - 1], 10) || 0;
    });
  const n = todayNums.length ? Math.max(...todayNums) + 1 : 1;
  return `${today}-${n}`;
}

// ── Função principal ──────────────────────────────────────────────────────────

/**
 * Carrega o estado do usuário, adiciona o lançamento e persiste.
 *
 * @param {string} usuarioId  - UUID do usuário CenterFlow
 * @param {{ tipo: "Receita"|"Despesa", valor: number, descricao: string }} parsed
 * @returns {Promise<object>} lançamento inserido (com id, codigo, etc.)
 * @throws {Error} se o estado não for encontrado ou não tiver empresa
 */
export async function addLancamentoFromWhatsApp(usuarioId, parsed) {
  // ── 1. Carregar estado atual ─────────────────────────────────────────────
  const { rows } = await query(
    "SELECT dados FROM estados WHERE usuario_id = $1",
    [usuarioId]
  );
  if (!rows.length) {
    throw new Error(`Estado não encontrado para usuario_id=${usuarioId}`);
  }

  const dados = rows[0].dados;
  const empresas = Array.isArray(dados?.empresas) ? dados.empresas : [];
  if (!empresas.length) {
    throw new Error("Nenhuma empresa no estado do usuário.");
  }

  // ── 2. Encontrar empresa ativa ───────────────────────────────────────────
  const activeId = dados.empresaAtivaId;
  let idx = activeId ? empresas.findIndex((e) => e.id === activeId) : -1;
  if (idx < 0) idx = 0; // fallback: primeira empresa

  const empresa = empresas[idx];
  const planoContas  = Array.isArray(empresa.planoContas)  ? empresa.planoContas  : [];
  const lancamentos  = Array.isArray(empresa.lancamentos)  ? empresa.lancamentos  : [];
  const contas       = Array.isArray(empresa.contas)       ? empresa.contas       : [];

  // ── 3. Determinar tipo, natureza e plano ─────────────────────────────────
  const isReceita  = parsed.tipo === "Receita";
  const tipoLanc   = isReceita ? "Entrada" : "Saida";
  const natureza   = isReceita ? "Credito" : "Debito";

  // Plano compatível: preferir Receita/Despesa; fallback no primeiro disponível
  const plano =
    planoContas.find((p) => {
      if (p.inativo) return false;
      return isReceita
        ? p.tipo === "Receita"
        : p.tipo === "Despesa" || p.tipo === "Custo";
    }) || planoContas[0] || null;

  // ── 4. Conta destino/origem ──────────────────────────────────────────────
  // Caixa preferido; se não existir, qualquer conta ativa
  const conta =
    contas.find((c) => !c.inativo && c.tipo === "Caixa") ||
    contas.find((c) => !c.inativo) ||
    contas[0] ||
    null;

  // ── 5. Montar objeto lançamento ──────────────────────────────────────────
  const lancamento = {
    id:             randomUUID(),
    codigo:         nextCodigo(lancamentos),
    data:           todayIso(),
    tipo:           tipoLanc,
    valor:          parseFloat(parsed.valor),
    descricao:      String(parsed.descricao || "").trim(),
    planoId:        plano?.id  || "",
    contaEntradaId: isReceita  ? (conta?.id   || null) : null,
    contaSaidaId:   !isReceita ? (conta?.id   || null) : null,
    codigoDestino:  isReceita  ? (conta?.codigo ?? null) : null,
    codigoOrigem:   !isReceita ? (conta?.codigo ?? null) : null,
    pago:           true,
    lote:           nextLote(lancamentos),
    tipoOrigem:     "",
    tipoDestino:    "",
    natureza,
    consiliado:     false,
    clienteId:      null,
    fornecedorId:   null,
  };

  // ── 6. Persistir estado atualizado ───────────────────────────────────────
  const novasEmpresas = empresas.map((e, i) =>
    i === idx ? { ...e, lancamentos: [...lancamentos, lancamento] } : e
  );

  const novosDados = { ...dados, empresas: novasEmpresas };

  await query(
    "UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2",
    [JSON.stringify(novosDados), usuarioId]
  );

  return lancamento;
}
