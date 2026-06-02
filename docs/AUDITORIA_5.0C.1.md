# Auditoria 5.0C.1 — Integração PF/PJ (vínculo + pró-labore)

**Data:** 2026-06-02  
**Escopo:** Validação antes de salário, lucros ou transferências.  
**Sem novas funcionalidades** nesta etapa.

---

## Resultado geral

| Área | Status |
|------|--------|
| Vínculo × pró-labore | OK |
| Pró-labore bilateral | OK |
| Rollback | OK |
| Segurança (perfil + isolamento PJ) | OK |
| Transação SQL + FOR UPDATE | OK (revisão de código) |
| UI | OK com melhorias cosméticas opcionais |
| Testes `npm run test:50c` | Ampliados e passando |

**Conclusão:** Base **sólida** para evoluir para 5.0D (novos tipos de operação).

---

## 1. Vínculo

| Cenário | Esperado | Resultado |
|---------|----------|-----------|
| PJ sem vínculo → preview/confirmar | 422 | OK |
| Vínculo `pendente` → pró-labore | 422 | OK |
| Vínculo `ativo` → pró-labore | 200/201 | OK |
| Vínculo `revogado` → pró-labore | 422 | OK |

**Implementação:** `findVinculoAtivoConfirmado` exige `status = 'ativo'` em preview e confirmar.

---

## 2. Pró-labore

| Critério | Resultado |
|----------|-----------|
| PJ `Saida` | OK |
| PF `Entrada` | OK |
| Valores iguais | OK |
| Datas iguais | OK |
| Históricos distintos e coerentes | OK (`Pró-labore — {PF}` / `recebido — {PJ}`) |
| `source: integracao_pf_pj` | OK |
| `tipoOperacao: pro_labore` (root + `integracaoPfPj`) | OK |
| `integracaoPfPj.lancamentoParId` cruzado | OK |
| `integracaoPfPj.operacaoId` = id da operação SQL | OK |

**Writer:** `server/integracaoPfPj/proLaboreWriter.js`

---

## 3. Rollback

| Critério | Resultado |
|----------|-----------|
| Remove lançamento PJ | OK (`source === integracao_pf_pj` + id) |
| Remove lançamento PF | OK |
| `integracao_pf_pj_operacoes.status` → `rollback` | OK |
| Segundo rollback | 409 OK |
| Não remove outros lançamentos | OK (filtro por id + source) |

---

## 4. Concorrência e segurança

| Critério | Resultado |
|----------|-----------|
| `BEGIN` / `COMMIT` / `ROLLBACK` em confirmar e rollback | OK |
| `FOR UPDATE` no vínculo ativo (confirmar) | OK |
| `FOR UPDATE` nos dois `estados` (ordem UUID) | OK |
| PJ A não acessa operação da PJ B | 404 OK |
| PF não faz preview/confirmar/listar/rollback | 403 OK |

**Limitação conhecida:** testes automatizados não simulam duas requisições paralelas; revisão estática da transação considerada suficiente para 5.0C.1.

---

## 5. UI (`IntegracaoPfPjPage.jsx`)

| Critério | Resultado |
|----------|-----------|
| Abas Pró-labore/Histórico só com `vinculo.status === 'ativo'` | OK |
| Mensagem pendente na aba Vínculo | OK |
| Mensagem na aba Pró-labore se não ativo | OK |
| Histórico lista operações | OK |
| Após confirmar → aba Histórico + `reloadAppState` | OK |
| Após rollback → `loadOperacoes` + `reloadAppState` | OK |

### Melhorias opcionais (não bloqueantes)

1. Tooltip ou texto quando abas Pró-labore/Histórico estão desabilitadas (pendente).
2. Exibir status `rollback` no histórico com estilo já existente (`badge-cp-atrasado`).

---

## 6. Testes automatizados

**Arquivo:** `server/test50c.js` (ampliado na 5.0C.1)

Cobertura adicionada:
- Sem vínculo, pendente, ativo, revogado
- Paridade PJ/PF (valor, data, metadados, `lancamentoParId`)
- Rollback + segundo rollback + lançamento manual preservado
- Isolamento PJ2, bloqueio PF

**Comando:** `npm run test:50c` (API em `PORT=3001`)

---

## Problemas encontrados

Nenhum bug crítico. Nenhuma correção de código obrigatória nesta auditoria.

---

## Correções necessárias (antes de 5.0D)

| Prioridade | Item |
|------------|------|
| Baixa | UX: explicar abas desabilitadas quando vínculo pendente |
| Média (5.0D) | Extrair `operacaoWriter` genérico a partir de `proLaboreWriter` para salário/lucros |
| Média (5.0D) | Teste de concorrência (opcional) com duas requisições paralelas |
| Baixa | Idempotency-Key em POST `/pro-labore` (anti double-click) |

---

## Checklist manual recomendado (smoke)

1. Login PJ → Integração PF/PJ → vincular PF → aceitar na PF.
2. Pró-labore 3000 → preview → confirmar.
3. Lançamentos PJ/PF com `source integracao_pf_pj`.
4. Histórico → Desfazer → lançamentos sumem nos dois lados.
5. Tentar pró-labore após revogar vínculo → bloqueado.

---

## Arquivos auditados

- `server/routes/integracaoPfPj.js`
- `server/integracaoPfPj/proLaboreWriter.js`
- `server/migrations/017_*.sql`, `018_*.sql`
- `src/gestor/pages/IntegracaoPfPjPage.jsx`
- `src/gestor/api.js`
- `server/test50c.js`
