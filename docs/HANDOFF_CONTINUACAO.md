# Handoff — CenterFlow / Gestor Financeiro

> Arquivo para o agente retomar o contexto rapidamente.  
> **Última atualização:** 2026-06-02 (após Etapas 4.7, 5.0B e 5.0C enviadas ao `main`).

---

## Repositório

| Item | Valor |
|------|--------|
| **Path local** | `c:\Users\root\Documents\Projetos\CenterFlow` |
| **GitHub** | `tecnocell-cell/gestorfinanceiro` |
| **Branch** | `main` (sincronizado com `origin/main` na última sessão) |
| **Stack** | React 19 + Vite 8 + Express 5 + PostgreSQL |
| **Estado financeiro** | JSONB em `estados.dados` — **não alterar** `/api/state` |

**Login teste local (se existir):** `admin@gestor.local` / `admin123`  
**API:** `http://localhost:3001` (`.env` → `PORT=3001`, `VITE_API_URL=http://localhost:3001/api`)

---

## Onde paramos

### Concluído e no Git (`main`)

| Commit (ref.) | Etapa | Conteúdo |
|---------------|-------|----------|
| `51a9be8` | **4.7** | Importação CSV/XLSX: preview, mapeamento, confirmação, dedup, rollback (`parseCsv`, `parseXlsx`, `planilhaImport`, rotas, `PlanilhaImportWizard`, `test47.js`) |
| `5966ba3` | **5.0B** | Vínculo único PJ ↔ PF: tabela `integracao_pf_pj_vinculo`, rotas vínculo/aceitar/recusar, UI PJ + card no Perfil PF (`test50.js`) |
| `927f2f9` | **5.0C** | Pró-labore bilateral: tabela `integracao_pf_pj_operacoes`, `proLaboreWriter.js`, abas Pró-labore/Histórico, rollback (`test50c.js`) |

### Não implementado (próximas etapas prováveis)

- Salário, distribuição de lucros, transferência PJ↔PF, aporte
- Recorrência de repasses
- Múltiplas PFs por PJ (escopo **rejeitado** na 5.0 — manter **1 PF por PJ**)
- Papéis sócio/funcionário/prestador (fora do escopo 5.0)
- Open Finance, Pluggy, Belvo
- Edição sincronizada de lançamentos espelhados (só rollback hoje)

### Documentação de planejamento

- `docs/INTEGRACAO_PF_PJ.md` — plano PF/PJ (atualizado com escopo 5.0B)

---

## Arquitetura PF ↔ PJ (resumo)

```
1 usuário (usuarios) = 1 tenant = 1 JSONB (estados)
PF e PJ são contas SEPARADAS (tipo_perfil: fisica | juridica)
```

**Vínculo (SQL):** `integracao_pf_pj_vinculo`  
- `UNIQUE(usuario_pj_id) WHERE status != 'revogado'` → **1 PF ativa/pendente por PJ**  
- Status: `pendente` → PF aceita → `ativo` | `revogado`

**Operações (SQL):** `integracao_pf_pj_operacoes`  
- Pró-labore: writer atômico grava **Saída PJ** + **Entrada PF**  
- `source: "integracao_pf_pj"`, `tipoOperacao: "pro_labore"`, objeto `integracaoPfPj` nos lançamentos  
- Rollback remove os dois lançamentos por `operacao_id`

**Mensagem comercial vínculo:** *"Você possui uma conta PF conosco? Vincule aqui."*

---

## Rotas API — Integração PF/PJ

Montagem: `app.use("/api/integracao-pf-pj", integracaoPfPjRouter)` em `server/index.js`

| Método | Rota | Quem |
|--------|------|------|
| GET | `/vinculo` | PJ: `{ vinculo }` — PF: `{ pendentes, ativos }` |
| POST | `/vinculo` | PJ — convite por e-mail |
| DELETE | `/vinculo` | PJ — revoga |
| GET | `/buscar-pf?email=` | PJ |
| POST | `/aceitar` | PF |
| POST | `/recusar` | PF |
| POST | `/pro-labore/preview` | PJ (vínculo **ativo**) |
| POST | `/pro-labore` | PJ — grava bilateral |
| GET | `/operacoes` | PJ — histórico |
| POST | `/operacoes/:id/rollback` | PJ |

**Não alterar:** auth, JWT, `GET/PUT /api/state`.

---

## Arquivos-chave

### Backend

| Arquivo | Função |
|---------|--------|
| `server/migrations/017_integracao_pf_pj_vinculo.sql` | Vínculo |
| `server/migrations/018_integracao_pf_pj_operacoes.sql` | Operações |
| `server/routes/integracaoPfPj.js` | Rotas vínculo + pró-labore |
| `server/integracaoPfPj/proLaboreWriter.js` | Preview, confirm, rollback |
| `server/utils/ofxImport.js` | `confirmImport`, rollback importações (OFX/CSV/XLSX) |
| `server/utils/parseCsv.js` / `parseXlsx.js` | Importação planilhas |
| `server/routes/importacoes.js` | OFX/CSV/XLSX + histórico importações |

### Frontend

| Arquivo | Função |
|---------|--------|
| `src/gestor/pages/IntegracaoPfPjPage.jsx` | Abas: **Vínculo**, **Pró-labore**, **Histórico** (menu PJ) |
| `src/gestor/pages/PlanilhaImportWizard.jsx` | Wizard CSV/XLSX |
| `src/gestor/pages/ConexoesBancariasPage.jsx` | OFX + CSV/XLSX + histórico importações |
| `src/gestor/pages/PagesPF.jsx` | `PfPjVinculoCard` no Perfil PF |
| `src/gestor/api.js` | `importacoesApi`, `integracaoPfPjApi` |
| `src/gestor/constants.js` | Nav PJ: `integracao-pf-pj` |

---

## Comandos úteis

```bash
# Dev completo
npm run dev:all

# Só API (reiniciar após novas rotas/migrations)
npm run server

# Migrations aplicam no startup do server
npm run build

# Testes por etapa
npm run test:47    # CSV/XLSX + OFX intacto
npm run test:50    # Vínculo PF/PJ
npm run test:50c   # Pró-labore + rollback

# API em outra porta no shell quebra testes — usar PORT=3001
# PowerShell: $env:PORT="3001"; npm run test:50c
```

---

## Pendências locais (NÃO estavam no Git na última sessão)

| Path | Notas |
|------|--------|
| `whatsapp-gateway/` | Projeto Baileys separado (~3k arquivos com `node_modules`). Repo próprio: `tecnocell-cell/WhatsApp-Gateway`. **Não commitado** no gestorfinanceiro. |
| `centerflow-frontend/.lovable/` | Cache — ignorar |
| `Novo(a) Documento de Texto.txt` | Lixo — ignorar |
| `src/gestor/pages/RecorrenciasPage.jsx` | Tinha só diff CRLF — foi restaurado |

---

## Regras que o usuário repetiu

1. **Não alterar** `/api/state`, auth, JWT, regras financeiras globais sem pedido explícito.
2. **Não quebrar OFX** ao mexer em importações.
3. Commits **só com arquivos da etapa**; push **só com aprovação** (usuário aprovou 4.7, 5.0B, 5.0C).
4. Ao final de etapa: `npm run build`, testes, `git diff --stat`, sem push automático salvo pedido.
5. Servidor precisa **restart** após novas rotas (senão 404).

---

## Fluxo manual para testar 5.0C

1. Login **PJ** → Conexões / Integração PF/PJ → Vínculo: e-mail PF → convite.
2. Login **PF** → Perfil → Aceitar convite.
3. Login **PJ** → aba Pró-labore → valor/data → preview → confirmar.
4. Verificar Lançamentos PJ (Saída) e PF (Entrada) com `source: integracao_pf_pj`.
5. Histórico → Desfazer → lançamentos removidos nos dois lados.

---

## Próximo passo sugerido (quando o usuário pedir)

**Etapa 5.0D+** (escolher uma):

- A) Outro tipo de operação (ex.: salário) reutilizando `proLaboreWriter` → writer genérico `operacaoWriter.js`
- B) UI PF read-only de pró-labores recebidos
- C) Idempotência / anti double-click em POST `/pro-labore`
- D) Versionar `whatsapp-gateway/` no monorepo (commit separado, sem `node_modules`)

---

## Histórico de commits recentes (`main`)

```
927f2f9 Etapa 5.0C: pro-labore PJ PF
5966ba3 Etapa 5.0B: vinculo unico PJ PF
51a9be8 Etapa 4.7: importacao CSV e XLSX profissional
3fb934f Etapa 4.6D: rollback seguro de importação OFX
```

---

## Transcript da sessão

Agent transcript (JSONL):  
`C:\Users\root\.cursor\projects\c-Users-root-Documents-Projetos-CenterFlow\agent-transcripts\ce594754-61a0-49dc-933a-3748670a42c9\ce594754-61a0-49dc-933a-3748670a42c9.jsonl`

Buscar por: `5.0C`, `5.0B`, `4.7`, `integracaoPfPj`, `proLabore`.
