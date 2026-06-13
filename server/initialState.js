/**
 * Espelha a lógica de storage.js do frontend.
 * Gera o estado inicial de um tenant (PF ou PJ) no servidor,
 * sem depender de módulos React/browser.
 */

import { randomUUID } from "crypto";
import { selectPlanoContasForPf } from "../src/gestor/categoriasPfUtils.js";

const id = () => randomUUID();
const ano = () => new Date().getFullYear().toString();

// ── Pessoa Jurídica ────────────────────────────────────────────────────────────

function defaultCompany(nome) {
  return {
    nomeFantasia: nome,
    razaoSocial: nome,
    cnpj: "",
    inscricaoEstadual: "",
    codigoDominio: 0,
    dataFechamento: "",
  };
}

function defaultContasPJ() {
  return [
    { id: id(), codigo: 1, nome: "Caixa Geral",     apelido: "Caixa", tipo: "Caixa", saldoInicial: 0, contaContabil: "1.1.01", codigoClassificacao: null, classificacao: "", nomeClassificacao: "", natureza: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: 2, nome: "Banco Principal",  apelido: "Banco", tipo: "Banco", saldoInicial: 0, contaContabil: "1.1.02", codigoClassificacao: null, classificacao: "", nomeClassificacao: "", natureza: "", inativo: false, usarSaldo: true },
  ];
}

function defaultPlanoPJ() {
  return [
    // ── Receitas ──────────────────────────────────────────────────────────
    { id: id(), codigo: "1.1.001", classificacao: "RECEITA",  descricao: "Vendas de Produtos",       tipo: "Receita",  icone: "📦", cor: "oklch(0.55 0.14 150)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "1.1.002", classificacao: "RECEITA",  descricao: "Serviços Prestados",       tipo: "Receita",  icone: "🤝", cor: "oklch(0.55 0.18 163)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "1.1.003", classificacao: "RECEITA",  descricao: "Comissões Recebidas",      tipo: "Receita",  icone: "💰", cor: "oklch(0.60 0.16 145)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "1.1.004", classificacao: "RECEITA",  descricao: "Receitas Financeiras",     tipo: "Receita",  icone: "📈", cor: "oklch(0.52 0.17 240)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "1.1.005", classificacao: "RECEITA",  descricao: "Outras Receitas",          tipo: "Receita",  icone: "💳", cor: "oklch(0.55 0.14 150)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    // ── Custos ────────────────────────────────────────────────────────────
    { id: id(), codigo: "2.1.001", classificacao: "CUSTO",    descricao: "Custo de Mercadoria",      tipo: "Custo",    icone: "🛒", cor: "oklch(0.65 0.18 50)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "2.1.002", classificacao: "CUSTO",    descricao: "Custo de Serviços",        tipo: "Custo",    icone: "🔧", cor: "oklch(0.62 0.18 40)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "2.1.003", classificacao: "CUSTO",    descricao: "Matéria-Prima",            tipo: "Custo",    icone: "🏭", cor: "oklch(0.58 0.16 50)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "2.1.004", classificacao: "CUSTO",    descricao: "Frete / Logística",        tipo: "Custo",    icone: "🚚", cor: "oklch(0.50 0.03 220)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    // ── Despesas ──────────────────────────────────────────────────────────
    { id: id(), codigo: "3.1.001", classificacao: "DESPESA",  descricao: "Folha de Pagamento",       tipo: "Despesa",  icone: "👥", cor: "oklch(0.58 0.22 27)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "3.1.002", classificacao: "DESPESA",  descricao: "Pró-Labore",               tipo: "Despesa",  icone: "👤", cor: "oklch(0.55 0.20 27)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "3.1.003", classificacao: "DESPESA",  descricao: "Aluguel",                  tipo: "Despesa",  icone: "🏠", cor: "oklch(0.50 0.03 220)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "3.1.004", classificacao: "DESPESA",  descricao: "Energia / Água / Telecom", tipo: "Despesa",  icone: "💡", cor: "oklch(0.70 0.15 75)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "3.1.005", classificacao: "DESPESA",  descricao: "Marketing / Publicidade",  tipo: "Despesa",  icone: "📊", cor: "oklch(0.52 0.17 240)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "3.1.006", classificacao: "DESPESA",  descricao: "TI / Software",            tipo: "Despesa",  icone: "💻", cor: "oklch(0.52 0.17 260)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "3.1.007", classificacao: "DESPESA",  descricao: "Contabilidade / Jurídico", tipo: "Despesa",  icone: "⚖️", cor: "oklch(0.55 0.01 0)",   natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "3.1.008", classificacao: "DESPESA",  descricao: "Manutenção / Reparos",     tipo: "Despesa",  icone: "🛠️", cor: "oklch(0.50 0.03 220)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "3.1.009", classificacao: "DESPESA",  descricao: "Viagens / Deslocamento",   tipo: "Despesa",  icone: "✈️", cor: "oklch(0.50 0.10 230)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "3.1.010", classificacao: "DESPESA",  descricao: "Despesas Bancárias",       tipo: "Despesa",  icone: "🏦", cor: "oklch(0.55 0.01 0)",   natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "3.1.011", classificacao: "DESPESA",  descricao: "Outras Despesas",          tipo: "Despesa",  icone: "📎", cor: "oklch(0.50 0.03 220)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    // ── Impostos ──────────────────────────────────────────────────────────
    { id: id(), codigo: "4.1.001", classificacao: "IMPOSTO",  descricao: "Simples Nacional",         tipo: "Imposto",  icone: "📋", cor: "oklch(0.55 0.01 0)",   natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "4.1.002", classificacao: "IMPOSTO",  descricao: "IRPJ / CSLL",              tipo: "Imposto",  icone: "🏦", cor: "oklch(0.52 0.01 0)",   natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "4.1.003", classificacao: "IMPOSTO",  descricao: "PIS / COFINS",             tipo: "Imposto",  icone: "📄", cor: "oklch(0.50 0.01 0)",   natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "4.1.004", classificacao: "IMPOSTO",  descricao: "ISS / ICMS / IPI",         tipo: "Imposto",  icone: "🧾", cor: "oklch(0.48 0.01 0)",   natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  ];
}

function createEmpresaPJ(nome) {
  const empId = id();
  return {
    empresas: [{
      id: empId, nome, tipo: "juridica",
      onboardingConcluido: false,
      onboardingEtapa: "pj-1",
      tourConcluido: false,
      company: defaultCompany(nome),
      pessoa: null,
      contas: defaultContasPJ(),
      planoContas: defaultPlanoPJ(),
      lancamentos: [], clientes: [], fornecedores: [],
      fechamentos: [], metas: [], orcamentos: [], orcamentosCentros: [], orcamentosProjetos: [],
      centroCustos: [], projetos: [],
    }],
    empresaAtivaId: empId,
    filterPeriodo: { ano: ano(), mes: "" },
  };
}

// ── Pessoa Física ──────────────────────────────────────────────────────────────

function defaultContasPF() {
  return [
    { id: id(), codigo: 1, nome: "Carteira",       apelido: "Dinheiro", tipo: "Caixa",    saldoInicial: 0, contaContabil: "", codigoClassificacao: null, classificacao: "", nomeClassificacao: "", natureza: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: 2, nome: "Conta Corrente", apelido: "Banco",    tipo: "Banco",    saldoInicial: 0, contaContabil: "", codigoClassificacao: null, classificacao: "", nomeClassificacao: "", natureza: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: 3, nome: "Poupança",       apelido: "Poupança", tipo: "Poupança", saldoInicial: 0, contaContabil: "", codigoClassificacao: null, classificacao: "", nomeClassificacao: "", natureza: "", inativo: false, usarSaldo: true },
  ];
}

function defaultCategoriasPF() {
  return [
    // ── Receitas ──────────────────────────────────────────────────────────
    { id: id(), codigo: "1.1",  classificacao: "RECEITA", descricao: "Salário",               tipo: "Receita", icone: "💰", cor: "oklch(0.55 0.14 150)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "1.2",  classificacao: "RECEITA", descricao: "Freelance",             tipo: "Receita", icone: "🤝", cor: "oklch(0.55 0.18 163)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "1.3",  classificacao: "RECEITA", descricao: "Investimentos",         tipo: "Receita", icone: "📈", cor: "oklch(0.52 0.17 240)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "1.4",  classificacao: "RECEITA", descricao: "Aluguel Recebido",      tipo: "Receita", icone: "🏘️", cor: "oklch(0.55 0.16 155)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "1.5",  classificacao: "RECEITA", descricao: "Outros Recebimentos",   tipo: "Receita", icone: "💳", cor: "oklch(0.55 0.14 150)", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    // ── Despesas ──────────────────────────────────────────────────────────
    { id: id(), codigo: "2.1",  classificacao: "DESPESA", descricao: "Moradia",               tipo: "Despesa", icone: "🏠", cor: "oklch(0.55 0.17 240)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "2.2",  classificacao: "DESPESA", descricao: "Alimentação",           tipo: "Despesa", icone: "🍔", cor: "oklch(0.65 0.18 50)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "2.3",  classificacao: "DESPESA", descricao: "Transporte",            tipo: "Despesa", icone: "🚗", cor: "oklch(0.50 0.13 230)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "2.4",  classificacao: "DESPESA", descricao: "Saúde",                 tipo: "Despesa", icone: "💊", cor: "oklch(0.55 0.14 150)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "2.5",  classificacao: "DESPESA", descricao: "Educação",              tipo: "Despesa", icone: "📚", cor: "oklch(0.52 0.18 280)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "2.6",  classificacao: "DESPESA", descricao: "Lazer / Entretenimento",tipo: "Despesa", icone: "🎭", cor: "oklch(0.58 0.20 330)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "2.7",  classificacao: "DESPESA", descricao: "Vestuário",             tipo: "Despesa", icone: "👗", cor: "oklch(0.60 0.16 310)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "2.8",  classificacao: "DESPESA", descricao: "Assinaturas",           tipo: "Despesa", icone: "💻", cor: "oklch(0.55 0.17 240)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "2.9",  classificacao: "DESPESA", descricao: "Academia / Esporte",    tipo: "Despesa", icone: "💪", cor: "oklch(0.65 0.18 50)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "2.10", classificacao: "DESPESA", descricao: "Pets",                  tipo: "Despesa", icone: "🐾", cor: "oklch(0.62 0.16 50)",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "2.11", classificacao: "DESPESA", descricao: "Viagens",               tipo: "Despesa", icone: "✈️", cor: "oklch(0.50 0.10 230)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "2.12", classificacao: "DESPESA", descricao: "Presentes / Doações",   tipo: "Despesa", icone: "🎁", cor: "oklch(0.58 0.20 330)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
    { id: id(), codigo: "2.13", classificacao: "DESPESA", descricao: "Outros Gastos",         tipo: "Despesa", icone: "📎", cor: "oklch(0.50 0.03 220)", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true, sistema: true },
  ];
}

function createPerfilPF(nome) {
  const empId = id();
  return {
    empresas: [{
      id: empId, nome, tipo: "fisica",
      onboardingConcluido: false,
      onboardingEtapa: "pf-1",
      tourConcluido: false,
      pessoa: { nome, cpf: "", email: "", telefone: "", dataNascimento: "", profissao: "" },
      company: defaultCompany(nome),
      contas: defaultContasPF(),
      planoContas: defaultCategoriasPF(),
      lancamentos: [], clientes: [], fornecedores: [],
      fechamentos: [], metas: [], orcamentos: [], orcamentosCentros: [], orcamentosProjetos: [],
      centroCustos: [], projetos: [],
    }],
    empresaAtivaId: empId,
    filterPeriodo: { ano: ano(), mes: "" },
  };
}

// ── Exporta ────────────────────────────────────────────────────────────────────

export function createInitialState(tipo, nomePerfil) {
  return tipo === "fisica"
    ? createPerfilPF(nomePerfil)
    : createEmpresaPJ(nomePerfil);
}

function defaultPessoa(nome) {
  return { nome, cpf: "", email: "", telefone: "", dataNascimento: "", profissao: "" };
}

const isValidAppState = (dados) =>
  dados && Array.isArray(dados.empresas) && dados.empresas.length > 0;

/**
 * Adiciona categorias padrão que ainda não existem no plano do usuário.
 * Espelha migratePlanoContas() do frontend (storage.js).
 */
function migratePlanoContas(plano, defaults) {
  const existingKeys = new Set((plano || []).map((p) => p.descricao.toLowerCase().trim()));
  const toAdd = defaults.filter(
    (d) => !existingKeys.has(d.descricao.toLowerCase().trim())
  ).map((d) => ({ ...d, id: randomUUID() }));
  return [...(plano || []), ...toAdd];
}

/** Une listas de todas as empresas (evita perder categorias/contas em slots legados). */
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

function countPlanoContas(dados) {
  return mergeEmpresaField(dados?.empresas, 'planoContas').length;
}

/** Alinha empresa ativa ao tipo_perfil do usuário (mesma regra do frontend) */
export function normalizeStateForUser(dados, user) {
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
    const mergedCentroCustos = mergeEmpresaField(empresas, 'centroCustos');
    const mergedProjetos = mergeEmpresaField(empresas, 'projetos');
    const mergedOrcCentros = mergeEmpresaField(empresas, 'orcamentosCentros');
    const mergedOrcProjetos = mergeEmpresaField(empresas, 'orcamentosProjetos');
    const mergedPlanoRaw = mergeEmpresaField(empresas, 'planoContas');
    const mergedPlanoSelecionado = selectPlanoContasForPf(
      mergedPlanoRaw,
      empresas,
      empresas.flatMap((e) => e.lancamentos || []),
      defaultCategoriasPF
    );
    const mergedPlano = migratePlanoContas(mergedPlanoSelecionado, defaultCategoriasPF());
    const mergedContas = mergeEmpresaField(empresas, 'contas');
    const mergedClientes = mergeEmpresaField(empresas, 'clientes');
    const mergedFornecedores = mergeEmpresaField(empresas, 'fornecedores');

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
      const pf = createPerfilPF(base.nome || nome);
      converted = {
        ...pf.empresas[0],
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

  const mergedPlanoPjRaw = mergeEmpresaField(empresas, 'planoContas');
  const mergedPlanoPj = migratePlanoContas(
    mergedPlanoPjRaw.length ? mergedPlanoPjRaw : null,
    defaultPlanoPJ()
  );
  const mergedContasPj = mergeEmpresaField(empresas, 'contas');
  const mergedClientesPj = mergeEmpresaField(empresas, 'clientes');
  const mergedFornecedoresPj = mergeEmpresaField(empresas, 'fornecedores');

  const empresasOut = empresas.map((emp) => {
    if (emp.id !== activeId) return emp;
    return {
      ...emp,
      tipo: "juridica",
      nome: emp.nome || nome,
      company: emp.company || defaultCompany(emp.nome || nome),
      contas: mergedContasPj.length
        ? mergedContasPj
        : (emp.contas?.length ? emp.contas : defaultContasPJ()),
      planoContas: mergedPlanoPj.length ? mergedPlanoPj : defaultPlanoPJ(),
      lancamentos: emp.lancamentos || [],
      clientes: mergedClientesPj.length ? mergedClientesPj : (emp.clientes || []),
      fornecedores: mergedFornecedoresPj.length
        ? mergedFornecedoresPj
        : (emp.fornecedores || []),
      fechamentos: emp.fechamentos || [],
      metas: emp.metas || [],
      orcamentos: emp.orcamentos || [],
      centroCustos: emp.centroCustos || [],
      projetos: emp.projetos || [],
      orcamentosCentros: emp.orcamentosCentros || [],
      orcamentosProjetos: emp.orcamentosProjetos || [],
    };
  });

  return { ...dados, empresas: empresasOut };
}

export { countPlanoContas, mergeEmpresaField };
