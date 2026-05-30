# FLUXO FINANCEIRO — CenterFlow Financeiro
> Documentação do módulo financeiro: contas, categorias, caixa, lançamentos, DRE, relatórios e regras de negócio.

---

## 1. Arquitetura do Estado Financeiro

Todo o estado financeiro de um tenant é armazenado como **um único objeto JSONB** na tabela `estados`:

```
estados.dados (JSONB)
├── empresas[]          ← PJ: dados da empresa (nomeFantasia, razaoSocial, cnpj...)
├── pessoa              ← PF: dados pessoais (nome, cpf...)
├── contas[]            ← Contas bancárias/caixa
├── lancamentos[]       ← Todos os lançamentos financeiros
├── planoContas[]       ← Plano de contas / categorias (PJ)
├── categoriasPF[]      ← Categorias pessoais (PF)
├── clientes[]          ← Cadastro de clientes (PJ)
├── fornecedores[]      ← Cadastro de fornecedores (PJ)
├── fechamentos[]       ← Histórico de fechamentos de período
├── orcamento[]         ← Orçamento por categoria (PF)
├── metas[]             ← Metas financeiras (PF)
└── ...
```

**Arquivo de lógica:** `src/gestor/finance.js`  
**Arquivo de persistência frontend:** `src/gestor/persistence.js`  
**API de estado:** `GET /api/state`, `PUT /api/state`

---

## 2. Contas

### Estrutura de uma conta (no JSONB `contas[]`)
```javascript
{
  id: "uuid-gerado-frontend",
  codigo: 1,                    // código numérico sequencial
  nome: "Banco do Brasil",
  apelido: "BB Conta Principal", // nome amigável
  tipo: "Banco",                // "Banco" | "Caixa"
  saldoInicial: 1000.00,        // saldo de abertura
  contaContabil: "1.1.1",       // para exportação contábil
  inativo: false                // true = oculta de filtros
}
```

### Tela de Contas (`ContasPage`)
- **Arquivo:** `src/gestor/pages/Pages.jsx`
- Lista todas as contas com saldo atual calculado
- Ordena por: código, nome, tipo ou saldo
- Exibe saldo total (soma de todas as contas ativas)
- CRUD via `contaCrud` (modal `ModalConta`)

### Cálculo de Saldo
O saldo atual de uma conta é calculado no frontend:
```javascript
// finance.js
getSaldoConta(contaId) = conta.saldoInicial
  + soma(entradas onde contaEntradaId === contaId)
  - soma(saídas onde contaSaidaId === contaId)
```

Para `Transferencia`: deduz da conta de saída e credita na conta de entrada.

---

## 3. Plano de Contas / Categorias (PJ)

### Estrutura de um item do plano (`planoContas[]`)
```javascript
{
  id: "uuid",
  codigo: "4.1.1",
  descricao: "Aluguel",
  tipo: "Despesa",       // "Receita" | "Custo" | "Despesa" | "Imposto"
  natureza: "D",         // Débito/Crédito (opcional)
  classificacao: "...",  // descrição de classificação
  icone: "🏠",           // emoji (opcional)
  cor: "#ff5733",        // cor hex (opcional)
  inativo: false
}
```

### Tipos de plano de contas
| Tipo | DRE | Cor |
|---|---|---|
| Receita | (+) Receitas | verde |
| Custo | (-) Custos (CMV) | vermelho |
| Despesa | (-) Despesas operacionais | âmbar |
| Imposto | (-) Impostos | roxo |

### Tela Plano de Contas (`PlanoContasPage`)
- **Arquivo:** `src/gestor/pages/Pages.jsx`
- Botão "Sugestões": importa `DEFAULT_CATS_PJ` (`src/gestor/defaultCategories.js`) sem duplicar

---

## 4. Lançamentos

### Tipos de lançamento
| Tipo | Descrição |
|---|---|
| `Entrada` | Receita — credita em `contaEntradaId` |
| `Saida` | Despesa — debita de `contaSaidaId` |
| `Transferencia` | Move entre contas — debita `contaSaidaId` + credita `contaEntradaId` |

### Estrutura de um lançamento (`lancamentos[]`)
```javascript
{
  id: "uuid",
  codigo: 1,                    // sequencial único
  lote: "2024-001",             // número de lote para importações
  data: "2024-01-15",           // ISO date string
  tipo: "Entrada",              // "Entrada" | "Saida" | "Transferencia"
  valor: 1500.00,
  contaEntradaId: "uuid",       // ID da conta de crédito
  contaSaidaId: "uuid",         // ID da conta de débito
  codigoOrigem: "1",            // código da conta de saída (importações OFX)
  codigoDestino: "2",           // código da conta de entrada
  planoId: "uuid",              // ID do planoContas[] (categoria)
  clienteId: "uuid",            // ID de clientes[] (opcional)
  historico: "Aluguel Jan/24",  // descrição do lançamento
  observacao: "",
  exportado: false,             // marcado após exportar para Domínio
  consiliado: false,            // marcado na conciliação bancária
  pago: false,                  // usado em ContasAPagarPage
  vencimento: "2024-01-20",     // data de vencimento (opcional, ContasAPagarPage)
  status: "pendente"            // "pendente" | "pago" (opcional)
}
```

### Tela de Lançamentos (`LancamentosPage`)
- **Arquivo:** `src/gestor/pages/Pages.jsx`
- Filtros: período (ano/mês), tipo, conciliação, conta
- Busca por texto no histórico
- Coluna saldo (calculada ao filtrar por conta)
- Saldo anterior ao período exibido quando filtra por conta
- CRUD via `lancCrud` (modal `ModalLancamento`)

---

## 5. Contas a Pagar / Receber (`ContasAPagarPage`)

**Arquivo:** `src/gestor/pages/ContasAPagarPage.jsx`

- Filtra lançamentos de tipo `Entrada` (a receber) e `Saida` (a pagar)
- Campo `vencimento`: fallback para `l.data` se não preenchido
- Campo `status`: `"pendente"` | `"pago"` — fallback `"pago"` para lançamentos antigos sem status
- Campo `"atrasado"`: **calculado no frontend** — `status !== "pago"` AND `vencimento < hoje`
- Edição inline de data de vencimento
- Botão "Marcar como Pago" usa `lancCrud.update()`
- Filtros: status (pendente/pago/atrasado), tipo (a pagar/receber), período

---

## 6. Recorrências (Despesas e Receitas Fixas)

**Arquivo servidor:** `server/routes/recorrencias.js`  
**Arquivo frontend:** `src/gestor/pages/RecorrenciasPage.jsx`  
**Hook:** `src/gestor/hooks/useRecorrencias.js`  
**Tabela:** `recorrencias` (PostgreSQL — não é JSONB)

### Periodicidades suportadas
- `mensal` — avança 1 mês
- `semanal` — avança 7 dias
- `anual` — avança 1 ano

### Fluxo de uso
1. Usuário cria recorrência (POST `/api/recorrencias`)
2. Sistema alerta quando `proxima_data` chegar (componente `RecorrenciaAlert`)
3. Usuário clica "Gerar" → POST `/api/recorrencias/:id/gerar`
4. Backend avança `proxima_data` para o próximo ciclo
5. **Frontend cria o lançamento real** via `lancCrud` no JSONB

> O backend **não cria** o lançamento. Apenas avança a data. O lançamento é criado pelo frontend.

### Alert de recorrências (`RecorrenciaAlert`)
**Arquivo:** `src/gestor/components/RecorrenciaAlert.jsx`

Exibe aviso quando existem recorrências vencidas ou a vencer nos próximos 7 dias.

---

## 7. DRE — Demonstrativo de Resultado do Exercício

**Tela:** `DREPage` — `src/gestor/pages/Pages.jsx`

### Fórmulas do DRE
```
Receitas            = soma entradas vinculadas a planoContas tipo "Receita"
(-) Custos          = soma saídas vinculadas a planoContas tipo "Custo"
= Lucro Bruto       = Receitas - Custos
(-) Despesas        = soma saídas vinculadas a planoContas tipo "Despesa"
= LAIR              = Lucro Bruto - Despesas
(-) Impostos        = soma saídas vinculadas a planoContas tipo "Imposto"
= Lucro Líquido     = LAIR - Impostos
```

### Modos de visualização
1. **Por Período:** mês/ano selecionável + gráfico de evolução anual
2. **Intervalo Livre:** range de datas personalizado
3. **Comparativo:** dois períodos lado a lado com variação e %

### Consulta DRE (estilo Excel)
Tabela com colunas: Código, Classificação, Conta Financeira, Saldo Anterior, Entradas, Saídas, Saldo Atual.

---

## 8. Relatórios

**Tela:** `RelatoriosPage` — `src/gestor/pages/Pages.jsx`

### Fluxo de Caixa
- Lista de lançamentos ordenados por data com saldo acumulado
- Filtros: conta, tipo de lançamento
- Exportação CSV: `fluxo_{ano}.csv`

### Resumo Mensal
- Tabela com: Mês, Receita, Custo, Despesas, Impostos, Lucro, Margem %
- Exportação CSV: `mensal_{ano}.csv`

---

## 9. Balancete

**Tela:** `BalancetePage` — `src/gestor/pages/Pages.jsx`

- Lista todas as contas com débito, crédito e saldo
- Filtrado por período (ano/mês)
- Totais no rodapé

---

## 10. Fechamento de Período

**Tela:** `FechamentoPage` — `src/gestor/pages/Pages.jsx`

### O que o fechamento faz
- Registra um **snapshot imutável** do período (DRE + saldos de contas + contagem de lançamentos)
- **Não bloqueia** novos lançamentos no período fechado
- Armazenado no JSONB `fechamentos[]`

### Estrutura de um fechamento (`fechamentos[]`)
```javascript
{
  id: "uuid",
  periodo: "2024-01",           // YYYY-MM
  dataFechamento: "2024-01-31",
  observacao: "Referência Jan",
  lancamentosCount: 45,
  saldosContas: { "uuid-conta": 15000.00, ... },
  dreSnapshot: {
    receitas, custos, despesas, impostos,
    lucroBruto, lucroLiquido, lucroAposImpostos
  }
}
```

---

## 11. Conciliação Bancária

**Tela:** `ConciliacaoPage` — `src/gestor/pages/Pages.jsx`

- Lista lançamentos com `consiliado = false`
- Botão "Marcar conciliado" altera o campo no JSONB
- Exibe contador de pendentes

---

## 12. Importações e Exportações

**Tela:** `ImportacoesPage` — `src/gestor/pages/Pages.jsx`  
**Arquivo:** `src/gestor/importExport.js`

### Formatos de importação
| Formato | Parser | Biblioteca |
|---|---|---|
| OFX (extrato bancário) | `parseOFX()` | Manual |
| Mercado Pago CSV | `parseMercadoPagoCSV()` | Manual |
| XLSX | `parseXlsxFile()` | `xlsx` |
| JSON (backup CenterFlow) | `importJSONFile()` | Manual |

### Formatos de exportação
| Formato | Função | Destino |
|---|---|---|
| Domínio TXT | `exportDominio()` | Contabilidade (sistema Domínio Sistemas) |
| JSON | `exportJSON()` | Backup completo do estado |
| CSV Fluxo | `exportRelatorioCSV()` | Relatório de fluxo de caixa |
| CSV Mensal | `exportRelatorioCSV()` | Resumo mensal |

### Exportação Domínio
- Formato: `DATA|LOTE|TIPO|CONTA|PLANO|VALOR|HISTORICO|EXPORTADO`
- Header com: empresa, CNPJ, código Domínio, período, data de geração
- Após exportar, marca lançamentos com `exportado = true` no JSONB
- Filtro por `dominioFrom` e `dominioTo` (opcional)
- Sem datas: exporta todos os pendentes (`exportado = false`)

---

## 13. Impostos

**Tela:** `ImpostosPage` — `src/gestor/pages/Pages.jsx`

- Exibe contas do `planoContas` com `tipo = "Imposto"`
- KPIs: total de impostos no período, LAIR, Lucro Líquido
- Instrução: lançamentos de saída vinculados a conta tipo "Imposto" geram LAIR e Lucro Líquido

---

## 14. Dados da Empresa (PJ)

**Tela:** `EmpresaPage` — `src/gestor/pages/Pages.jsx`

Campos editáveis no JSONB `empresas[0]`:
- `nomeFantasia`, `razaoSocial`, `cnpj`, `inscricaoEstadual`
- `codigoDominio` (número para exportação contábil)
- `dataFechamento`

---

## 15. Regras Financeiras Importantes

1. **Transferências** não impactam o DRE. Só movem saldo entre contas.
2. **Lançamentos sem `planoId`** não aparecem no DRE por categoria, mas afetam os totais.
3. **Conta inativa** (`inativo = true`) é excluída do filtro padrão, mas lançamentos existentes permanecem.
4. **Saldo anterior** ao período é calculado no frontend ao filtrar por conta (não persiste).
5. **`lucroAposImpostos`** = LAIR - Impostos. Se não há impostos cadastrados, é igual a `lucroLiquido`.
6. **Exportação Domínio** usa `contaContabil` da conta (não o ID). Se vazio, usa `codigo`.
7. **JSONB**: o estado inteiro é salvo/carregado em uma única operação. Não há queries de lançamento individual.
8. **Geração de IDs**: feita no frontend (`generateId()` de `src/gestor/finance.js`).
9. **`nextLote()`**: lote de importação = string `${ano}-${seq:03d}` baseado no maior lote existente.

---

## 16. Módulo PF — Diferenças

**Arquivos:** `src/gestor/pages/PagesPF.jsx`, `src/gestor/pfDueDates.js`, `src/gestor/pfHints.js`

| Módulo | PJ | PF |
|---|---|---|
| Plano de contas | `planoContas[]` | `categoriasPF[]` |
| DRE | ✅ | ❌ |
| Balancete | ✅ | ❌ |
| Fechamento | ✅ | ❌ |
| Clientes/Fornecedores | ✅ | ❌ |
| Impostos | ✅ | ❌ |
| Orçamento | ❌ | ✅ `OrcamentoPage` |
| Metas | ❌ | ✅ `MetasPage` |
| Perfil PF | ❌ | ✅ `PerfilPFPage` |
| Alertas de vencimento PF | ❌ | ✅ `PfDueAlert` |
| Dicas financeiras PF | ❌ | ✅ `pfHints.js` |
