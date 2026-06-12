import { STORAGE_KEY } from "./constants.js";
import { generateId } from "./finance.js";
import { selectPlanoContasForPf } from "./categoriasPfUtils.js";

// ─── Pessoa Jurídica ─────────────────────────────────────────────────────────

export const defaultCompany = () => ({
  nomeFantasia: "Empresa Demo",
  razaoSocial: "Empresa Demonstração Ltda",
  cnpj: "00.000.000/0001-91",
  inscricaoEstadual: "",
  codigoDominio: 0,
  dataFechamento: "",
});

export const defaultContas = () => [
  { id: "c1", codigo: 1, nome: "Caixa Geral",    apelido: "Caixa", tipo: "Caixa", saldoInicial: 0, contaContabil: "1.1.01", codigoClassificacao: null, classificacao: "", nomeClassificacao: "", natureza: "", inativo: false, usarSaldo: true },
  { id: "c2", codigo: 2, nome: "Banco Principal", apelido: "Banco", tipo: "Banco", saldoInicial: 0, contaContabil: "1.1.02", codigoClassificacao: null, classificacao: "", nomeClassificacao: "", natureza: "", inativo: false, usarSaldo: true },
];

export const defaultPlano = () => [
  // ── Receitas ─────────────────────────────────────────────────────────────────
  { id: generateId(), codigo: "1.1.001", classificacao: "RECEITA",  descricao: "Vendas de Produtos",      tipo: "Receita",  icone: "📦", cor: "oklch(0.55 0.14 150)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "1.1.002", classificacao: "RECEITA",  descricao: "Serviços Prestados",      tipo: "Receita",  icone: "🤝", cor: "oklch(0.55 0.18 163)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "1.1.003", classificacao: "RECEITA",  descricao: "Comissões Recebidas",     tipo: "Receita",  icone: "💰", cor: "oklch(0.60 0.16 145)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "1.1.004", classificacao: "RECEITA",  descricao: "Receitas Financeiras",    tipo: "Receita",  icone: "📈", cor: "oklch(0.52 0.17 240)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "1.1.005", classificacao: "RECEITA",  descricao: "Outras Receitas",         tipo: "Receita",  icone: "💳", cor: "oklch(0.55 0.14 150)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  // ── Custos ───────────────────────────────────────────────────────────────────
  { id: generateId(), codigo: "2.1.001", classificacao: "CUSTO",    descricao: "Custo de Mercadoria",     tipo: "Custo",    icone: "🛒", cor: "oklch(0.65 0.18 50)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "2.1.002", classificacao: "CUSTO",    descricao: "Custo de Serviços",       tipo: "Custo",    icone: "🔧", cor: "oklch(0.62 0.18 40)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "2.1.003", classificacao: "CUSTO",    descricao: "Matéria-Prima",           tipo: "Custo",    icone: "🏭", cor: "oklch(0.58 0.16 50)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "2.1.004", classificacao: "CUSTO",    descricao: "Frete / Logística",       tipo: "Custo",    icone: "🚚", cor: "oklch(0.50 0.03 220)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  // ── Despesas ──────────────────────────────────────────────────────────────────
  { id: generateId(), codigo: "3.1.001", classificacao: "DESPESA",  descricao: "Folha de Pagamento",      tipo: "Despesa",  icone: "👥", cor: "oklch(0.58 0.22 27)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "3.1.002", classificacao: "DESPESA",  descricao: "Pró-Labore",              tipo: "Despesa",  icone: "👤", cor: "oklch(0.55 0.20 27)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "3.1.003", classificacao: "DESPESA",  descricao: "Aluguel",                 tipo: "Despesa",  icone: "🏠", cor: "oklch(0.50 0.03 220)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "3.1.004", classificacao: "DESPESA",  descricao: "Energia / Água / Telecom",tipo: "Despesa",  icone: "💡", cor: "oklch(0.70 0.15 75)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "3.1.005", classificacao: "DESPESA",  descricao: "Marketing / Publicidade", tipo: "Despesa",  icone: "📊", cor: "oklch(0.52 0.17 240)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "3.1.006", classificacao: "DESPESA",  descricao: "TI / Software",           tipo: "Despesa",  icone: "💻", cor: "oklch(0.52 0.17 260)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "3.1.007", classificacao: "DESPESA",  descricao: "Contabilidade / Jurídico",tipo: "Despesa",  icone: "⚖️", cor: "oklch(0.55 0.01 0)",   natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "3.1.008", classificacao: "DESPESA",  descricao: "Manutenção / Reparos",    tipo: "Despesa",  icone: "🛠️", cor: "oklch(0.50 0.03 220)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "3.1.009", classificacao: "DESPESA",  descricao: "Viagens / Deslocamento",  tipo: "Despesa",  icone: "✈️", cor: "oklch(0.50 0.10 230)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "3.1.010", classificacao: "DESPESA",  descricao: "Despesas Bancárias",      tipo: "Despesa",  icone: "🏦", cor: "oklch(0.55 0.01 0)",   natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "3.1.011", classificacao: "DESPESA",  descricao: "Outras Despesas",         tipo: "Despesa",  icone: "📎", cor: "oklch(0.50 0.03 220)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  // ── Impostos ──────────────────────────────────────────────────────────────────
  { id: generateId(), codigo: "4.1.001", classificacao: "IMPOSTO",  descricao: "Simples Nacional",        tipo: "Imposto",  icone: "📋", cor: "oklch(0.55 0.01 0)",   natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "4.1.002", classificacao: "IMPOSTO",  descricao: "IRPJ / CSLL",             tipo: "Imposto",  icone: "🏦", cor: "oklch(0.52 0.01 0)",   natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "4.1.003", classificacao: "IMPOSTO",  descricao: "PIS / COFINS",            tipo: "Imposto",  icone: "📄", cor: "oklch(0.50 0.01 0)",   natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: generateId(), codigo: "4.1.004", classificacao: "IMPOSTO",  descricao: "ISS / ICMS / IPI",        tipo: "Imposto",  icone: "🧾", cor: "oklch(0.48 0.01 0)",   natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
];

export const createEmpresa = (nome = "Nova Empresa") => ({
  id: generateId(),
  nome,
  tipo: "juridica",
  company: defaultCompany(),
  pessoa: null,
  contas: defaultContas(),
  planoContas: defaultPlano(),
  lancamentos: [],
  clientes: [],
  fornecedores: [],
  fechamentos: [],
  metas: [],
  orcamentos: [],
  orcamentosCentros: [],
  orcamentosProjetos: [],
  centroCustos: [],
  projetos: [],
});

// ─── Pessoa Física ────────────────────────────────────────────────────────────

export const defaultPessoa = (nome = "Meu Perfil") => ({
  nome,
  cpf: "",
  email: "",
  telefone: "",
  dataNascimento: "",
  profissao: "",
});

export const defaultCategoriasPF = () => [
  // ── Receitas ─────────────────────────────────────────────────────────────────
  { id: "cf1",  codigo: "1.1", classificacao: "RECEITA", descricao: "Salário",             tipo: "Receita", icone: "💰", cor: "oklch(0.55 0.14 150)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: "cf2",  codigo: "1.2", classificacao: "RECEITA", descricao: "Freelance",           tipo: "Receita", icone: "🤝", cor: "oklch(0.55 0.18 163)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: "cf3",  codigo: "1.3", classificacao: "RECEITA", descricao: "Investimentos",       tipo: "Receita", icone: "📈", cor: "oklch(0.52 0.17 240)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: "cf4",  codigo: "1.4", classificacao: "RECEITA", descricao: "Aluguel Recebido",    tipo: "Receita", icone: "🏘️", cor: "oklch(0.55 0.16 155)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: "cf5",  codigo: "1.5", classificacao: "RECEITA", descricao: "Outros Recebimentos", tipo: "Receita", icone: "💳", cor: "oklch(0.55 0.14 150)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  // ── Despesas ──────────────────────────────────────────────────────────────────
  { id: "cf6",  codigo: "2.1", classificacao: "DESPESA", descricao: "Moradia",             tipo: "Despesa", icone: "🏠", cor: "oklch(0.55 0.17 240)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: "cf7",  codigo: "2.2", classificacao: "DESPESA", descricao: "Alimentação",         tipo: "Despesa", icone: "🍔", cor: "oklch(0.65 0.18 50)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: "cf8",  codigo: "2.3", classificacao: "DESPESA", descricao: "Transporte",          tipo: "Despesa", icone: "🚗", cor: "oklch(0.50 0.13 230)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: "cf9",  codigo: "2.4", classificacao: "DESPESA", descricao: "Saúde",               tipo: "Despesa", icone: "💊", cor: "oklch(0.55 0.14 150)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: "cf10", codigo: "2.5", classificacao: "DESPESA", descricao: "Educação",            tipo: "Despesa", icone: "📚", cor: "oklch(0.52 0.18 280)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: "cf11", codigo: "2.6", classificacao: "DESPESA", descricao: "Lazer / Entretenimento", tipo: "Despesa", icone: "🎭", cor: "oklch(0.58 0.20 330)", natureza: "Debito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: "cf12", codigo: "2.7", classificacao: "DESPESA", descricao: "Vestuário",           tipo: "Despesa", icone: "👗", cor: "oklch(0.60 0.16 310)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: "cf13", codigo: "2.8", classificacao: "DESPESA", descricao: "Assinaturas",         tipo: "Despesa", icone: "💻", cor: "oklch(0.55 0.17 240)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: "cf14", codigo: "2.9", classificacao: "DESPESA", descricao: "Academia / Esporte",  tipo: "Despesa", icone: "💪", cor: "oklch(0.65 0.18 50)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: "cf15", codigo: "2.10", classificacao: "DESPESA", descricao: "Pets",               tipo: "Despesa", icone: "🐾", cor: "oklch(0.62 0.16 50)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: "cf16", codigo: "2.11", classificacao: "DESPESA", descricao: "Viagens",            tipo: "Despesa", icone: "✈️", cor: "oklch(0.50 0.10 230)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: "cf17", codigo: "2.12", classificacao: "DESPESA", descricao: "Presentes / Doações",tipo: "Despesa", icone: "🎁", cor: "oklch(0.58 0.20 330)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  { id: "cf18", codigo: "2.13", classificacao: "DESPESA", descricao: "Outros Gastos",      tipo: "Despesa", icone: "📎", cor: "oklch(0.50 0.03 220)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
];

export const defaultContasPF = () => [
  { id: generateId(), codigo: 1, nome: "Carteira",       apelido: "Dinheiro", tipo: "Caixa",    saldoInicial: 0, contaContabil: "", codigoClassificacao: null, classificacao: "", nomeClassificacao: "", natureza: "", inativo: false, usarSaldo: true },
  { id: generateId(), codigo: 2, nome: "Conta Corrente", apelido: "Banco",    tipo: "Banco",    saldoInicial: 0, contaContabil: "", codigoClassificacao: null, classificacao: "", nomeClassificacao: "", natureza: "", inativo: false, usarSaldo: true },
  { id: generateId(), codigo: 3, nome: "Poupança",       apelido: "Poupança", tipo: "Poupança", saldoInicial: 0, contaContabil: "", codigoClassificacao: null, classificacao: "", nomeClassificacao: "", natureza: "", inativo: false, usarSaldo: true },
];

export const createPerfil = (nome = "Novo Perfil", tipo = "juridica") => {
  if (tipo === "fisica") {
    return {
      id: generateId(),
      nome,
      tipo: "fisica",
      pessoa: defaultPessoa(nome),
      company: defaultCompany(),
      contas: defaultContasPF(),
      planoContas: defaultCategoriasPF(),
      lancamentos: [],
      clientes: [],
      fornecedores: [],
      fechamentos: [],
      metas: [],
      orcamentos: [],
      orcamentosCentros: [],
      orcamentosProjetos: [],
      centroCustos: [],
      projetos: [],
    };
  }
  return createEmpresa(nome);
};

// ─── Estado global ────────────────────────────────────────────────────────────

export const defaultState = () => {
  const emp = createEmpresa("Empresa Demo");
  return {
    empresas: [emp],
    empresaAtivaId: emp.id,
    filterPeriodo: { ano: new Date().getFullYear().toString(), mes: "" },
  };
};

export const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed.empresas?.length) return defaultState();
    // migration: add new fields to existing profiles
    parsed.empresas = parsed.empresas.map((emp) => ({
      metas: [],
      orcamentos: [],
      orcamentosCentros: [],
      orcamentosProjetos: [],
      centroCustos: [],
      projetos: [],
      pessoa: null,
      tipo: "juridica",
      ...emp,
      fechamentos: emp.fechamentos || [],
      centroCustos: emp.centroCustos || [],
      contas: (emp.contas || []).map((c) => ({ apelido: "", ...c })),
    }));
    return parsed;
  } catch {
    return defaultState();
  }
};

export const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const isValidAppState = (dados) =>
  dados && Array.isArray(dados.empresas) && dados.empresas.length > 0;

/** Estado inicial alinhado ao tipo_perfil do usuário (PF ou PJ) */
export const createInitialStateForUser = (tipo = "juridica", nomePerfil = "Perfil") => {
  const emp = createPerfil(nomePerfil, tipo);
  return {
    empresas: [emp],
    empresaAtivaId: emp.id,
    filterPeriodo: { ano: new Date().getFullYear().toString(), mes: "" },
  };
};

function mergeEmpresaField(empresas, field) {
  const merged = [];
  const seen = new Set();
  for (const emp of empresas || []) {
    for (const item of emp[field] || []) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

/** Garante tipo da empresa ativa coerente com o cadastro do usuário (fonte: tipo_perfil) */
export const normalizeStateForUser = (dados, user) => {
  if (!isValidAppState(dados)) return dados;
  const tipoPerfil = user?.tipo_perfil;
  if (!tipoPerfil) return dados;

  const nome = user.nome_perfil || user.nome || "Perfil";
  const activeId = dados.empresaAtivaId || dados.empresas[0]?.id;
  const empresas = dados.empresas || [];

  if (tipoPerfil === "fisica") {
    const allLancamentos = empresas.flatMap((e) => e.lancamentos || []);
    const allMetas = empresas.flatMap((e) => e.metas || []);
    const allOrcamentos = empresas.flatMap((e) => e.orcamentos || []);
    const allFechamentos = empresas.flatMap((e) => e.fechamentos || []);
    const mergedCentroCustos = mergeEmpresaField(empresas, "centroCustos");
    const mergedProjetos = mergeEmpresaField(empresas, "projetos");
    const mergedOrcCentros = mergeEmpresaField(empresas, "orcamentosCentros");
    const mergedOrcProjetos = mergeEmpresaField(empresas, "orcamentosProjetos");
    const mergedPlanoRaw = mergeEmpresaField(empresas, "planoContas");
    const mergedPlano = selectPlanoContasForPf(
      mergedPlanoRaw,
      empresas,
      empresas.flatMap((e) => e.lancamentos || []),
      defaultCategoriasPF
    );
    const mergedContas = mergeEmpresaField(empresas, "contas");
    const mergedClientes = mergeEmpresaField(empresas, "clientes");
    const mergedFornecedores = mergeEmpresaField(empresas, "fornecedores");

    const base =
      empresas.find((e) => e.tipo === "fisica") ||
      empresas.find((e) => e.id === activeId) ||
      empresas[0];

    let converted;
    if (base.tipo === "fisica") {
      converted = {
        ...base,
        tipo: "fisica",
        nome: base.nome || nome,
        pessoa: base.pessoa || defaultPessoa(base.nome || nome),
        planoContas: mergedPlano.length
          ? mergedPlano
          : (base.planoContas?.length ? base.planoContas : defaultCategoriasPF()),
        contas: mergedContas.length
          ? mergedContas
          : (base.contas?.length ? base.contas : defaultContasPF()),
        clientes: mergedClientes.length ? mergedClientes : (base.clientes || []),
        fornecedores: mergedFornecedores.length ? mergedFornecedores : (base.fornecedores || []),
      };
    } else {
      converted = {
        ...createPerfil(base.nome || nome, "fisica"),
        id: base.id,
        pessoa: base.pessoa || defaultPessoa(base.nome || nome),
        contas: mergedContas.length
          ? mergedContas
          : (base.contas?.length ? base.contas : defaultContasPF()),
        planoContas: mergedPlano.length
          ? mergedPlano
          : (base.planoContas?.length ? base.planoContas : defaultCategoriasPF()),
        clientes: mergedClientes.length ? mergedClientes : (base.clientes || []),
        fornecedores: mergedFornecedores.length ? mergedFornecedores : (base.fornecedores || []),
      };
    }

    converted.lancamentos = allLancamentos.length ? allLancamentos : (converted.lancamentos || []);
    converted.metas = allMetas.length ? allMetas : (converted.metas || []);
    converted.orcamentos = allOrcamentos.length ? allOrcamentos : (converted.orcamentos || []);
    converted.fechamentos = allFechamentos.length ? allFechamentos : (converted.fechamentos || []);
    converted.centroCustos = mergedCentroCustos.length
      ? mergedCentroCustos
      : (converted.centroCustos || []);
    converted.projetos = mergedProjetos.length
      ? mergedProjetos
      : (converted.projetos || []);
    converted.orcamentosCentros = mergedOrcCentros.length
      ? mergedOrcCentros
      : (converted.orcamentosCentros || []);
    converted.orcamentosProjetos = mergedOrcProjetos.length
      ? mergedOrcProjetos
      : (converted.orcamentosProjetos || []);

    return { ...dados, empresas: [converted], empresaAtivaId: converted.id };
  }

  const mergedPlanoPj = mergeEmpresaField(empresas, "planoContas");
  const mergedContasPj = mergeEmpresaField(empresas, "contas");
  const mergedClientesPj = mergeEmpresaField(empresas, "clientes");
  const mergedFornecedoresPj = mergeEmpresaField(empresas, "fornecedores");

  const empresasOut = empresas.map((emp) => {
    if (emp.id !== activeId) return emp;
    return {
      ...emp,
      tipo: "juridica",
      nome: emp.nome || nome,
      company: emp.company || defaultCompany(),
      planoContas: mergedPlanoPj.length
        ? mergedPlanoPj
        : (emp.planoContas?.length ? emp.planoContas : defaultPlano()),
      contas: mergedContasPj.length
        ? mergedContasPj
        : (emp.contas?.length ? emp.contas : defaultContas()),
      clientes: mergedClientesPj.length ? mergedClientesPj : (emp.clientes || []),
      fornecedores: mergedFornecedoresPj.length
        ? mergedFornecedoresPj
        : (emp.fornecedores || []),
      centroCustos: emp.centroCustos || [],
      projetos: emp.projetos || [],
      orcamentosCentros: emp.orcamentosCentros || [],
      orcamentosProjetos: emp.orcamentosProjetos || [],
    };
  });

  return { ...dados, empresas: empresasOut };
};

export const getEmpresaAtiva = (state) =>
  state.empresas.find((e) => e.id === state.empresaAtivaId) || state.empresas[0];

export const updateEmpresaAtiva = (state, patch) => {
  const empresas = state.empresas.map((e) =>
    e.id === state.empresaAtivaId ? { ...e, ...patch } : e
  );
  return { ...state, empresas };
};
