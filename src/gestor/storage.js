import { STORAGE_KEY } from "./constants.js";
import { generateId } from "./finance.js";

/** Dados fictícios apenas para demo — sem CNPJ/valores reais de clientes. */
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
  { id: "c1", codigo: 1, nome: "Caixa Geral", apelido: "Caixa", tipo: "Caixa", saldoInicial: 0, contaContabil: "1.1.01", codigoClassificacao: null, classificacao: "", nomeClassificacao: "", natureza: "", inativo: false, usarSaldo: true },
  { id: "c2", codigo: 2, nome: "Banco Principal", apelido: "Banco", tipo: "Banco", saldoInicial: 0, contaContabil: "1.1.02", codigoClassificacao: null, classificacao: "", nomeClassificacao: "", natureza: "", inativo: false, usarSaldo: true },
];

export const defaultPlano = () => [
  { id: "p1", codigo: "1.1.001", classificacao: "RECEITA", descricao: "Receitas operacionais", tipo: "Receita", natureza: "Credito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  { id: "p2", codigo: "2.1.001", classificacao: "CUSTO", descricao: "Custos operacionais", tipo: "Custo", natureza: "Debito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
  { id: "p3", codigo: "3.1.001", classificacao: "DESPESA", descricao: "Despesas administrativas", tipo: "Despesa", natureza: "Debito", caixaBanco: "", contaContabil: "", inativo: false, usarSaldo: true },
];

export const createEmpresa = (nome = "Nova Empresa") => ({
  id: generateId(),
  nome,
  company: defaultCompany(),
  contas: defaultContas(),
  planoContas: defaultPlano(),
  lancamentos: [],
  clientes: [],
  fornecedores: [],
  fechamentos: [],
});

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
    parsed.empresas = parsed.empresas.map((emp) => ({
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
