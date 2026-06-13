# Retomada — Fluxiva Product Redefinição

> Arquivo de orientação para continuar o trabalho após `git pull`.
> Atualizado em: 2026-06-13

---

## Estado atual do branch

Todas as mudanças foram commitadas e pushadas para `origin/main`.
Nenhuma pendência de código neste branch.

---

## O que foi implementado (esta sessão)

### FASE A — Unificação Comercial (COMPLETA)

| Arquivo | O que mudou |
|---|---|
| `src/gestor/pages/RegisterPage.jsx` | Removido toggle "Tipo de conta" (PF/PJ). Todos os cadastros enviam `tipo_perfil: "fisica"` fixo. Label do campo mudou para "Nome do perfil". |
| `src/gestor/GestorApp.jsx` | Removido badge "Pessoa Física"/"Pessoa Jurídica" do topbar. Sidebar footer agora mostra `ambienteAtivo.nome` em vez de "PF"/"PJ". |
| `src/gestor/pages/PlanoAssinaturaPage.jsx` | `segmentoLabel` derivado de `tipo` (ambiente ativo) em vez de `user?.tipo_perfil`. Slugs legados mapeados para nomes Fluxiva em todos os pontos de exibição. |
| `src/gestor/planBillingUi.js` | Adicionados `PLAN_DISPLAY_NAMES`, `planDisplayName()` e badges para `fluxiva_start`, `fluxiva_pro`, `fluxiva_business`. |
| `server/whatsapp/leadFlow.js` | "Planos para Pessoa Física e Jurídica" → "Planos para finanças pessoais, MEI e empresas" |

### Timer Race Bug Fix (também nesta sessão, commitado junto)

| Arquivo | O que mudou |
|---|---|
| `src/gestor/components/AmbienteSelector.jsx` | Flush-first antes de trocar ambiente. Sem `setState` intermediário. Evita timer race que corromperia `porAmbiente`. |
| `server/index.js` | GET /api/state: detecção e reparo de corrupção PF→PJ. PUT: guard 409 se dados PF tentam ser salvos em slot empresa. |

### FASE B — WhatsApp Unificado (COMPLETA)

| Arquivo | O que mudou |
|---|---|
| `server/whatsapp/financePending.js` | `getEmpresaDados` usa `ambienteAtualId` (não mais `empresaAtivaId`). Adicionados: `getAmbientesDoUsuario`, `buildAmbienteSelectorMsg`, `buildAmbienteConfirmadoMsg`. |
| `server/routes/whatsapp.js` | `handleNewLancamento`: se usuário tem >1 ambiente, insere step `"escolher_ambiente"`. `handlePendingFlow`: handler para `step === "escolher_ambiente"`. Confirmação final inclui nome do ambiente. |

---

## Fluxo WhatsApp novo (resumo)

**1 ambiente:**
```
user: paguei 80 mercado
bot:  [confirmação normal]
user: 1
bot:  ✅ Lançamento salvo!  Lançado em: 🏠 Pessoal
```

**2+ ambientes:**
```
user: paguei 80 mercado
bot:  🏦 Em qual financeiro deseja registrar?
        1. 🏠 Pessoal
        2. 🏢 Center Tech
user: 2
bot:  [confirmação normal]
user: 1
bot:  ✅ Lançamento salvo!  Lançado em: 🏢 Center Tech
```

---

## O que NÃO foi tocado (por instrução explícita)

- `mergeAmbienteIntoStored` — não alterado
- `normalizeStateForUser` — não alterado
- Migrations — não alteradas
- Billing interno (Asaas, Mercado Pago, webhooks) — não alterado
- Slugs `pf_basico`, `pf_plus`, `pf_premium`, `pj_start`, `pj_pro`, `pj_business` — existem no banco, apenas mapeados visualmente no frontend
- `LEGACY_PLAN_MAP` — não alterado, funciona normalmente
- PIX — não alterado
- Isolamento multiambiente (`porAmbiente`) — não alterado

---

## Pendências / próximos passos

### Visão consolidada (não iniciado)
- Exibir saldo somado de todos os ambientes no dashboard
- Instrução: "Não implementar visão consolidada ainda"

### landing-spa / centerflow-frontend
- Remoção de tabs PF/PJ nas landing pages externas ainda não feita
- Arquivos: `centerflow-frontend/src/components/landing/Plans.tsx` e `landing-spa/Plans.tsx`

### billing/subscriptions.js — `simularUpgrade` (linha 203)
- Ainda valida `planoMatchesTipoPerfil` que pode bloquear upgrade cruzado PF→PJ
- Texto de erro: "Este plano não está disponível para o seu tipo de perfil (PF/PJ)."
- Avaliar se remove ou adapta quando o billing for unificado

### billingService.js — erro PF/PJ exposto ao usuário
- `routes.js` linha 150/190: mensagem de erro com `pf_plus, pj_pro` nos exemplos

---

## Como retomar

```bash
git pull origin main
npm install         # se houver novos pacotes
npm run dev:all     # servidor + frontend
```

Testar manualmente:
1. Cadastro novo — não deve aparecer toggle PF/PJ
2. Sidebar/topbar — deve mostrar nome do ambiente, sem badge PF/PJ
3. Plano & Assinatura — deve mostrar "Fluxiva Start/Pro/Business", não slugs
4. WhatsApp com 2 ambientes — deve perguntar em qual registrar

---

## Comandos úteis

```bash
# Build de produção
npm run build

# Teste de isolamento multiambiente (25 testes)
node server/test_fase2_isolamento.mjs

# Ver o que está pendente de push
git status
git log --oneline -5
```
