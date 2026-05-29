/**
 * messageParser.js — Parser de mensagens financeiras SEM IA.
 *
 * Extrai: tipo (Receita | Despesa), valor (number) e descricao (string).
 * Detecta comandos de confirmacao: SIM / NAO.
 *
 * Regras:
 *   - Sem número no texto → não é um lançamento (retorna null)
 *   - Palavras-chave de receita detectadas → Receita
 *   - Sem palavra-chave de receita → Despesa (default)
 *   - Descrição = texto limpo após remover valor e palavras-chave
 */

// ── Palavras-chave de RECEITA ─────────────────────────────────────────────────
// Devem aparecer no início ou em qualquer posição para tipar como receita.
const RECEITA_KEYWORDS = [
  "recebi",
  "recebeu",
  "recebemos",
  "recebo",
  "entrou",
  "entrada",
  "ganhei",
  "ganhou",
  "ganhamos",
  "vendi",
  "vendeu",
  "vendemos",
  "venda",
  "salario",
  "salário",
  "freelance",
  "rendimento",
  "renda",
  "honorario",
  "honorários",
  "comissao",
  "comissão",
  "transferencia recebida",
  "transferência recebida",
  "deposito recebido",
  "depósito recebido",
];

// ── Palavras-chave de DESPESA (prefixos que aparecem no início) ───────────────
const DESPESA_PREFIXES = [
  "paguei",
  "pagar",
  "pago",
  "pagamento",
  "gastei",
  "gastou",
  "gasto",
  "comprei",
  "comprou",
  "compra",
  "compras",
  "debito",
  "débito",
  "saiu",
  "saida",
  "saída",
  "boleto",
  "conta",
  "despesa",
];

// ── Normalização ──────────────────────────────────────────────────────────────

/**
 * Lowercase + remove acentos + trim.
 * Não altera espaços nem pontuação para não quebrar o parser de valor.
 */
function norm(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// ── Extração de valor ─────────────────────────────────────────────────────────

/**
 * Extrai o primeiro valor monetário positivo do texto.
 * Aceita: 50  |  50.00  |  50,00  |  R$ 50  |  R$50,00
 * Retorna null se nenhum número válido for encontrado.
 */
function extractValor(text) {
  // Remove "R$" e variantes antes de parsear
  const cleaned = text.replace(/R\$\s*/gi, "");
  // Número com separador decimal opcional (ponto ou vírgula) — até 2 casas
  const match = cleaned.match(/\b(\d{1,7}(?:[.,]\d{1,2})?)\b/);
  if (!match) return null;
  const num = parseFloat(match[1].replace(",", "."));
  return Number.isFinite(num) && num > 0 ? num : null;
}

// ── Detecção de tipo ──────────────────────────────────────────────────────────

/**
 * Retorna "Receita" se o texto normalizado contiver palavra-chave de receita;
 * caso contrário retorna "Despesa".
 */
function detectTipo(normalizedText) {
  for (const kw of RECEITA_KEYWORDS) {
    const n = norm(kw);
    // Aceita no início, no meio (cercado por espaço) ou como token completo
    if (
      normalizedText === n ||
      normalizedText.startsWith(n + " ") ||
      normalizedText.includes(" " + n + " ") ||
      normalizedText.endsWith(" " + n)
    ) {
      return "Receita";
    }
  }
  return "Despesa";
}

// ── Extração de descrição ─────────────────────────────────────────────────────

/**
 * Remove o valor monetário e palavras-chave de tipo do texto,
 * retornando o que sobrar como descrição.
 */
function extractDescricao(text, tipo) {
  let desc = text;

  // Remove "R$ XX" e "R$XX"
  desc = desc.replace(/R\$\s*\d+(?:[.,]\d{1,2})?/gi, "");

  // Remove número solto (o valor principal)
  desc = desc.replace(/\b\d+(?:[.,]\d{1,2})?\b/, "");

  // Remove palavras-chave do tipo no início do texto
  const keywords = tipo === "Receita" ? RECEITA_KEYWORDS : DESPESA_PREFIXES;
  for (const kw of keywords) {
    // Remove apenas do início (case-insensitive, acento-insensitive)
    const pattern = new RegExp(
      "^" + norm(kw).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*",
      "i"
    );
    desc = desc.replace(pattern, "");
  }

  // Limpa espaços múltiplos e pontuação solta no início/fim
  desc = desc.replace(/\s+/g, " ").replace(/^[,.:;!?\s]+|[,.:;!?\s]+$/g, "").trim();

  return desc || "";
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Detecta se a mensagem é uma confirmação do usuário.
 *
 * @param {string} text
 * @returns {"sim" | "nao" | null}
 */
export function detectConfirmation(text) {
  const t = norm(String(text || "").trim());
  if (["sim", "s", "yes", "confirmar", "confirmo", "ok", "pode"].includes(t)) return "sim";
  if (["nao", "n", "no", "nope", "cancelar", "cancelo", "cancel"].includes(t)) return "nao";
  return null;
}

/**
 * Faz o parse de uma mensagem financeira.
 *
 * @param {string} text
 * @returns {{ tipo: "Receita"|"Despesa", valor: number, descricao: string } | null}
 *   Retorna null quando a mensagem não contém valor numérico reconhecível.
 */
export function parseMessage(text) {
  if (!text || typeof text !== "string") return null;

  const valor = extractValor(text);
  if (!valor) return null; // Sem número → não é lançamento

  const normalized = norm(text);
  const tipo = detectTipo(normalized);
  const descricao = extractDescricao(text, tipo) || (tipo === "Receita" ? "Receita" : "Despesa");

  return { tipo, valor, descricao };
}
