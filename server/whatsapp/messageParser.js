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

// ── Mapeamento de categorias ─────────────────────────────────────────────────
//
// Lista de { nome, keywords } usada para sugerir o plano de contas correto
// a partir da descrição parseada. A busca é feita por substring normalizada.
// Ordem importa: primeira correspondência vence.

const CATEGORY_MAP = [
  {
    nome: "Transporte",
    keywords: [
      "gasolina", "combustivel", "posto", "etanol", "diesel",
      "uber", "taxi", "99", "onibus", "metro", "trem", "brt",
      "passagem", "pedagio", "estacionamento", "mototaxi",
    ],
  },
  {
    nome: "Alimentação",
    keywords: [
      "mercado", "supermercado", "feira", "hortifruti", "acougue",
      "ifood", "rappi", "delivery", "restaurante", "lanchonete",
      "lanche", "pizza", "hamburguer", "burguer", "sushi",
      "cafe", "cafeteria", "padaria", "almoco", "jantar", "refeicao",
      "bebida", "cerveja", "bar",
    ],
  },
  {
    nome: "Moradia",
    keywords: [
      "aluguel", "condominio", "iptu", "agua", "energia", "luz",
      "gas", "casa", "apartamento", "reforma", "manutencao",
    ],
  },
  {
    nome: "Internet",
    keywords: [
      "internet", "fibra", "wifi", "vivo", "claro", "tim", "oi",
      "net", "telefone", "celular", "plano", "recarga", "chip",
    ],
  },
  {
    nome: "Saúde",
    keywords: [
      "farmacia", "remedio", "medicamento", "medico", "consulta",
      "exame", "clinica", "hospital", "plano de saude", "dentista",
      "academia", "psicologia", "psicologo",
    ],
  },
  {
    nome: "Educação",
    keywords: [
      "escola", "faculdade", "curso", "livro", "material",
      "mensalidade", "aula", "colegio", "uniforme",
    ],
  },
  {
    nome: "Lazer",
    keywords: [
      "cinema", "teatro", "show", "viagem", "hotel", "pousada",
      "netflix", "spotify", "streaming", "jogo", "parque",
    ],
  },
  {
    nome: "Vestuário",
    keywords: [
      "roupa", "sapato", "tenis", "calcado", "vestuario",
      "camisa", "calca", "vestido", "bolsa", "acessorio",
    ],
  },
  // Receita
  {
    nome: "Salário",
    keywords: ["salario", "salário", "pagamento mensal", "pro-labore", "prolabore"],
  },
  {
    nome: "Freelance",
    keywords: ["freelance", "freela", "servico prestado", "honorario", "projeto"],
  },
];

/**
 * Sugere nome de categoria com base na descrição e tipo.
 * Retorna o primeiro nome de categoria que tiver algum keyword presente na descrição.
 *
 * @param {string} descricao  - texto normalizado ou original
 * @param {"Receita"|"Despesa"} tipo
 * @returns {string|null}  nome da categoria sugerida ou null
 */
export function suggestCategory(descricao, tipo) {
  if (!descricao) return null;
  const n = norm(descricao);
  for (const cat of CATEGORY_MAP) {
    for (const kw of cat.keywords) {
      if (n.includes(norm(kw))) return cat.nome;
    }
  }
  return null;
}

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

// ── Limpeza de transcrições estruturadas ──────────────────────────────────────

/**
 * Remove rótulos técnicos que a IA de transcrição pode inserir.
 * Ex: "VALOR: 250 | DESCRIÇÃO: aluguel" → "250 aluguel"
 *     "TIPO: Saída VALOR: 250 DESCRIÇÃO: aluguel" → "Saída 250 aluguel"
 */
function cleanTranscription(text) {
  if (!text || typeof text !== "string") return text;
  let t = text;
  // Remove rótulos com dois-pontos e conteúdo até separador | ou fim
  t = t.replace(/\bVALOR\s*:\s*/gi, "");
  t = t.replace(/\bDESCRI[ÇC][ÃA]O\s*:\s*/gi, "");
  t = t.replace(/\bTIPO\s*:\s*/gi, "");
  t = t.replace(/\bCATEGORIA\s*:\s*/gi, "");
  // Remove separadores remanescentes
  t = t.replace(/\s*\|\s*/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t || text;
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

  const cleaned = cleanTranscription(text);

  const valor = extractValor(cleaned);
  if (!valor) return null; // Sem número → não é lançamento

  const normalized = norm(cleaned);
  const tipo = detectTipo(normalized);
  const descricao = extractDescricao(cleaned, tipo) || (tipo === "Receita" ? "Receita" : "Despesa");

  const categoria = suggestCategory(descricao + " " + normalized, tipo);
  return { tipo, valor, descricao, categoria };
}
