# FLUXO CLIENTES E FORNECEDORES — CenterFlow Financeiro
> Documentação do cadastro de clientes, fornecedores e sua integração com o módulo financeiro.

---

## 1. Visão Geral

Clientes e fornecedores são cadastros auxiliares do módulo PJ (Pessoa Jurídica) armazenados no JSONB do tenant. Eles são vinculados a lançamentos financeiros para rastreabilidade e relatórios.

> **Nota:** Este módulo existe apenas no perfil **PJ**. O perfil **PF** não possui clientes nem fornecedores.

---

## 2. Armazenamento

Ambos os cadastros ficam no JSONB da tabela `estados`:

```javascript
estados.dados = {
  // ... outros dados
  clientes: [
    { id, codigo, nome, apelido, documento, cidade, telefone, email, ... }
  ],
  fornecedores: [
    { id, codigo, nome, apelido, documento, cidade, telefone, email, ... }
  ]
}
```

Não há tabelas SQL separadas para clientes e fornecedores.

---

## 3. Estrutura de um Cliente/Fornecedor

```javascript
{
  id: "uuid-gerado-frontend",    // gerado por generateId() no frontend
  codigo: 1,                     // código sequencial numérico
  nome: "Empresa ABC Ltda",      // nome completo (obrigatório)
  apelido: "ABC",                // nome curto/fantasia
  documento: "12.345.678/0001-90", // CNPJ ou CPF (texto livre)
  cidade: "São Paulo",
  telefone: "(11) 99999-9999",
  email: "contato@empresa.com"
  // campos opcionais adicionais podem existir no JSONB
}
```

---

## 4. Telas de Cadastro

### ClientesPage
**Arquivo:** `src/gestor/pages/Pages.jsx`  
**Componente:** usa `CadastroTable` (componente interno compartilhado com FornecedoresPage)

- Lista clientes com: Cód., Nome, Apelido, Documento, Cidade, Telefone, E-mail
- Botão "+ Novo Cliente" → abre `ModalCliente`
- Editar → abre `ModalCliente` com dados preenchidos
- Excluir → `clienteCrud.remove(id)` (com confirmação)

### FornecedoresPage
**Arquivo:** `src/gestor/pages/Pages.jsx`  
**Componente:** usa o mesmo `CadastroTable`

- Mesma estrutura de colunas que Clientes
- Botão "+ Novo Fornecedor" → abre `ModalFornecedor`
- CRUD via `fornecedorCrud`

---

## 5. Modais

### ModalCliente
**Arquivo:** `src/gestor/components/Modals.jsx`

Campos do formulário:
- Nome* (obrigatório)
- Apelido
- Documento (CNPJ/CPF)
- Cidade
- Telefone
- E-mail

### ModalFornecedor
**Arquivo:** `src/gestor/components/Modals.jsx`

Mesma estrutura do ModalCliente.

---

## 6. Integração com Lançamentos

O `clienteId` é um campo opcional em lançamentos:

```javascript
// Em lancamentos[]
{
  id: "...",
  clienteId: "uuid-cliente",  // referência ao clientes[].id no JSONB
  // ... outros campos
}
```

Na `LancamentosPage`, o nome do cliente aparece no histórico:
```javascript
// Pages.jsx
const cli = clientes.find((c) => c.id === l.clienteId);
// Exibe: "Aluguel Jan/24 · Plano ABC · Empresa ABC"
```

---

## 7. Busca e Filtros

**Na tela de Lançamentos:**
- Campo de busca (`search`) filtra por texto no histórico (inclui nome do cliente)
- Filtro por conta não filtra por cliente diretamente

**Nas telas de Clientes/Fornecedores:**
- Não há busca implementada na listagem (apenas scroll)
- Ordenação natural pelo código (sequencial)

---

## 8. Histórico e Relacionamento

Não há uma tela dedicada de "histórico por cliente". Para ver todos os lançamentos de um cliente:
1. Ir para **Lançamentos**
2. Usar o campo de busca com o nome do cliente

O vínculo `clienteId → lançamento` é mantido no JSONB e não é excluído automaticamente se o cliente for excluído (o lançamento fica sem referência válida mas não quebra).

---

## 9. CRUD — Implementação

Os CRUDs de clientes e fornecedores são gerenciados pelo `GestorContext`:

```javascript
// src/gestor/GestorContext.jsx
clienteCrud = {
  add:    (item) => setClientes(prev => [...prev, item]),
  update: (id, data) => setClientes(prev => prev.map(c => c.id === id ? {...c, ...data} : c)),
  remove: (id) => setClientes(prev => prev.filter(c => c.id !== id))
}

fornecedorCrud = {
  add:    (item) => ...,
  update: (id, data) => ...,
  remove: (id) => ...
}
```

Após qualquer mutação, o estado completo é enviado para `PUT /api/state` (auto-save).

---

## 10. Integrações com Outros Módulos

| Módulo | Integração |
|---|---|
| Lançamentos | `clienteId` opcional em cada lançamento |
| DRE | Sem filtro por cliente na versão atual |
| Relatórios | Sem relatório por cliente na versão atual |
| Importação OFX | `clienteId` não é populado na importação automática |
| Exportação Domínio | `clienteId` não é exportado no TXT Domínio |
| WhatsApp | `clienteId` planejado para Fase 3+ (não implementado) |

---

## 11. Status e Roadmap

| Feature | Status |
|---|---|
| CRUD de clientes | ✅ Implementado |
| CRUD de fornecedores | ✅ Implementado |
| Vínculo cliente ↔ lançamento | ✅ Implementado |
| Busca por cliente nos lançamentos | ✅ (via campo de texto) |
| Relatório de lançamentos por cliente | 🔲 Roadmap |
| Histórico financeiro por cliente | 🔲 Roadmap |
| Limite de crédito por cliente | 🔲 Roadmap |
| Importação de cadastro (CSV/XLSX) | 🔲 Roadmap |
| Clientes no perfil PF | ❌ Não existe |
