import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  saveState,
  getEmpresaAtiva,
  updateEmpresaAtiva,
  createEmpresa,
  createPerfil,
  isValidAppState,
  createInitialStateForUser,
  normalizeStateForUser,
  defaultState,
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
import { stateApi, adminApi, healthApi } from "./api.js";
import { useAuth } from "./AuthContext.jsx";
import { normalizeTipoPerfil, resolveProfileTipo } from "./profileLabels.js";
import { safeNum } from "./finance.js";
import { registerStateFlush } from "./persistence.js";

const GestorContext = createContext(null);

const SAVE_DEBOUNCE_MS = 800;

export function GestorProvider({ children }) {
  const { token, user, profileReady, empresa: authEmpresa } = useAuth();

  const [state, setState] = useState(() => defaultState());
  const [appLoading, setAppLoading] = useState(!!token);
  const [appLoadError, setAppLoadError] = useState(false);
  const isFirstLoad = useRef(true);
  // Só permite salvar após pelo menos um carregamento bem-sucedido da API.
  // Impede que erros de rede na carga inicial sobrescrevam o banco com estado vazio.
  const loadOk = useRef(false);
  const saveTimer = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Marca state vindo de um reload silencioso para não disparar save em loop
  const justReloaded = useRef(false);
  // Sinaliza save pendente (debounce ativo) — usado p/ flush antes de reload
  const dirtyPending = useRef(false);

  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("Todos");
  const [consiliadoFilter, setConsiliadoFilter] = useState("Todos");
  const [contaFilter, setContaFilter] = useState("");
  const [showSaldoCol, setShowSaldoCol] = useState(false);
  const [modalOpen, setModalOpen] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [apiOnline, setApiOnline] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [impersonatingUser, setImpersonatingUser] = useState(null);
  const adminStateBackup = useRef(null);

  const buildProfile = useCallback((u) => ({
    tipo_perfil: normalizeTipoPerfil(u?.tipo_perfil),
    nome_perfil: u?.nome_perfil || u?.nome,
    nome: u?.nome,
  }), []);

  const viewOnly = !!impersonatingUser || authEmpresa?.viewOnly === true;

  const persistState = useCallback(async (snapshot) => {
    // Só salva se o estado foi carregado com sucesso pelo menos uma vez.
    // Isso evita que falhas de rede na inicialização sobrescrevam dados no banco.
    if (!token || viewOnly || !loadOk.current) return;
    await stateApi.save(snapshot);
  }, [token, viewOnly]);

  const flushStateSave = useCallback(async () => {
    clearTimeout(saveTimer.current);
    if (!token || isFirstLoad.current) return;
    try {
      await persistState(stateRef.current);
    } catch (err) {
      console.warn("Falha ao salvar estado (flush):", err.message);
      throw err;
    }
  }, [token, persistState]);

  useEffect(() => {
    registerStateFlush(flushStateSave);
    return () => registerStateFlush(null);
  }, [flushStateSave]);

  // Carrega estado só com perfil confirmado no servidor (evita PF→PJ por sessão antiga)
  useEffect(() => {
    if (!token) {
      setAppLoading(false);
      isFirstLoad.current = true;
      loadOk.current = false;
      return;
    }
    if (impersonatingUser) return;
    if (!profileReady) return;
    if (!user?.tipo_perfil) {
      if (user?.role === "admin") {
        setAppLoading(false);
        isFirstLoad.current = false;
      }
      return;
    }

    const profile = buildProfile(user);
    isFirstLoad.current = true;
    setAppLoading(true);
    setAppLoadError(false);

    stateApi
      .fetch()
      .then(({ dados, profile: serverProfile }) => {
        const p = serverProfile?.tipo_perfil
          ? { ...profile, ...serverProfile }
          : profile;
        const next = isValidAppState(dados)
          ? normalizeStateForUser(dados, p)
          : createInitialStateForUser(p.tipo_perfil, p.nome_perfil || p.nome);
        setState(next);
        stateRef.current = next;
        // Marca carga bem-sucedida — libera saves futuros
        loadOk.current = true;
        setAppLoadError(false);
        setLastSyncAt(Date.now());
      })
      .catch((err) => {
        console.warn("Falha ao carregar estado da API:", err.message);
        // IMPORTANTE: não chamar setState aqui.
        // Se chamássemos createInitialStateForUser() e depois isFirstLoad ficasse false,
        // o save effect dispararia e sobrescreveria o banco com estado vazio.
        // loadOk permanece false → persistState não executa → dados no banco ficam seguros.
        if (!loadOk.current) {
          setAppLoadError(true);
        }
      })
      .finally(() => {
        setAppLoading(false);
        isFirstLoad.current = false;
      });
  }, [token, user?.id, user?.tipo_perfil, impersonatingUser, profileReady, buildProfile]);

  useEffect(() => {
    if (isFirstLoad.current || !token) return;
    if (justReloaded.current) {
      // state veio de reload silencioso — não disparar save
      justReloaded.current = false;
      return;
    }

    clearTimeout(saveTimer.current);
    dirtyPending.current = true;
    saveTimer.current = setTimeout(() => {
      persistState(stateRef.current)
        .then(() => { dirtyPending.current = false; })
        .catch((err) => console.warn("Falha ao salvar estado na API:", err.message));
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(saveTimer.current);
  }, [state, token, impersonatingUser, persistState]);

  // ── Reload silencioso (auto-refresh sem reload do navegador) ────────────────
  // Re-busca o estado do servidor em focus/visibilidade/intervalo leve.
  // Antes do fetch, faz flush de qualquer save pendente para preservar
  // alterações locais. Após setState, suprime o save effect via justReloaded.
  const reloadAppState = useCallback(async (opts = {}) => {
    if (!token || viewOnly || !loadOk.current) return;
    if (isFirstLoad.current) return;
    if (syncing) return;
    const skipFlush = opts?.skipFlush === true;
    setSyncing(true);
    try {
      if (!skipFlush && dirtyPending.current) {
        try { await flushStateSave(); } catch {}
      }
      const { dados, profile: serverProfile } = await stateApi.fetch();
      const profileBase = buildProfile(user);
      const profile = serverProfile?.tipo_perfil
        ? { ...profileBase, ...serverProfile }
        : profileBase;
      if (isValidAppState(dados)) {
        const next = normalizeStateForUser(dados, profile);
        justReloaded.current = true;
        setState(next);
        stateRef.current = next;
      }
      setLastSyncAt(Date.now());
    } catch (err) {
      console.warn("Reload silencioso falhou:", err.message);
    } finally {
      setSyncing(false);
    }
  }, [token, viewOnly, syncing, buildProfile, user, flushStateSave]);

  // Triggers automáticos: focus, visibilitychange, intervalo de 60s
  useEffect(() => {
    if (!token || viewOnly) return;
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        reloadAppState();
      }
    };
    const onFocus = () => reloadAppState();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus);
    }
    const interval = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        reloadAppState();
      }
    }, 60000);
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onFocus);
      }
      clearInterval(interval);
    };
  }, [token, viewOnly, reloadAppState]);

  useEffect(() => {
    const ping = () =>
      healthApi.status().then((s) => setApiOnline(!!s.online)).catch(() => setApiOnline(false));
    ping();
    const t = setInterval(ping, 30000);
    return () => clearInterval(t);
  }, []);

  const empresa = useMemo(() => {
    const active = getEmpresaAtiva(state);
    if (active) return active;
    if (state.empresas?.[0]) return state.empresas[0];
    return defaultState().empresas[0];
  }, [state]);
  const { company, contas, planoContas, clientes, fornecedores } = empresa;

  // Retrocompatibilidade: normaliza tipo "Despesa"→"Saida" e "Receita"→"Entrada"
  // (lançamentos gerados por recorrências antigas usavam os tipos errados)
  const lancamentos = useMemo(
    () => (empresa.lancamentos || []).map((l) => {
      const base =
        l.tipo === "Despesa" ? { ...l, tipo: "Saida" } :
        l.tipo === "Receita" ? { ...l, tipo: "Entrada" } : l;
      if (base.valor == null || base.valor === "") return base;
      const rounded = safeNum(base.valor);
      return rounded === base.valor ? base : { ...base, valor: rounded };
    }),
    [empresa.lancamentos]
  );
  const fechamentos = empresa.fechamentos  || [];
  const metas       = empresa.metas        || [];
  const orcamentos  = empresa.orcamentos   || [];
  const orcamentosCentros = empresa.orcamentosCentros || [];
  const orcamentosProjetos = empresa.orcamentosProjetos || [];
  const centroCustos = empresa.centroCustos || [];
  const projetos = empresa.projetos || [];
  const profileTipo = resolveProfileTipo({
    user,
    impersonatingUser,
    empresaTipo: empresa.tipo,
  });
  const tipo        = profileTipo;
  const pessoa      = empresa.pessoa       || null;
  const filterPeriodo = state.filterPeriodo;

  const setFilterPeriodo = useCallback((updater) => {
    setState((s) => ({
      ...s,
      filterPeriodo: typeof updater === "function" ? updater(s.filterPeriodo) : updater,
    }));
  }, []);

  const patchEmpresa = useCallback((patch) => {
    if (viewOnly) return;
    setState((s) => updateEmpresaAtiva(s, patch));
  }, [viewOnly]);

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

  const enterAsTenant = useCallback(async (tenantUser) => {
    if (!tenantUser?.ativo) {
      throw new Error("Conta inativa. Ative o cliente antes de entrar.");
    }
    if (!impersonatingUser) {
      await flushStateSave().catch(() => {});
      adminStateBackup.current = stateRef.current;
    }
    const { dados } = await adminApi.getUserState(tenantUser.id);
    const profile = buildProfile(tenantUser);
    const next = isValidAppState(dados)
      ? normalizeStateForUser(dados, profile)
      : createInitialStateForUser(profile.tipo_perfil, profile.nome_perfil || profile.nome);
    setState(next);
    stateRef.current = next;
    setImpersonatingUser(tenantUser);
    isFirstLoad.current = false;
  }, [impersonatingUser, buildProfile, flushStateSave]);

  const exitAsTenant = useCallback(async () => {
    if (!impersonatingUser) return;
    await flushStateSave().catch(() => {});
    setImpersonatingUser(null);
    if (adminStateBackup.current) {
      setState(adminStateBackup.current);
      stateRef.current = adminStateBackup.current;
      adminStateBackup.current = null;
    } else if (token && user?.tipo_perfil) {
      try {
        const profile = buildProfile(user);
        const { dados } = await stateApi.fetch();
        const next = isValidAppState(dados)
          ? normalizeStateForUser(dados, profile)
          : createInitialStateForUser(profile.tipo_perfil, profile.nome_perfil || profile.nome);
        setState(next);
        stateRef.current = next;
      } catch (err) {
        console.warn("Falha ao restaurar estado do admin:", err.message);
      }
    }
  }, [impersonatingUser, flushStateSave, token, user, buildProfile]);

  const openModal = useCallback((type, item = null) => {
    if (viewOnly) return;
    setModalOpen(type);
    setEditingItem(item);
  }, [viewOnly]);

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
  const centroCustoCrud = crudList("centroCustos");
  const projetoCrud = crudList("projetos");
  const orcamentoCentroCrud = crudList("orcamentosCentros");
  const orcamentoProjetoCrud = crudList("orcamentosProjetos");

  const saveLancamento = useCallback(
    (data) => {
      const ent = contas.find((c) => c.id === data.contaEntradaId);
      const sai = contas.find((c) => c.id === data.contaSaidaId);
      const pago = data.pago === true;
      const payload = {
        ...data,
        codigo: data.codigo ? Number(data.codigo) : undefined,
        valor: safeNum(data.valor),
        contaEntradaId: data.contaEntradaId || null,
        contaSaidaId:   data.contaSaidaId   || null,
        codigoDestino:  ent?.codigo ?? data.codigoDestino ?? null,
        codigoOrigem:   sai?.codigo ?? data.codigoOrigem  ?? null,
        clienteId:      data.clienteId    || null,
        fornecedorId:   data.fornecedorId || null,
        centroCustoId:  data.centroCustoId || null,
        projetoId:      data.projetoId || null,
        status: pago ? "pago" : data.status === "pendente" ? "pendente" : data.status || (pago ? "pago" : "pendente"),
        pago,
        ...(pago && !data.dataPagamento
          ? { dataPagamento: data.data || new Date().toISOString().slice(0, 10) }
          : {}),
      };
      if (editingItem?.id) {
        lancCrud.update(editingItem.id, payload);
      } else {
        const nums = lancamentos.map((l) => Number(l.codigo)).filter((n) => !Number.isNaN(n));
        lancCrud.add({
          ...payload,
          id:          generateId(),
          codigo:      payload.codigo ?? (nums.length ? Math.max(...nums) + 1 : 1),
          lote:        payload.lote || nextLote(lancamentos),
          tipoOrigem:  payload.tipoOrigem  || "",
          tipoDestino: payload.tipoDestino || "",
        });
      }
      closeModal();
      setTimeout(() => flushStateSave().catch(() => {}), 50);
    },
    [editingItem, lancamentos, lancCrud, closeModal, contas, flushStateSave]
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

  const lancsFiltrados = useMemo(
    () => filterLancamentos(lancamentos, {
      ano: filterPeriodo.ano,
      mes: filterPeriodo.mes,
      tipo: tipoFilter,
      search,
      contaId: contaFilter || undefined,
      consiliado: consiliadoFilter === "Sim" ? "Sim" : consiliadoFilter === "Nao" ? "Nao" : undefined,
    }),
    [lancamentos, filterPeriodo, tipoFilter, search, contaFilter, consiliadoFilter]
  );

  const perfilFin = tipo === "fisica" ? "pf" : "pj";
  const dreAtual   = useMemo(
    () => getDRE(lancamentos, planoContas, filterPeriodo.ano, filterPeriodo.mes, { perfil: perfilFin }),
    [lancamentos, planoContas, filterPeriodo, perfilFin]
  );
  const mensal     = useMemo(
    () => getMensal(lancamentos, planoContas, filterPeriodo.ano, { perfil: perfilFin }),
    [lancamentos, planoContas, filterPeriodo.ano, perfilFin]
  );
  const balancete  = useMemo(() => getBalancete(lancamentos, planoContas, contas, filterPeriodo.ano, filterPeriodo.mes), [lancamentos, planoContas, contas, filterPeriodo]);
  const fluxoCaixa = useMemo(() => getFluxoCaixa(lancamentos, filterPeriodo.ano, filterPeriodo.mes),          [lancamentos, filterPeriodo]);
  const consultaDRE = useMemo(() => getConsultaDRE(lancamentos, planoContas, contas, filterPeriodo.ano, filterPeriodo.mes), [lancamentos, planoContas, contas, filterPeriodo]);

  const saldoContaFn = useCallback((id) => getSaldoConta(id, contas, lancamentos), [contas, lancamentos]);
  const saldoTotalFn = useCallback(() => getSaldoTotal(contas, lancamentos),        [contas, lancamentos]);
  const getDREByRangeFn = useCallback((from, to) => getDREByRange(lancamentos, planoContas, from, to), [lancamentos, planoContas]);
  const getConsultaDREByRangeFn = useCallback((from, to) => getConsultaDREByRange(lancamentos, planoContas, contas, from, to), [lancamentos, planoContas, contas]);

  const value = {
    state, setState, appLoading, appLoadError,
    empresa, tipo, profileTipo, pessoa,
    company, contas, planoContas, lancamentos, clientes, fornecedores,
    metas, orcamentos, orcamentosCentros, orcamentosProjetos, centroCustos, projetos,
    viewOnly,
    impersonatingUser, enterAsTenant, exitAsTenant,
    filterPeriodo, setFilterPeriodo,
    search, setSearch,
    tipoFilter, setTipoFilter,
    consiliadoFilter, setConsiliadoFilter,
    contaFilter, setContaFilter,
    showSaldoCol, setShowSaldoCol,
    modalOpen, editingItem, openModal, closeModal,
    apiOnline,
    lastSyncAt, syncing, reloadAppState,
    setEmpresaField, setPessoaField, updateEmpresaData, patchEmpresa,
    switchEmpresa, addEmpresa, addPerfil, removePerfil,
    saveLancamento, markConsiliado, setLancamentos, flushStateSave,
    lancCrud, contaCrud, planoCrud, clienteCrud, fornecedorCrud,
    fechamentos, fechamentoCrud,
    metaCrud, orcamentoCrud, orcamentoCentroCrud, orcamentoProjetoCrud,
    centroCustoCrud, projetoCrud,
    lancsFiltrados, dreAtual, consultaDRE, mensal, balancete, fluxoCaixa,
    getSaldoConta: saldoContaFn,
    getSaldoTotal: saldoTotalFn,
    getDRE: (ano, mes) => getDRE(lancamentos, planoContas, ano, mes, { perfil: perfilFin }),
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
