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
    { id: id(), codigo: "1.1.001", classificacao: "RECEITA",  descricao: "Receitas Operacionais",   tipo: "Receita",  natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: "2.1.001", classificacao: "CUSTO",    descricao: "Custos Operacionais",      tipo: "Custo",    natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: "3.1.001", classificacao: "DESPESA",  descricao: "Despesas Administrativas", tipo: "Despesa",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: "4.1.001", classificacao: "IMPOSTO",  descricao: "Simples Nacional",         tipo: "Imposto",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  ];
}

function createEmpresaPJ(nome) {
  const empId = id();
  return {
    empresas: [{
      id: empId, nome, tipo: "juridica",
      company: defaultCompany(nome),
      pessoa: null,
      contas: defaultContasPJ(),
      planoContas: defaultPlanoPJ(),
      lancamentos: [], clientes: [], fornecedores: [],
      fechamentos: [], metas: [], orcamentos: [],
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
    { id: id(), codigo: "1.1", classificacao: "RECEITA", descricao: "Salário",             tipo: "Receita", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: "1.2", classificacao: "RECEITA", descricao: "Freelance",           tipo: "Receita", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: "1.3", classificacao: "RECEITA", descricao: "Investimentos",       tipo: "Receita", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: "1.4", classificacao: "RECEITA", descricao: "Outros Recebimentos", tipo: "Receita", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: "2.1", classificacao: "DESPESA", descricao: "Moradia",             tipo: "Despesa", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: "2.2", classificacao: "DESPESA", descricao: "Alimentação",         tipo: "Despesa", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: "2.3", classificacao: "DESPESA", descricao: "Transporte",          tipo: "Despesa", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: "2.4", classificacao: "DESPESA", descricao: "Saúde",               tipo: "Despesa", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: "2.5", classificacao: "DESPESA", descricao: "Educação",            tipo: "Despesa", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: "2.6", classificacao: "DESPESA", descricao: "Lazer",               tipo: "Despesa", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: "2.7", classificacao: "DESPESA", descricao: "Vestuário",           tipo: "Despesa", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
    { id: id(), codigo: "2.8", classificacao: "DESPESA", descricao: "Outros Gastos",       tipo: "Despesa", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  ];
}

function createPerfilPF(nome) {
  const empId = id();
  return {
    empresas: [{
      id: empId, nome, tipo: "fisica",
      pessoa: { nome, cpf: "", email: "", telefone: "", dataNascimento: "", profissao: "" },
      company: defaultCompany(nome),
      contas: defaultContasPF(),
      planoContas: defaultCategoriasPF(),
      lancamentos: [], clientes: [], fornecedores: [],
      fechamentos: [], metas: [], orcamentos: [],
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
    const mergedPlanoRaw = mergeEmpresaField(empresas, 'planoContas');
    const mergedPlano = selectPlanoContasForPf(
      mergedPlanoRaw,
      empresas,
      empresas.flatMap((e) => e.lancamentos || []),
      defaultCategoriasPF
    );
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

    return { ...dados, empresas: [converted], empresaAtivaId: converted.id };
  }

  const mergedPlanoPj = mergeEmpresaField(empresas, 'planoContas');
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
      planoContas: mergedPlanoPj.length
        ? mergedPlanoPj
        : (emp.planoContas?.length ? emp.planoContas : defaultPlanoPJ()),
      lancamentos: emp.lancamentos || [],
      clientes: mergedClientesPj.length ? mergedClientesPj : (emp.clientes || []),
      fornecedores: mergedFornecedoresPj.length
        ? mergedFornecedoresPj
        : (emp.fornecedores || []),
      fechamentos: emp.fechamentos || [],
      metas: emp.metas || [],
      orcamentos: emp.orcamentos || [],
    };
  });

  return { ...dados, empresas: empresasOut };
}

export { countPlanoContas, mergeEmpresaField };
