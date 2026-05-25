/**
 * Espelha a lógica de storage.js do frontend.
 * Gera o estado inicial de um tenant (PF ou PJ) no servidor,
 * sem depender de módulos React/browser.
 */

import { randomUUID } from "crypto";

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
    codigoEmpresa: 1,
    dataFechamento: "",
    caminhoBanco: "",
    senhaBanco: "",
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
    versaoBanco: "2.0",
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
    versaoBanco: "2.0",
  };
}

// ── Exporta ────────────────────────────────────────────────────────────────────

export function createInitialState(tipo, nomePerfil) {
  return tipo === "fisica"
    ? createPerfilPF(nomePerfil)
    : createEmpresaPJ(nomePerfil);
}
