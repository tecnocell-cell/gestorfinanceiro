/**
 * Catálogo de tutoriais — preencha youtubeUrl e videoId quando os vídeos estiverem publicados.
 * videoId: ID do YouTube para embed (ex.: dQw4w9WgXcQ)
 */
export const TUTORIAIS_CATALOG = [
  {
    id: "dashboard-visao",
    title: "Visão geral do Dashboard",
    category: "Dashboard",
    thumb: "📊",
    duration: "Em breve",
    youtubeUrl: null,
    videoId: null,
  },
  {
    id: "lancamento-receita",
    title: "Como registrar uma receita",
    category: "Lançamentos",
    thumb: "💰",
    duration: "Em breve",
    youtubeUrl: null,
    videoId: null,
  },
  {
    id: "lancamento-despesa",
    title: "Como registrar uma despesa",
    category: "Lançamentos",
    thumb: "💸",
    duration: "Em breve",
    youtubeUrl: null,
    videoId: null,
  },
  {
    id: "transferencia",
    title: "Transferência entre contas",
    category: "Lançamentos",
    thumb: "↔️",
    duration: "Em breve",
    youtubeUrl: null,
    videoId: null,
  },
  {
    id: "categoria-despesa",
    title: "Como criar categoria de despesa",
    category: "Categorias",
    thumb: "🏷️",
    duration: "Em breve",
    youtubeUrl: null,
    videoId: null,
  },
  {
    id: "categoria-receita",
    title: "Como criar categoria de receita",
    category: "Categorias",
    thumb: "📥",
    duration: "Em breve",
    youtubeUrl: null,
    videoId: null,
  },
  {
    id: "conta-bancaria",
    title: "Cadastrar conta bancária",
    category: "Contas",
    thumb: "🏦",
    duration: "Em breve",
    youtubeUrl: null,
    videoId: null,
  },
  {
    id: "recorrencia",
    title: "Despesas e receitas recorrentes",
    category: "Recorrências",
    thumb: "🔁",
    duration: "Em breve",
    youtubeUrl: null,
    videoId: null,
  },
  {
    id: "orcamento",
    title: "Montar seu orçamento mensal",
    category: "Orçamento",
    thumb: "📋",
    duration: "Em breve",
    youtubeUrl: null,
    videoId: null,
  },
  {
    id: "metas",
    title: "Criar metas de poupança",
    category: "Metas",
    thumb: "🎯",
    duration: "Em breve",
    youtubeUrl: null,
    videoId: null,
  },
  {
    id: "resumo-anual",
    title: "Entender o Resumo Anual",
    category: "Relatórios",
    thumb: "📅",
    duration: "Em breve",
    youtubeUrl: null,
    videoId: null,
  },
  {
    id: "whatsapp",
    title: "Lançar pelo WhatsApp",
    category: "WhatsApp",
    thumb: "💬",
    duration: "Em breve",
    youtubeUrl: null,
    videoId: null,
  },
];

export function tutorialYoutubeWatchUrl(item) {
  if (item.youtubeUrl) return item.youtubeUrl;
  if (item.videoId) return `https://www.youtube.com/watch?v=${item.videoId}`;
  return null;
}

export function tutorialEmbedUrl(item) {
  if (!item.videoId) return null;
  return `https://www.youtube.com/embed/${item.videoId}?rel=0`;
}
