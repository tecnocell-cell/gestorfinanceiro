# Retomada — Fluxiva Product Redefinição

> Arquivo de orientação para continuar o trabalho após `git pull`.
> Atualizado em: 2026-06-13 (FASE C concluída)

---

## Estado atual do branch

Mudanças da FASE C implementadas, mas **NÃO commitadas nem pushadas** (por instrução).
Pronto para revisão e commit quando autorizado.

---

## O que foi implementado (FASE A + B — já commitado)

### FASE A — Unificação Comercial (COMPLETA)
- Removido toggle PF/PJ do cadastro
- Badge PF/PJ removido do topbar
- Slugs legados mapeados para nomes Fluxiva na UI

### FASE B — WhatsApp Unificado (COMPLETA)
- Bot pergunta em qual ambiente registrar se usuário tem 2+
- Confirmação final mostra nome do ambiente escolhido

---

## O que foi implementado (FASE C — pendente de commit)

### PARTE 1 — Resíduos PF/PJ eliminados

| Arquivo | Linha | Antes | Depois |
|---|---|---|---|
| `centerflow-frontend/src/components/landing/Hero.tsx` | 29 | "PF ou PJ, direto no WhatsApp." | "Para você e sua empresa, direto no WhatsApp." |
| `centerflow-frontend/src/components/landing/Hero.tsx` | 64 | "PF & PJ" | "Pessoal & Empresa" |
| `centerflow-frontend/src/components/landing/Hero.tsx` | 107 | "Alimentação PJ · R$ 78,00" | "Alimentação Empresa · R$ 78,00" |
| `centerflow-frontend/src/components/landing/Features.tsx` | 17 | "Financeiro PF" | "Finanças Pessoais" |
| `centerflow-frontend/src/components/landing/Features.tsx` | 18 | "Financeiro PJ" | "Financeiro Empresarial" |
| `centerflow-frontend/src/components/landing/Footer.tsx` | 42 | "PF, PJ e IA" | "Pessoal, empresa e IA" |
| `centerflow-frontend/src/components/landing/FAQ.tsx` | 22 | "PF e PJ no mesmo plano?" | "Posso gerenciar pessoal e empresa no mesmo lugar?" |
| `centerflow-frontend/src/components/landing/ProductShowcase.tsx` | 149 | badge "PF" | badge "Pessoal" |
| `centerflow-frontend/src/components/landing-spa/Hero.tsx` | 30,65,107 | mesmos que landing/Hero.tsx | idem |

### PARTE 2 — Landing Pages (COMPLETA)
- `centerflow-frontend/src/lib/commercialPlans.ts`: adicionados `FLUXIVA_PLANS` (3 planos unificados). Nomes renomeados de "PF Básico"/"PJ Start" para "Fluxiva Start/Pro/Business". PF_COMMERCIAL_PLANS/PJ_COMMERCIAL_PLANS mantidos para retrocompat.
- `centerflow-frontend/src/components/landing/Plans.tsx`: tabs PF/PJ **removidas**, exibe `FLUXIVA_PLANS` diretamente.
- `centerflow-frontend/src/components/landing-spa/Plans.tsx`: idem.
- `centerflow-frontend/src/data/planCatalog.ts`: nomes atualizados (Fluxiva Start/Pro/Business).

### PARTE 5 — WhatsApp (2 BUGS CRÍTICOS CORRIGIDOS)

**Bug 1 — Menu não lia opção "3" (ou mais):**
- `server/routes/whatsapp.js` — no step `escolher_ambiente`, o "3" estava fixo no array de cancelamento. Se o usuário tivesse 3 ambientes e digitasse 3, cancelava em vez de selecionar o terceiro.
- **Correção**: número é parseado PRIMEIRO; só depois checa palavras-chave de cancelamento.

**Bug 2 — Lançamento ignorava ambiente escolhido:**
- `server/whatsapp/financePending.js` — `confirmPendingLancamento` usava sempre `dados.ambienteAtualId` do servidor, ignorando o `ambienteId` escolhido pelo usuário no fluxo WhatsApp.
- **Correção**: função agora verifica `pending.payload.ambienteId` e usa esse índice de empresa se disponível. `porAmbiente` também é atualizado com a chave correta.

---

## Auditoria Multiambiente — resultado por módulo

| Módulo | Lê de | Salva em | Isolado? | Risco |
|---|---|---|---|---|
| Dashboard | `empresa` (via `getEmpresaAtiva`) | — | ✅ SIM | Nenhum |
| Lançamentos | `empresa.lancamentos` | `empresa.lancamentos` | ✅ SIM | Nenhum |
| Contas | `empresa.contas` | `empresa.contas` | ✅ SIM | Nenhum |
| Cartões | `empresa.contas` (tipo Cartão) | idem | ✅ SIM | Nenhum |
| Clientes | `empresa.clientes` | `empresa.clientes` | ✅ SIM | Nenhum |
| Fornecedores | `empresa.fornecedores` | `empresa.fornecedores` | ✅ SIM | Nenhum |
| DRE | `empresa.lancamentos + planoContas` | — | ✅ SIM | Nenhum |
| Relatórios | `empresa.lancamentos` | — | ✅ SIM | Nenhum |
| Fluxo de Caixa | `empresa.lancamentos` | — | ✅ SIM | Nenhum |
| Centro de Custos | `empresa.centroCustos + lancamentos` | idem | ✅ SIM | Nenhum |
| Projetos | `empresa.projetos` | `empresa.projetos` | ✅ SIM | Nenhum |
| Metas | `empresa.metas` | `empresa.metas` | ✅ SIM | Nenhum |
| CRM | n/a (sem módulo dedicado) | — | — | — |
| Agenda | n/a (sem módulo dedicado) | — | — | — |
| WhatsApp | `dados.ambienteAtualId` → empresa | `empresas[idx]` | ✅ SIM (corrigido) | Corrigido FASE C |

**`getEmpresaAtiva(state)`** resolve para `empresas[ambienteAtualId || empresaAtivaId]` — toda leitura/escrita passa por essa função, garantindo isolamento automático ao trocar ambiente.

**`porAmbiente`** é sincronizado nos saves do frontend e no WhatsApp backend, mantendo snapshot por ambiente.

---

## Riscos restantes para produção

### 🔴 Críticos (bloqueadores)
- Nenhum após FASE C.

### 🟡 Médios (resolver antes do lançamento)

1. **`billing/subscriptions.js` linha ~203 — `simularUpgrade`**
   - Ainda valida `planoMatchesTipoPerfil` que pode bloquear upgrade de pf_ → pj_ se o `tipo_perfil` do usuário for "fisica"
   - Avaliar: remover a validação ou adaptar para ignorar segmento no contexto multiambiente

2. **`IntegracaoPfPjPage.jsx`** — página inteira usa linguagem "Pessoa Física"/"Pessoa Jurídica"
   - É uma feature de repasse PJ→PF. Com multiambiente, pode ser reposicionada como "Repasse entre ambientes"
   - Por instrução não foi tocada — marcar para redesign futuro

3. **`PriceSimulator.tsx`** — usa `type: "PF" | "PJ"` internamente para calcular preços por usuário/número
   - Funcional mas exposição interna ainda usa segmento PF/PJ
   - Não visível diretamente ao usuário final

4. **`AdminGoLiveSection.jsx` + `AdminUserModals.jsx`** — usam "Pessoa Física/Jurídica"
   - Interno admin — não visível ao usuário final. Baixa prioridade.

5. **Clientes/Fornecedores — campo "Tipo"** (`Modals.jsx:942-943`)
   - Select com "Pessoa Física (PF)" / "Pessoa Jurídica (PJ)" ainda aparece no modal de cadastro de cliente/fornecedor
   - É um campo de documento (CPF vs CNPJ) — faz sentido manter, mas pode ser renomeado para "Pessoa / Empresa"

### 🟢 Baixos (pós-lançamento)
- Visão consolidada de saldos entre ambientes (instrução: "não implementar ainda")
- `billing routes.js` linhas 150/190: mensagem de erro ainda menciona "pf_plus, pj_pro" nos exemplos
- `server/whatsapp/routes.js:1481` — comentário interno `"Helpers PF (Pessoa Fisica)"` — sem impacto funcional

---

## O que NÃO foi tocado (por instrução explícita)

- Migrations — não alteradas
- Billing interno (Asaas, Mercado Pago, webhooks, planRules) — não alterado
- Slugs `pf_basico`, `pf_plus`, etc. — existem no banco, apenas mapeados visualmente
- `mergeAmbienteIntoStored`, `normalizeStateForUser` — não alterados
- Isolamento real (`porAmbiente`) — não alterado (só corrigido o uso no WhatsApp)

---

## Como retomar

```bash
git pull origin main
npm install
npm run dev:all
```

### Teste manual pós-FASE C

1. **Landing page** — deve exibir "Fluxiva Start / Fluxiva Pro / Fluxiva Business" sem tabs PF/PJ
2. **WhatsApp — 1 ambiente** — não deve perguntar ambiente, vai direto para confirmação
3. **WhatsApp — 2+ ambientes** — deve perguntar "Em qual financeiro deseja registrar?"
4. **WhatsApp — opção 3** — com 3 ambientes, digitar "3" deve selecionar o terceiro (não cancelar)
5. **WhatsApp — confirmação** — "Lançado em: 🏠 Pessoal" ou "🏢 Nome da Empresa" conforme escolhido
6. **Trocar ambiente no menu** — Dashboard, saldo, clientes, DRE devem mudar

---

## Comandos úteis

```bash
node server/test_fase2_isolamento.mjs   # 25 testes de isolamento
node server/test_pf_pj_completo.mjs    # testes multiambiente completo
git diff --stat                         # ver o que mudou na FASE C
```
