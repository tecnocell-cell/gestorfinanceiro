/**
 * financeCommands.js — Consultas financeiras via WhatsApp.
 *
 * Comandos suportados:
 *   opções | opcoes | ajuda | comandos | menu | o que posso fazer
 *   saldo | saldo <conta>
 *   extrato hoje | extrato mês | extrato <mês em português>
 *   lançamentos hoje | lançamentos mês | lançamentos <mês em português>
 *   gastos <categoria> mês | gastos <categoria> hoje
 */

import { getEmpresaDados, fmtMoney, fmtDate, todayIso } from "./financePending.js";

const MESES = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// ── Detecção de comando ──────────────────────────────────────────────────────

/**
 * Detecta se o texto é um comando de consulta.
 * Retorna { cmd, ... } ou null.
 */
const AJUDA_TRIGGERS = new Set([
  "opcoes", "opções", "ajuda", "comandos", "menu", "o que posso fazer",
]);

export const MENU_TEXTO =
  `Menu do WhatsApp Financeiro:\n\n` +
  `Consultas:\n` +
  `1. saldo\n` +
  `2. saldo banco\n` +
  `3. extrato hoje\n` +
  `4. extrato mês\n` +
  `5. extrato anual\n` +
  `6. lançamentos hoje\n` +
  `7. lançamentos junho\n` +
  `8. gastos alimentação mês\n` +
  `9. gastos por categoria mês\n` +
  `10. gastos por categoria anual\n\n` +
  `Lançamentos:\n` +
  `11. paguei 80 mercado\n` +
  `12. recebi 1500 pix cliente\n` +
  `13. gasolina 200\n` +
  `14. aluguel 1200\n\n` +
  `Durante uma confirmação:\n` +
  `1 - Confirmar\n` +
  `2 - Trocar categoria\n` +
  `3 - Cancelar\n\n` +
  `Observação:\n` +
  `Para trocar categoria, responda "2" ou "trocar categoria".\n` +
  `Depois escolha o número da categoria listada.`;

export function detectQueryCommand(text) {
  const t = norm(text);

  if (AJUDA_TRIGGERS.has(t)) return { cmd: "ajuda" };

  if (t === "saldo") return { cmd: "saldo", conta: null };

  const saldoMatch = t.match(/^saldo\s+(.+)$/);
  if (saldoMatch) return { cmd: "saldo", conta: saldoMatch[1].trim() };

  if (t === "extrato hoje" || t === "lancamentos hoje")
    return { cmd: "extrato", period: "hoje" };

  if (t === "extrato mes" || t === "extrato mês" || t === "lancamentos mes" || t === "lancamentos mês")
    return { cmd: "extrato", period: "mes" };

  if (t === "extrato anual" || t === "extrato ano" || t === "lancamentos anual" || t === "lancamentos ano")
    return { cmd: "extrato", period: "anual" };

  for (const [nome, num] of Object.entries(MESES)) {
    if (t === `lancamentos ${nome}` || t === `extrato ${nome}`)
      return { cmd: "extrato", period: "mesNome", month: num, monthNome: nome };
  }

  // "gastos por categoria mês" | "gastos por categoria anual"
  if (t === "gastos por categoria mes" || t === "gastos por categoria mês")
    return { cmd: "gastos_categoria", period: "mes" };
  if (t === "gastos por categoria anual" || t === "gastos por categoria ano")
    return { cmd: "gastos_categoria", period: "anual" };

  // "gastos alimentação mês" | "gasto alimentação mes"
  const gastosMatch = t.match(/^gastos?\s+(.+?)\s+(mes|mês|hoje|anual|ano)$/);
  if (gastosMatch)
    return { cmd: "gastos", categoria: gastosMatch[1].trim(), period: norm(gastosMatch[2]) };

  return null;
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export async function handleQueryCommand(usuarioId, cmd) {
  if (cmd.cmd === "ajuda") return MENU_TEXTO;
  try {
    if (cmd.cmd === "saldo") return await cmdSaldo(usuarioId, cmd.conta);
    if (cmd.cmd === "extrato") return await cmdExtrato(usuarioId, cmd.period, cmd.month, cmd.monthNome);
    if (cmd.cmd === "gastos") return await cmdGastos(usuarioId, cmd.categoria, cmd.period);
    if (cmd.cmd === "gastos_categoria") return await cmdGastosPorCategoria(usuarioId, cmd.period);
  } catch (err) {
    console.error(`[whatsapp/query] erro cmd=${cmd.cmd}:`, err.message);
    return "Erro ao processar consulta. Tente novamente.";
  }
  return "Comando não reconhecido.";
}

// ── Saldo ────────────────────────────────────────────────────────────────────

function calcSaldoConta(conta, lancamentos) {
  let saldo = Number(conta.saldoInicial || 0);
  for (const l of lancamentos) {
    const v = Number(l.valor || 0);
    if (l.tipo === "Entrada" && l.contaEntradaId === conta.id) saldo += v;
    else if (l.tipo === "Saida" && l.contaSaidaId === conta.id) saldo -= v;
    else if (l.tipo === "Transferencia") {
      if (l.contaEntradaId === conta.id) saldo += v;
      if (l.contaSaidaId === conta.id) saldo -= v;
    }
  }
  return saldo;
}

async function cmdSaldo(usuarioId, contaNome) {
  const state = await getEmpresaDados(usuarioId);
  if (!state) return "Nenhum estado financeiro encontrado.";

  const { empresa } = state;
  const contas = (Array.isArray(empresa?.contas) ? empresa.contas : []).filter((c) => !c.inativo);
  const lancamentos = Array.isArray(empresa?.lancamentos) ? empresa.lancamentos : [];

  if (!contaNome) {
    const total = contas.reduce((acc, c) => acc + calcSaldoConta(c, lancamentos), 0);
    return `Saldo total atual: ${fmtMoney(total)}`;
  }

  const n = norm(contaNome);
  const conta = contas.find((c) =>
    norm(c.nome || c.descricao || c.apelido || "").includes(n)
  );

  if (!conta) {
    const lista = contas.map((c, i) => `${i + 1} - ${c.nome || c.descricao}`).join("\n");
    return `Não encontrei essa conta. Contas disponíveis:\n\n${lista}`;
  }

  const saldo = calcSaldoConta(conta, lancamentos);
  return `Saldo de ${conta.nome || conta.descricao}: ${fmtMoney(saldo)}`;
}

// ── Extrato ──────────────────────────────────────────────────────────────────

async function cmdExtrato(usuarioId, period, monthNum, monthNome) {
  const state = await getEmpresaDados(usuarioId);
  if (!state) return "Nenhum estado financeiro encontrado.";

  const { empresa } = state;
  const todayStr = todayIso();
  const now = new Date();
  let lancamentos = Array.isArray(empresa?.lancamentos) ? empresa.lancamentos : [];
  let titulo = "";

  if (period === "hoje") {
    lancamentos = lancamentos.filter((l) => l.data === todayStr);
    titulo = "Extrato de hoje";
  } else if (period === "mes") {
    const ano = now.getFullYear();
    const mes = String(now.getMonth() + 1).padStart(2, "0");
    lancamentos = lancamentos.filter((l) => l.data?.startsWith(`${ano}-${mes}`));
    titulo = `Extrato de ${now.toLocaleString("pt-BR", { month: "long" })}`;
  } else if (period === "anual") {
    const ano = String(now.getFullYear());
    lancamentos = lancamentos.filter((l) => l.data?.startsWith(ano));
    titulo = `Extrato de ${ano}`;
  } else if (period === "mesNome" && monthNum) {
    const ano = now.getFullYear();
    const mes = String(monthNum).padStart(2, "0");
    lancamentos = lancamentos.filter((l) => l.data?.startsWith(`${ano}-${mes}`));
    titulo = `Extrato de ${monthNome || mes}`;
  }

  if (!lancamentos.length) return `${titulo}:\n\nNenhum lançamento encontrado.`;

  const MAX = 20;
  const truncado = lancamentos.length > MAX;
  const lista = lancamentos.slice(-MAX);

  let totalEntradas = 0;
  let totalSaidas = 0;

  const linhas = lista.map((l, i) => {
    const v = Number(l.valor || 0);
    if (l.tipo === "Entrada") totalEntradas += v;
    if (l.tipo === "Saida") totalSaidas += v;
    const icon = l.tipo === "Entrada" ? "Entrada" : "Saída";
    return `${i + 1}. ${icon} ${fmtMoney(v)} - ${l.historico || l.descricao || ""} - ${fmtDate(l.data)}`;
  });

  let resp = `${titulo}:\n\n`;
  if (truncado) resp += `(Mostrando os últimos ${MAX} lançamentos)\n\n`;
  resp += linhas.join("\n");
  resp += `\n\nTotal entradas: ${fmtMoney(totalEntradas)}`;
  resp += `\nTotal saídas: ${fmtMoney(totalSaidas)}`;
  resp += `\nSaldo do período: ${fmtMoney(totalEntradas - totalSaidas)}`;
  return resp;
}

// ── Gastos por categoria ─────────────────────────────────────────────────────

async function cmdGastos(usuarioId, categoriaBusca, period) {
  const state = await getEmpresaDados(usuarioId);
  if (!state) return "Nenhum estado financeiro encontrado.";

  const { empresa } = state;
  const planoContas = Array.isArray(empresa?.planoContas) ? empresa.planoContas : [];
  const now = new Date();
  const todayStr = todayIso();

  let lancamentos = (Array.isArray(empresa?.lancamentos) ? empresa.lancamentos : [])
    .filter((l) => l.tipo === "Saida");

  if (period === "hoje") {
    lancamentos = lancamentos.filter((l) => l.data === todayStr);
  } else if (period === "anual" || period === "ano") {
    lancamentos = lancamentos.filter((l) => l.data?.startsWith(String(now.getFullYear())));
  } else {
    const ano = now.getFullYear();
    const mes = String(now.getMonth() + 1).padStart(2, "0");
    lancamentos = lancamentos.filter((l) => l.data?.startsWith(`${ano}-${mes}`));
  }

  const n = norm(categoriaBusca);
  const plano = planoContas.find((p) => !p.inativo && norm(p.descricao || "").includes(n));

  if (!plano) {
    return `Não encontrei a categoria "${categoriaBusca}". Verifique o nome e tente novamente.`;
  }

  const filtrados = lancamentos.filter((l) => l.planoId === plano.id);
  const periodoLabel = period === "hoje" ? "hoje" : (period === "anual" || period === "ano") ? "este ano" : "neste mês";

  if (!filtrados.length) {
    return `Nenhum gasto em "${plano.descricao}" ${periodoLabel}.`;
  }

  const total = filtrados.reduce((acc, l) => acc + Number(l.valor || 0), 0);
  const principais = filtrados
    .sort((a, b) => Number(b.valor) - Number(a.valor))
    .slice(0, 5)
    .map((l, i) => `${i + 1}. ${fmtMoney(Number(l.valor))} - ${l.historico || l.descricao || ""}`);

  return (
    `Gastos em ${plano.descricao} ${periodoLabel}: ${fmtMoney(total)}\n\n` +
    `Principais lançamentos:\n${principais.join("\n")}`
  );
}

// ── Gastos por categoria (todas) ─────────────────────────────────────────────

async function cmdGastosPorCategoria(usuarioId, period) {
  const state = await getEmpresaDados(usuarioId);
  if (!state) return "Nenhum estado financeiro encontrado.";

  const { empresa } = state;
  const planoContas = (Array.isArray(empresa?.planoContas) ? empresa.planoContas : [])
    .filter((p) => !p.inativo);
  const now = new Date();

  let lancamentos = (Array.isArray(empresa?.lancamentos) ? empresa.lancamentos : [])
    .filter((l) => l.tipo === "Saida");

  let titulo;
  if (period === "anual") {
    lancamentos = lancamentos.filter((l) => l.data?.startsWith(String(now.getFullYear())));
    titulo = `Gastos por categoria em ${now.getFullYear()}`;
  } else {
    const ano = now.getFullYear();
    const mes = String(now.getMonth() + 1).padStart(2, "0");
    lancamentos = lancamentos.filter((l) => l.data?.startsWith(`${ano}-${mes}`));
    titulo = `Gastos por categoria em ${now.toLocaleString("pt-BR", { month: "long" })}`;
  }

  if (!lancamentos.length) return `${titulo}:\n\nNenhum gasto encontrado no período.`;

  // Agrupar por planoId
  const porCategoria = new Map();
  for (const l of lancamentos) {
    const id = l.planoId || "__sem_categoria__";
    porCategoria.set(id, (porCategoria.get(id) || 0) + Number(l.valor || 0));
  }

  // Montar linhas ordenadas por valor desc
  const linhas = [...porCategoria.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([id, total], i) => {
      const plano = planoContas.find((p) => p.id === id);
      const nome = plano ? plano.descricao : "Sem categoria";
      return `${i + 1}. ${nome}: ${fmtMoney(total)}`;
    });

  const totalGeral = [...porCategoria.values()].reduce((a, b) => a + b, 0);

  return `${titulo}:\n\n${linhas.join("\n")}\n\nTotal: ${fmtMoney(totalGeral)}`;
}
