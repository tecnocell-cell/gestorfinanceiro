/** Mapeamento Gestor Lacus (Access TB_*) → modelo web */

export function pick(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return undefined;
}

export function parseNum(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isNaN(n) ? undefined : n;
}

export function parseBool(v) {
  if (v === undefined || v === null || v === "") return false;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "sim" || s === "yes" || s === "-1";
}

export function parseDate(raw) {
  if (!raw) return "";
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const s = String(raw);
  if (s.includes("T")) return s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s.slice(0, 10);
}

function stableId(prefix, codigo, idx) {
  if (codigo !== undefined && codigo !== null && codigo !== "") {
    return `${prefix}_${String(codigo).replace(/\W/g, "_")}`;
  }
  return `${prefix}_${idx}`;
}

function normalizeTipoConta(raw) {
  const s = String(raw || "Banco").toLowerCase();
  if (s.includes("caixa")) return "Caixa";
  if (s.includes("banco")) return "Banco";
  return String(raw || "Banco");
}

function normalizePlanoTipo(raw) {
  const s = String(raw || "").toUpperCase();
  if (s.includes("CUST")) return "Custo";
  if (s.includes("DESP")) return "Despesa";
  if (s.includes("RECE")) return "Receita";
  return "Receita";
}

export function mapContasRows(rows) {
  return rows.map((row, idx) => {
    const codigo = parseNum(pick(row, "TB_Codigo", "Codigo", "codigo")) ?? idx + 1;
    return {
      id: stableId("cta", codigo, idx),
      codigo,
      nome: String(pick(row, "TB_Nome", "Nome", "Descricao") ?? "Conta"),
      tipo: normalizeTipoConta(pick(row, "TB_Caixa_Banco", "Tipo", "tipo")),
      saldoInicial: parseNum(pick(row, "TB_Saldo_Inicial", "SaldoInicial", "saldo_inicial")) ?? 0,
      contaContabil: String(pick(row, "TB_Conta_Contabil", "ContaContabil", "conta_contabil") ?? ""),
      codigoClassificacao: parseNum(
        pick(row, "TB_Codigo_Classificacao", "TB_Codigo_classificacao", "Codigo_Classificacao")
      ),
      classificacao: String(pick(row, "TB_Classificacao", "Classificacao", "classificacao") ?? ""),
      nomeClassificacao: String(
        pick(row, "TB_Nome_classificacao", "Nome_classificacao", "NomeClassificacao") ?? ""
      ),
      natureza: String(pick(row, "TB_Natureza", "Natureza", "natureza") ?? ""),
      inativo: parseBool(pick(row, "TB_Inativo", "Inativo", "inativo")),
      usarSaldo: pick(row, "TB_Usar_saldo", "UsarSaldo", "usar_saldo") === undefined
        ? true
        : parseBool(pick(row, "TB_Usar_saldo", "UsarSaldo", "usar_saldo")),
    };
  });
}

export function mapPlanoRows(rows) {
  return rows.map((row, idx) => {
    const codigoRaw = pick(row, "TB_Codigo", "TB_Codigo_Classificacao", "Codigo", "codigo");
    const codigo = codigoRaw !== undefined ? String(codigoRaw) : String(idx + 1);
    const classificacao = String(
      pick(row, "TB_Classificacao", "Classificacao", "classificacao") ?? ""
    ).toUpperCase();
    const tipo = normalizePlanoTipo(classificacao || pick(row, "TB_Natureza", "Tipo", "tipo"));
    return {
      id: stableId("pln", codigo, idx),
      codigo,
      classificacao: classificacao || tipo.toUpperCase(),
      descricao: String(
        pick(row, "TB_Nome_classificacao", "Nome_classificacao", "Descricao", "descricao") ?? ""
      ),
      tipo,
      natureza: String(
        pick(row, "TB_Natureza", "Natureza", "natureza") ??
          (tipo === "Receita" ? "Credito" : "Debito")
      ),
      caixaBanco: String(pick(row, "TB_Caixa_Banco", "Caixa_Banco") ?? ""),
      contaContabil: String(pick(row, "TB_Conta_Contabil", "ContaContabil") ?? ""),
      inativo: parseBool(pick(row, "TB_Inativo", "Inativo")),
      usarSaldo: pick(row, "TB_Usar_saldo", "UsarSaldo") === undefined
        ? true
        : parseBool(pick(row, "TB_Usar_saldo", "UsarSaldo")),
    };
  });
}

export function mapCompanyRow(rows) {
  if (!rows?.length) return null;
  const row = rows[0];
  return {
    nomeFantasia: String(pick(row, "TB_Nome_Fantasia", "NomeFantasia", "nome_fantasia") ?? ""),
    razaoSocial: String(pick(row, "TB_Razao_Social", "RazaoSocial", "razao_social") ?? ""),
    cnpj: String(pick(row, "TB_CNPJ", "CNPJ", "cnpj") ?? ""),
    inscricaoEstadual: String(
      pick(row, "TB_Inscricao_Estadual", "InscricaoEstadual", "inscricao_estadual") ?? ""
    ),
    codigoDominio:
      parseNum(pick(row, "TB_Codigo_Dominio", "CodigoDominio", "codigo_dominio")) ?? 0,
    codigoEmpresa: parseNum(pick(row, "TB_Codigo_Empresa", "Codigo_Empresa", "CodigoEmpresa")),
    dataFechamento: parseDate(pick(row, "TB_Data_Fechamento", "Data_Fechamento", "DataFechamento")),
  };
}

export function mapVersaoRow(rows) {
  if (!rows?.length) return null;
  const row = rows[0];
  return {
    versaoBanco: String(pick(row, "TB_Versao_Banco_dados", "Versao_Banco_dados", "Versao") ?? ""),
    dataFechamento: parseDate(pick(row, "TB_Data_Fechamento", "Data_Fechamento")),
  };
}

export function mapClientesRows(rows) {
  return rows.map((row, idx) => {
    const codigo = parseNum(pick(row, "TB_Codigo", "TB_cliente_codigo", "Codigo")) ?? idx + 1;
    return {
      id: stableId("cli", codigo, idx),
      codigo,
      nome: String(pick(row, "TB_cliente_nome", "Nome", "nome") ?? ""),
      apelido: String(pick(row, "TB_cliente_apelido", "Apelido") ?? ""),
      documento: String(pick(row, "TB_cliente_cpf_cnpj", "CPF_CNPJ", "documento") ?? ""),
      email: String(pick(row, "TB_cliente_email", "Email", "email") ?? ""),
      telefone: String(pick(row, "TB_cliente_fone", "Fone", "telefone") ?? ""),
      endereco: String(pick(row, "TB_cliente_endereco", "Endereco") ?? ""),
      bairro: String(pick(row, "TB_cliente_bairro", "Bairro") ?? ""),
      cidade: String(pick(row, "TB_cliente_cidade", "Cidade") ?? ""),
      estado: String(pick(row, "TB_cliente_estado", "Estado") ?? ""),
      contato: String(pick(row, "TB_cliente_contato", "Contato") ?? ""),
      tipo: String(pick(row, "TB_cliente_tipo", "Tipo") ?? ""),
      rgInscricao: String(pick(row, "TB_cliente_rg_inscricao", "RG_Inscricao") ?? ""),
    };
  });
}

export function mapFornecedoresRows(rows) {
  return rows.map((row, idx) => {
    const codigo = parseNum(pick(row, "TB_Codigo", "TB_fornecedores_codigo", "Codigo")) ?? idx + 1;
    return {
      id: stableId("for", codigo, idx),
      codigo,
      nome: String(pick(row, "TB_fornecedores_nome", "Nome", "nome") ?? ""),
      apelido: String(pick(row, "TB_fornecedores_apelido", "Apelido") ?? ""),
      documento: String(pick(row, "TB_fornecedores_cpf_cnpj", "CPF_CNPJ", "documento") ?? ""),
      email: String(pick(row, "TB_fornecedores_email", "Email", "email") ?? ""),
      telefone: String(pick(row, "TB_fornecedores_fone", "Fone", "telefone") ?? ""),
      endereco: String(pick(row, "TB_fornecedores_endereco", "Endereco") ?? ""),
      bairro: String(pick(row, "TB_fornecedores_bairro", "Bairro") ?? ""),
      cidade: String(pick(row, "TB_fornecedores_cidade", "Cidade") ?? ""),
      estado: String(pick(row, "TB_fornecedores_estado", "Estado") ?? ""),
      contato: String(pick(row, "TB_fornecedores_contato", "Contato") ?? ""),
      tipo: String(pick(row, "TB_fornecedores_tipo", "Tipo") ?? ""),
      rgInscricao: String(pick(row, "TB_fornecedores_rg_inscricao", "RG_Inscricao") ?? ""),
    };
  });
}

function resolveTipoLancamento(row, codigoOrigem, codigoDestino) {
  if (codigoOrigem && codigoDestino) return "Transferencia";
  if (codigoDestino && !codigoOrigem) return "Entrada";
  if (codigoOrigem && !codigoDestino) return "Saida";

  const tipoDest = String(pick(row, "TB_Tipo_Destino", "Tipo_Destino") ?? "").toLowerCase();
  const tipoOrig = String(pick(row, "TB_Tipo_Origem", "Tipo_Origem") ?? "").toLowerCase();
  if (tipoOrig && tipoDest) return "Transferencia";
  if (tipoDest.includes("ent") || tipoDest.includes("cred")) return "Entrada";
  if (tipoOrig.includes("sai") || tipoOrig.includes("deb")) return "Saida";
  const tipo = String(pick(row, "TB_Tipo", "Tipo", "tipo") ?? "Entrada").toLowerCase();
  if (tipo.includes("trans")) return "Transferencia";
  if (tipo.includes("sai")) return "Saida";
  return "Entrada";
}

export function mapLancamentosRows(rows, ctx) {
  const { contaByCodigo, planoByCodigo, clienteByCodigo, fornecedorByCodigo } = ctx;

  return rows.map((row, idx) => {
    const codigo = parseNum(pick(row, "TB_Codigo", "Codigo", "ID", "Id", "id")) ?? idx + 1;
    const codigoOrigem = parseNum(pick(row, "TB_codigo_Origem", "TB_Codigo_Origem", "codigo_Origem"));
    const codigoDestino = parseNum(pick(row, "TB_codigo_Destino", "TB_Codigo_Destino", "codigo_Destino"));
    const tipo = resolveTipoLancamento(row, codigoOrigem, codigoDestino);

    const contaEntrada = codigoDestino != null ? contaByCodigo.get(String(codigoDestino)) : null;
    const contaSaida = codigoOrigem != null ? contaByCodigo.get(String(codigoOrigem)) : null;

    const classCod = pick(
      row,
      "TB_Codigo_Classificacao",
      "TB_Codigo_classificacao",
      "Codigo_Classificacao"
    );
    let plano =
      classCod != null
        ? planoByCodigo.get(String(classCod))
        : null;
    if (!plano && contaEntrada?.codigoClassificacao != null) {
      plano = planoByCodigo.get(String(contaEntrada.codigoClassificacao));
    }
    if (!plano && contaSaida?.codigoClassificacao != null) {
      plano = planoByCodigo.get(String(contaSaida.codigoClassificacao));
    }

    const clienteCod = parseNum(pick(row, "TB_cliente_codigo", "TB_Codigo_Cliente", "ClienteId"));
    const fornecedorCod = parseNum(
      pick(row, "TB_fornecedores_codigo", "TB_Codigo_Fornecedor", "FornecedorId")
    );

    return {
      id: stableId("lac", codigo, idx),
      codigo,
      lote: String(pick(row, "TB_Lote", "Lote", "lote", "LOTE") ?? "L001"),
      data: parseDate(pick(row, "TB_Data", "Data", "data", "DT_Lancamento")) ||
        new Date().toISOString().slice(0, 10),
      tipo,
      valor: Math.abs(parseNum(pick(row, "TB_Valor", "Valor", "valor", "VALOR")) ?? 0),
      historico: String(pick(row, "TB_Historico", "Historico", "historico", "HISTORICO") ?? ""),
      contaContabil: String(pick(row, "TB_Conta_Contabil", "Conta_Contabil", "ContaContabil") ?? ""),
      natureza: String(pick(row, "TB_Natureza", "Natureza") ?? ""),
      codigoOrigem: codigoOrigem ?? null,
      codigoDestino: codigoDestino ?? null,
      tipoOrigem: String(pick(row, "TB_Tipo_Origem", "Tipo_Origem") ?? ""),
      tipoDestino: String(pick(row, "TB_Tipo_Destino", "Tipo_Destino") ?? ""),
      contaEntradaId: contaEntrada?.id ?? null,
      contaSaidaId: contaSaida?.id ?? null,
      planoId: plano?.id ?? null,
      exportado: parseBool(
        pick(row, "TB_Exportar_dominio", "Exportar_dominio", "Exportado", "exportado")
      ),
      consiliado: parseBool(pick(row, "TB_Consiliado", "Consiliado", "consiliado")),
      clienteId: clienteCod != null ? clienteByCodigo.get(String(clienteCod))?.id ?? null : null,
      fornecedorId:
        fornecedorCod != null ? fornecedorByCodigo.get(String(fornecedorCod))?.id ?? null : null,
    };
  });
}

export function buildSyncPayload(raw) {
  const contas = mapContasRows(raw.contas || []);
  const planoContas = mapPlanoRows(raw.plano || []);
  const clientes = mapClientesRows(raw.clientes || []);
  const fornecedores = mapFornecedoresRows(raw.fornecedores || []);

  const contaByCodigo = new Map(contas.map((c) => [String(c.codigo), c]));
  const planoByCodigo = new Map(planoContas.map((p) => [String(p.codigo), p]));
  const clienteByCodigo = new Map(clientes.map((c) => [String(c.codigo), c]));
  const fornecedorByCodigo = new Map(fornecedores.map((f) => [String(f.codigo), f]));

  const lancamentos = mapLancamentosRows(raw.lancamentos || [], {
    contaByCodigo,
    planoByCodigo,
    clienteByCodigo,
    fornecedorByCodigo,
  });

  const company = mapCompanyRow(raw.empresa || []);
  const versao = mapVersaoRow(raw.versao || []);

  const payload = {};
  if (contas.length) payload.contas = contas;
  if (planoContas.length) payload.planoContas = planoContas;
  if (clientes.length) payload.clientes = clientes;
  if (fornecedores.length) payload.fornecedores = fornecedores;
  if (lancamentos.length) payload.lancamentos = lancamentos;
  if (company) payload.company = company;
  if (versao?.versaoBanco) payload.versaoBanco = versao.versaoBanco;
  if (versao?.dataFechamento || company?.dataFechamento) {
    payload.dataFechamento = versao?.dataFechamento || company?.dataFechamento;
  }

  payload.meta = {
    tabelas: {
      lancamentos: (raw.lancamentos || []).length,
      contas: contas.length,
      plano: planoContas.length,
      clientes: clientes.length,
      fornecedores: fornecedores.length,
      empresa: (raw.empresa || []).length,
      versao: (raw.versao || []).length,
    },
  };

  return payload;
}
