import { STORAGE_KEY } from "./constants.js";
import { generateId } from "./finance.js";

// ─── Pessoa Jurídica ─────────────────────────────────────────────────────────

export const defaultCompany = () => ({
  nomeFantasia: "Empresa Demo",
  razaoSocial: "Empresa Demonstração Ltda",
  cnpj: "00.000.000/0001-91",
  inscricaoEstadual: "",
  codigoDominio: 0,
  codigoEmpresa: 1,
  dataFechamento: "",
  caminhoBanco: "",
  senhaBanco: "",
});

export const defaultContas = () => [
  { id: "c1", codigo: 1, nome: "Caixa Geral",    apelido: "Caixa", tipo: "Caixa", saldoInicial: 0, contaContabil: "1.1.01", codigoClassificacao: null, classificacao: "", nomeClassificacao: "", natureza: "", inativo: false, usarSaldo: true },
  { id: "c2", codigo: 2, nome: "Banco Principal", apelido: "Banco", tipo: "Banco", saldoInicial: 0, contaContabil: "1.1.02", codigoClassificacao: null, classificacao: "", nomeClassificacao: "", natureza: "", inativo: false, usarSaldo: true },
];

export const defaultPlano = () => [
  { id: "p1", codigo: "1.1.001", classificacao: "RECEITA",  descricao: "Receitas Operacionais",   tipo: "Receita",  natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  { id: "p2", codigo: "2.1.001", classificacao: "CUSTO",    descricao: "Custos Operacionais",      tipo: "Custo",    natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  { id: "p3", codigo: "3.1.001", classificacao: "DESPESA",  descricao: "Despesas Administrativas", tipo: "Despesa",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  { id: "p4", codigo: "4.1.001", classificacao: "IMPOSTO",  descricao: "Simples Nacional",         tipo: "Imposto",  natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
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
  { id: "cf1",  codigo: "1.1", classificacao: "RECEITA", descricao: "Salário",             tipo: "Receita", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  { id: "cf2",  codigo: "1.2", classificacao: "RECEITA", descricao: "Freelance",           tipo: "Receita", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  { id: "cf3",  codigo: "1.3", classificacao: "RECEITA", descricao: "Investimentos",       tipo: "Receita", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  { id: "cf4",  codigo: "1.4", classificacao: "RECEITA", descricao: "Outros Recebimentos", tipo: "Receita", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  { id: "cf5",  codigo: "2.1", classificacao: "DESPESA", descricao: "Moradia",             tipo: "Despesa", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  { id: "cf6",  codigo: "2.2", classificacao: "DESPESA", descricao: "Alimentação",         tipo: "Despesa", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  { id: "cf7",  codigo: "2.3", classificacao: "DESPESA", descricao: "Transporte",          tipo: "Despesa", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  { id: "cf8",  codigo: "2.4", classificacao: "DESPESA", descricao: "Saúde",               tipo: "Despesa", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  { id: "cf9",  codigo: "2.5", classificacao: "DESPESA", descricao: "Educação",            tipo: "Despesa", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  { id: "cf10", codigo: "2.6", classificacao: "DESPESA", descricao: "Lazer",               tipo: "Despesa", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  { id: "cf11", codigo: "2.7", classificacao: "DESPESA", descricao: "Vestuário",           tipo: "Despesa", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  { id: "cf12", codigo: "2.8", classificacao: "DESPESA", descricao: "Outros Gastos",       tipo: "Despesa", natureza: "Debito",  caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
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
    versaoBanco: "2.0",
    dataFechamento: "",
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
      pessoa: null,
      tipo: "juridica",
      ...emp,
      fechamentos: emp.fechamentos || [],
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

export const getEmpresaAtiva = (state) =>
  state.empresas.find((e) => e.id === state.empresaAtivaId) || state.empresas[0];

export const updateEmpresaAtiva = (state, patch) => {
  const empresas = state.empresas.map((e) =>
    e.id === state.empresaAtivaId ? { ...e, ...patch } : e
  );
  return { ...state, empresas };
};
