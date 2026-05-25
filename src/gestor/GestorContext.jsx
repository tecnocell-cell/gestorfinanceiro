import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  loadState,
  saveState,
  getEmpresaAtiva,
  updateEmpresaAtiva,
  createEmpresa,
  createPerfil,
} from "./storage.js";
import {
  filterLancamentos,
  getDRE,
  getDREByRange,
  getMensal,
  getBalancete,
  getFluxoCaixa,
  getSaldoConta,
  getSaldoTotal,
  getConsultaDRE,
  getConsultaDREByRange,
  generateId,
  nextLote,
} from "./finance.js";
import { checkApiStatus, syncFromAccess } from "./importExport.js";
import { mergeSyncPayload } from "./lacusSync.js";

const GestorContext = createContext(null);

export function GestorProvider({ children }) {
  const [state, setState] = useState(loadState);
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("Todos");
  const [consiliadoFilter, setConsiliadoFilter] = useState("Todos");
  const [contaFilter, setContaFilter] = useState("");
  const [showSaldoCol, setShowSaldoCol] = useState(false);
  const [modalOpen, setModalOpen] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [apiOnline, setApiOnline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  const empresa = useMemo(() => getEmpresaAtiva(state), [state]);
  const { company, contas, planoContas, lancamentos, clientes, fornecedores } = empresa;
  const fechamentos  = empresa.fechamentos  || [];
  const metas        = empresa.metas        || [];
  const orcamentos   = empresa.orcamentos   || [];
  const tipo         = empresa.tipo         || "juridica";
  const pessoa       = empresa.pessoa       || null;
  const filterPeriodo = state.filterPeriodo;

  useEffect(() => { saveState(state); }, [state]);

  useEffect(() => {
    checkApiStatus().then((s) => setApiOnline(!!s.online));
    const t = setInterval(() => {
      checkApiStatus().then((s) => setApiOnline(!!s.online));
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const setFilterPeriodo = useCallback((updater) => {
    setState((s) => ({
      ...s,
      filterPeriodo: typeof updater === "function" ? updater(s.filterPeriodo) : updater,
    }));
  }, []);

  const patchEmpresa = useCallback((patch) => {
    setState((s) => updateEmpresaAtiva(s, patch));
  }, []);

  const setEmpresaField = useCallback((field, value) => {
    setState((s) => {
      const emp = getEmpresaAtiva(s);
      return updateEmpresaAtiva(s, { company: { ...emp.company, [field]: value } });
    });
  }, []);

  const setPessoaField = useCallback((field, value) => {
    setState((s) => {
      const emp = getEmpresaAtiva(s);
      return updateEmpresaAtiva(s, { pessoa: { ...(emp.pessoa || {}), [field]: value } });
    });
  }, []);

  const updateEmpresaData = useCallback((data) => { patchEmpresa(data); }, [patchEmpresa]);

  const switchEmpresa = useCallback((id) => {
    setState((s) => ({ ...s, empresaAtivaId: id }));
  }, []);

  const addEmpresa = useCallback((nome) => {
    const emp = createEmpresa(nome);
    setState((s) => ({ ...s, empresas: [...s.empresas, emp], empresaAtivaId: emp.id }));
  }, []);

  const addPerfil = useCallback((nome, tipoPerfil = "juridica") => {
    const emp = createPerfil(nome, tipoPerfil);
    setState((s) => ({ ...s, empresas: [...s.empresas, emp], empresaAtivaId: emp.id }));
  }, []);

  const removePerfil = useCallback((id) => {
    setState((s) => {
      const empresas = s.empresas.filter((e) => e.id !== id);
      if (!empresas.length) return s;
      const empresaAtivaId = s.empresaAtivaId === id ? empresas[0].id : s.empresaAtivaId;
      return { ...s, empresas, empresaAtivaId };
    });
  }, []);

  const openModal = useCallback((type, item = null) => {
    setModalOpen(type);
    setEditingItem(item);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(null);
    setEditingItem(null);
  }, []);

  const crudList = (key) => ({
    add:    (item) => patchEmpresa({ [key]: [...(empresa[key] || []), item] }),
    update: (id, data) =>
      patchEmpresa({ [key]: (empresa[key] || []).map((x) => (x.id === id ? { ...x, ...data } : x)) }),
    remove: (id) =>
      patchEmpresa({ [key]: (empresa[key] || []).filter((x) => x.id !== id) }),
  });

  const lancCrud       = crudList("lancamentos");
  const contaCrud      = crudList("contas");
  const planoCrud      = crudList("planoContas");
  const clienteCrud    = crudList("clientes");
  const fornecedorCrud = crudList("fornecedores");
  const fechamentoCrud = crudList("fechamentos");
  const metaCrud       = crudList("metas");
  const orcamentoCrud  = crudList("orcamentos");

  const saveLancamento = useCallback(
    (data) => {
      const ent = contas.find((c) => c.id === data.contaEntradaId);
      const sai = contas.find((c) => c.id === data.contaSaidaId);
      const payload = {
        ...data,
        codigo: data.codigo ? Number(data.codigo) : undefined,
        valor: parseFloat(data.valor),
        contaEntradaId: data.contaEntradaId || null,
        contaSaidaId: data.contaSaidaId || null,
        codigoDestino: ent?.codigo ?? data.codigoDestino ?? null,
        codigoOrigem: sai?.codigo ?? data.codigoOrigem ?? null,
        clienteId: data.clienteId || null,
        fornecedorId: data.fornecedorId || null,
      };
      if (editingItem?.id) {
        lancCrud.update(editingItem.id, payload);
      } else {
        const nums = lancamentos.map((l) => Number(l.codigo)).filter((n) => !Number.isNaN(n));
        lancCrud.add({
          ...payload,
          id: generateId(),
          codigo: payload.codigo ?? (nums.length ? Math.max(...nums) + 1 : 1),
          lote: payload.lote || nextLote(lancamentos),
          tipoOrigem: payload.tipoOrigem || "",
          tipoDestino: payload.tipoDestino || "",
        });
      }
      closeModal();
    },
    [editingItem, lancamentos, lancCrud, closeModal, contas]
  );

  const markConsiliado = useCallback(
    (id) => { lancCrud.update(id, { consiliado: true }); },
    [lancCrud]
  );

  const setLancamentos = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(lancamentos) : updater;
      patchEmpresa({ lancamentos: next });
    },
    [lancamentos, patchEmpresa]
  );

  const syncAccess = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const data = await syncFromAccess(company.caminhoBanco, company.senhaBanco);
      const { empresaPatch, statePatch } = mergeSyncPayload(empresa, data);
      if (!Object.keys(empresaPatch).length && !Object.keys(statePatch).length) {
        throw new Error("Nenhum dado retornado do Access.");
      }
      setState((s) => {
        const updated = updateEmpresaAtiva(s, empresaPatch);
        return { ...updated, ...statePatch };
      });
    } catch (e) {
      setSyncError(e.message);
    } finally {
      setSyncing(false);
    }
  }, [company, empresa]);

  const lancsFiltrados = useMemo(
    () =>
      [...filterLancamentos(lancamentos, {
        ano: filterPeriodo.ano,
        mes: filterPeriodo.mes,
        tipo: tipoFilter,
        search,
        contaId: contaFilter || undefined,
        consiliado: consiliadoFilter === "Sim" ? "Sim" : consiliadoFilter === "Nao" ? "Nao" : undefined,
      })].reverse(),
    [lancamentos, filterPeriodo, tipoFilter, search, contaFilter, consiliadoFilter]
  );

  const dreAtual = useMemo(
    () => getDRE(lancamentos, planoContas, filterPeriodo.ano, filterPeriodo.mes),
    [lancamentos, planoContas, filterPeriodo]
  );

  const mensal = useMemo(
    () => getMensal(lancamentos, planoContas, filterPeriodo.ano),
    [lancamentos, planoContas, filterPeriodo.ano]
  );

  const balancete = useMemo(
    () => getBalancete(lancamentos, planoContas, contas, filterPeriodo.ano, filterPeriodo.mes),
    [lancamentos, planoContas, contas, filterPeriodo]
  );

  const fluxoCaixa = useMemo(
    () => getFluxoCaixa(lancamentos, filterPeriodo.ano, filterPeriodo.mes),
    [lancamentos, filterPeriodo]
  );

  const saldoContaFn = useCallback((id) => getSaldoConta(id, contas, lancamentos), [contas, lancamentos]);
  const saldoTotalFn = useCallback(() => getSaldoTotal(contas, lancamentos), [contas, lancamentos]);

  const consultaDRE = useMemo(
    () => getConsultaDRE(lancamentos, planoContas, contas, filterPeriodo.ano, filterPeriodo.mes),
    [lancamentos, planoContas, contas, filterPeriodo]
  );

  const getDREByRangeFn = useCallback(
    (from, to) => getDREByRange(lancamentos, planoContas, from, to),
    [lancamentos, planoContas]
  );

  const getConsultaDREByRangeFn = useCallback(
    (from, to) => getConsultaDREByRange(lancamentos, planoContas, contas, from, to),
    [lancamentos, planoContas, contas]
  );

  const value = {
    state, setState,
    empresa, tipo, pessoa,
    company, contas, planoContas, lancamentos, clientes, fornecedores,
    metas, orcamentos,
    filterPeriodo, setFilterPeriodo,
    search, setSearch,
    tipoFilter, setTipoFilter,
    consiliadoFilter, setConsiliadoFilter,
    contaFilter, setContaFilter,
    showSaldoCol, setShowSaldoCol,
    modalOpen, editingItem, openModal, closeModal,
    apiOnline, syncing, syncError,
    setEmpresaField, setPessoaField, updateEmpresaData, patchEmpresa,
    switchEmpresa, addEmpresa, addPerfil, removePerfil,
    saveLancamento, markConsiliado, setLancamentos,
    lancCrud, contaCrud, planoCrud, clienteCrud, fornecedorCrud,
    fechamentos, fechamentoCrud,
    metaCrud, orcamentoCrud,
    syncAccess,
    lancsFiltrados, dreAtual, consultaDRE, mensal, balancete, fluxoCaixa,
    getSaldoConta: saldoContaFn,
    getSaldoTotal: saldoTotalFn,
    getDRE: (ano, mes) => getDRE(lancamentos, planoContas, ano, mes),
    getDREByRange: getDREByRangeFn,
    getConsultaDREByRange: getConsultaDREByRangeFn,
    nextLote: () => nextLote(lancamentos),
  };

  return <GestorContext.Provider value={value}>{children}</GestorContext.Provider>;
}

export function useGestor() {
  const ctx = useContext(GestorContext);
  if (!ctx) throw new Error("useGestor deve ser usado dentro de GestorProvider");
  return ctx;
}
