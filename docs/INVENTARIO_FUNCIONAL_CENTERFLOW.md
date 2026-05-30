# INVENTÁRIO FUNCIONAL — CenterFlow Financeiro
> **Documento de referência GPT** — gerado em 28/05/2026 a partir da análise completa do código-fonte.
> Não contém informações inventadas. Tudo aqui reflete o estado real do repositório.

---

## 1. Visão Geral do Sistema

O **CenterFlow Financeiro** (internamente chamado `gestorfinanceiro`) é uma aplicação SaaS multi-tenant de gestão financeira que suporta dois perfis de uso:

- **Pessoa Jurídica (PJ):** controle de lançamentos, DRE, plano de contas, conciliação, fechamento de período, balancete, impostos, clientes, fornecedores e exportação contábil.
- **Pessoa Física (PF):** controle de lançamentos pessoais, categorias, orçamento, metas, relatórios de fluxo.

Ambos os perfis têm acesso aos módulos de **Recorrências**, **Contas a Pagar/Receber**, **WhatsApp Financeiro** e **Conexões Bancárias** (estrutura preparatória).

O sistema é um monorepo com frontend React (Vite) e backend Node.js (Express) no mesmo repositório. Em produção, o Express serve o build estático do React.

---

## 2. Stack Tecnológica

### Frontend
| Tecnologia | Versão | Uso |
|---|---|---|
| React | 19.2.6 | Framework UI |
| Vite | 8.0.12 | Build/dev server |
| Recharts | 3.8.1 | Gráficos (bar, area, pie, composed) |
| Lucide-react | 1.16.0 | Ícones |
| xlsx | 0.18.5 | Importação de planilhas XLSX |

### Backend
| Tecnologia | Versão | Uso |
|---|---|---|
| Node.js | 20 (Docker) | Runtime |
| Express | 5.2.1 | HTTP server + API REST |
| pg | 8.13.3 | Cliente PostgreSQL |
| bcryptjs | 2.4.3 | Hash de senhas (custo 12) |
| jsonwebtoken | 9.0.2 | JWT (30 dias) |
| dotenv | 17.4.2 | Variáveis de ambiente |
| qrcode | 1.5.4 | Geração de PNG de QR code |
| cors | 2.8.6 | CORS |
| concurrently | 9.2.1 | Dev: rodar frontend + backend juntos |

### Banco de Dados
- **PostgreSQL 16** (Alpine no Docker)
- Pool: max 20 conexões, idle timeout 30s, connection timeout 3s
- Extensão: `pgcrypto` (UUIDs via `gen_random_uuid()`)

### DevDependencies
- ESLint 10, eslint-plugin-react-hooks, eslint-plugin-react-refresh
- @vitejs/plugin-react, @types/react, @types/react-dom

---

## 3. Módulos Existentes

### 3.1 Módulo de Autenticação
**Arquivo:** `server/index.js`, `server/authPublic.js`, `server/middleware/auth.js`

- Login com e-mail/senha (bcryptjs)
- Registro com verificação por e-mail ou SMS (Twilio — opcional)
- JWT (30 dias, assina `{ id, email, role }`)
- Troca de senha pelo próprio usuário
- Controle de conta ativa/inativa pelo admin

### 3.2 Módulo Admin (Super Admin)
**Arquivo:** `server/index.js` (rotas `/api/admin/*`)

- Listar, criar, ativar/desativar, redefinir senha e excluir tenants
- Visualizar estado (JSONB) de um tenant em modo somente leitura
- Listar recorrências de um tenant

### 3.3 Módulo de Estado (App State)
**Arquivo:** `server/index.js` (rotas `/api/state`), `server/initialState.js`

- Todo o estado financeiro do tenant (contas, lançamentos, plano de contas, clientes, etc.) é armazenado como **JSONB** na tabela `estados`
- `GET /api/state` retorna o estado atual
- `PUT /api/state` salva o estado completo

### 3.4 Módulo Financeiro PJ
**Arquivos:** `src/gestor/pages/Pages.jsx`, `src/gestor/GestorContext.jsx`, `src/gestor/finance.js`

Páginas: Dashboard, Lançamentos, DRE, Contas, Plano de Contas, Impostos, Clientes, Fornecedores, Importações, Conciliação, Balancete, Fechamento, Relatórios, Empresa.

### 3.5 Módulo Financeiro PF
**Arquivo:** `src/gestor/pages/PagesPF.jsx`

Páginas: Dashboard PF, Lançamentos PF, Categorias PF, Orçamento, Metas, Relatórios PF, Contas PF, Perfil PF.

### 3.6 Módulo de Recorrências
**Arquivos:** `server/routes/recorrencias.js`, `src/gestor/pages/RecorrenciasPage.jsx`, `src/gestor/hooks/useRecorrencias.js`

- CRUD completo de despesas e receitas fixas (mensal/semanal/anual)
- Endpoint `/gerar` avança a `proxima_data` para o próximo ciclo

### 3.7 Módulo Contas a Pagar/Receber
**Arquivo:** `src/gestor/pages/ContasAPagarPage.jsx`

- Visualização de lançamentos com campo `vencimento` e `status` (pendente/pago)
- Status "atrasado" é calculado no frontend (nunca persistido)
- Edição inline de datas de vencimento
- Mutações via `lancCrud.update()` no JSONB

### 3.8 Módulo WhatsApp Financeiro
**Arquivos:** `server/routes/whatsapp.js`, `server/whatsapp/evolutionProvider.js`, `src/gestor/pages/WhatsAppPage.jsx`, `src/gestor/hooks/useWhatsApp.js`

- Integração com **Evolution API v2** (self-hosted)
- Conexão via QR code
- Status: disconnected → connecting → connected
- Tabelas: `whatsapp_sessions`, `whatsapp_pending` (migration 005)
- Status atual (2026-05-27): **QR bloqueado por bug na Evolution v2.1.1** — necessita v2.3.7+

### 3.9 Módulo Conexões Bancárias (Open Finance)
**Arquivo:** `src/gestor/pages/ConexoesBancariasPage.jsx`
**Migration:** `server/migrations/004_conexoes_bancarias.sql`

- Tabelas `conexoes_bancarias` e `conexoes_interesse` criadas
- **Frontend/integração: estrutura preparatória (roadmap)**
- Suporta provedores: pluggy, belvo, openbanking_br (apenas campo, sem implementação)

### 3.10 Dashboard V2 (Premium)
**Arquivos:** `src/gestor/pages/DashboardV2Page.jsx`, `src/gestor/pages/DashboardPFV2Page.jsx`

- Versão premium do dashboard com componentes avançados
- Substituiu o DashboardPage original
- Rollback documentado nos comentários do GestorApp.jsx

---

## 4. Endpoints da API

### Auth
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/auth/login` | Público | Login com e-mail/senha |
| POST | `/api/auth/register` | Público | Cadastro (cria conta inativa) |
| POST | `/api/auth/verify` | Público | Verifica código e-mail/SMS |
| POST | `/api/auth/resend-code` | Público | Reenviar código de verificação |
| GET | `/api/auth/me` | JWT+Ativo | Perfil do usuário logado |
| PATCH | `/api/auth/change-password` | JWT | Trocar senha (próprio usuário) |

### Estado
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/state` | JWT+Ativo | Carregar estado JSONB do tenant |
| PUT | `/api/state` | JWT+Ativo | Salvar estado JSONB do tenant |

### Admin
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/admin/users` | JWT+Admin | Listar todos os tenants |
| POST | `/api/admin/users` | JWT+Admin | Criar novo tenant |
| PATCH | `/api/admin/users/:id/toggle` | JWT+Admin | Ativar/desativar tenant |
| PATCH | `/api/admin/users/:id/reset-password` | JWT+Admin | Redefinir senha do tenant |
| GET | `/api/admin/users/:id/state` | JWT+Admin | Ver estado (somente leitura) |
| PUT | `/api/admin/users/:id/state` | JWT+Admin | Sempre retorna 403 (view only) |
| DELETE | `/api/admin/users/:id` | JWT+Admin | Excluir tenant + dados |
| GET | `/api/admin/users/:id/recorrencias` | JWT+Admin | Listar recorrências do tenant |

### Recorrências
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/recorrencias` | JWT+Ativo | Listar recorrências do tenant |
| POST | `/api/recorrencias` | JWT+Ativo | Criar recorrência |
| PATCH | `/api/recorrencias/:id` | JWT+Ativo | Atualizar recorrência |
| DELETE | `/api/recorrencias/:id` | JWT+Ativo | Excluir recorrência |
| POST | `/api/recorrencias/:id/gerar` | JWT+Ativo | Avançar proxima_data |

### WhatsApp
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/whatsapp/connect` | JWT+Ativo | Criar instância Evolution + iniciar QR |
| GET | `/api/whatsapp/status` | JWT+Ativo | Status atual da sessão |
| GET | `/api/whatsapp/qrcode` | JWT+Ativo | Obter QR code (base64 PNG) |
| POST | `/api/whatsapp/disconnect` | JWT+Ativo | Desconectar e excluir instância |
| POST | `/api/whatsapp/webhook/:instanceName` | Público (secret) | Recebe eventos da Evolution |

### Health
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/health` | Público | `{ ok: true }` |
| GET | `/api/status` | Público | `{ online: true, version: "2.0", port }` |

---

## 5. Telas do Frontend

### Modo Pessoa Jurídica (PJ)

| ID de Rota | Label | Componente | Arquivo |
|---|---|---|---|
| dashboard | Dashboard | DashboardV2Page | pages/DashboardV2Page.jsx |
| lancamentos | Lançamentos | LancamentosPage | pages/Pages.jsx |
| recorrencias | Recorrências | RecorrenciasPage | pages/RecorrenciasPage.jsx |
| contas-pagar | A Pagar/Receber | ContasAPagarPage | pages/ContasAPagarPage.jsx |
| dre | D.R.E. | DREPage | pages/Pages.jsx |
| contas | Contas | ContasPage | pages/Pages.jsx |
| plano | Plano Contas | PlanoContasPage | pages/Pages.jsx |
| impostos | Impostos | ImpostosPage | pages/Pages.jsx |
| clientes | Clientes | ClientesPage | pages/Pages.jsx |
| fornecedores | Fornecedores | FornecedoresPage | pages/Pages.jsx |
| importacoes | Importações | ImportacoesPage | pages/Pages.jsx |
| conciliacao | Conciliação | ConciliacaoPage | pages/Pages.jsx |
| balancete | Balancete | BalancetePage | pages/Pages.jsx |
| fechamento | Fechamento | FechamentoPage | pages/Pages.jsx |
| relatorios | Relatórios | RelatoriosPage | pages/Pages.jsx |
| whatsapp | WhatsApp | WhatsAppPage | pages/WhatsAppPage.jsx |
| open-finance | Conexões | ConexoesBancariasPage | pages/ConexoesBancariasPage.jsx |
| empresa | Empresa | EmpresaPage | pages/Pages.jsx |
| super-admin | Painel Admin | AdminPanel | pages/AdminPage.jsx |

### Modo Pessoa Física (PF)

| ID de Rota | Label | Componente | Arquivo |
|---|---|---|---|
| dashboard | Dashboard | DashboardPFV2Page | pages/DashboardPFV2Page.jsx |
| lancamentos | Lançamentos | LancamentosPFPage | pages/PagesPF.jsx |
| recorrencias | Recorrências | RecorrenciasPage | pages/RecorrenciasPage.jsx |
| contas-pagar | A Pagar/Receber | ContasAPagarPage | pages/ContasAPagarPage.jsx |
| categorias | Categorias | CategoriasPFPage | pages/PagesPF.jsx |
| orcamento | Orçamento | OrcamentoPage | pages/PagesPF.jsx |
| metas | Metas | MetasPage | pages/PagesPF.jsx |
| contas | Contas | ContasPFPage | pages/PagesPF.jsx |
| relatorios | Relatórios | RelatoriosPFPage | pages/PagesPF.jsx |
| whatsapp | WhatsApp | WhatsAppPage | pages/WhatsAppPage.jsx |
| open-finance | Conexões | ConexoesBancariasPage | pages/ConexoesBancariasPage.jsx |
| perfil | Perfil | PerfilPFPage | pages/PagesPF.jsx |

### Modais (PJ)
- `lancamento` → ModalLancamento
- `conta` → ModalConta
- `plano` → ModalPlano
- `cliente` → ModalCliente
- `fornecedor` → ModalFornecedor

### Modais (PF)
- `categoria-pf` → ModalCategoriaPF
- `meta` → ModalMeta

---

## 6. Banco de Dados

### Tabelas (schema.sql + migrations)

#### `usuarios`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | gen_random_uuid() |
| email | VARCHAR(255) UNIQUE | E-mail do tenant |
| senha_hash | TEXT | bcryptjs custo 12 |
| nome | VARCHAR(255) | Nome do usuário |
| role | VARCHAR(20) | 'admin' ou 'user' |
| ativo | BOOLEAN | Se conta está ativa |
| tipo_perfil | VARCHAR(20) | 'juridica' ou 'fisica' |
| nome_perfil | VARCHAR(255) | Nome empresa (PJ) ou perfil (PF) |
| telefone | VARCHAR(20) | Para verificação SMS (migration 002) |
| email_verificado | BOOLEAN | migration 002 |
| telefone_verificado | BOOLEAN | migration 002 |
| ultimo_acesso | TIMESTAMPTZ | Atualizado no login |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | Trigger automático |

#### `estados`
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| usuario_id | UUID UNIQUE FK → usuarios | ON DELETE CASCADE |
| dados | JSONB | Estado completo do app |
| updated_at | TIMESTAMPTZ | Trigger automático |

#### `verificacoes` (migration 002)
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| usuario_id | UUID FK → usuarios | ON DELETE CASCADE |
| canal | VARCHAR(10) | 'email' ou 'sms' |
| codigo_hash | TEXT | Hash do código de 6 dígitos |
| expires_at | TIMESTAMPTZ | TTL configurável |
| usado | BOOLEAN | Evita reuso |
| created_at | TIMESTAMPTZ | |

#### `recorrencias` (migration 003)
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| usuario_id | UUID FK → usuarios | ON DELETE CASCADE |
| tipo | VARCHAR(10) | 'Receita' ou 'Despesa' |
| descricao | TEXT | Descrição |
| valor | NUMERIC(15,2) | Valor |
| periodicidade | VARCHAR(10) | 'mensal', 'semanal' ou 'anual' |
| proxima_data | DATE | Próximo vencimento |
| status | VARCHAR(10) | 'ativa', 'pausada' ou 'encerrada' |
| plano_id | TEXT | Ref. ao planoContas[].id no JSONB |
| conta_id | TEXT | Ref. ao contas[].id no JSONB |
| empresa_id | TEXT | Ref. ao empresa.id no JSONB |
| observacao | TEXT | Opcional |

#### `conexoes_bancarias` (migration 004)
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| usuario_id | UUID FK → usuarios | ON DELETE CASCADE |
| banco_slug | VARCHAR(50) | 'nubank', 'itau', etc. |
| apelido | TEXT | Nome amigável |
| status | VARCHAR(20) | 'pendente','ativa','pausada','erro','revogada' |
| provedor | VARCHAR(50) | 'pluggy', 'belvo', 'openbanking_br' |
| provedor_id | TEXT | ID no provedor externo |
| ultimo_sync | TIMESTAMPTZ | |
| erro_msg | TEXT | |

#### `conexoes_interesse` (migration 004)
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| usuario_id | UUID FK → usuarios | ON DELETE CASCADE |
| banco_slug | VARCHAR(50) | Banco de interesse |
| UNIQUE | (usuario_id, banco_slug) | Um por banco por usuário |

#### `whatsapp_sessions` (migration 005)
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| usuario_id | UUID UNIQUE FK → usuarios | ON DELETE CASCADE — max 1 por tenant |
| instance_name | TEXT UNIQUE | Convenção: `cf-{usuario_id}` |
| phone_number | TEXT | 5511999999999 — NULL até conectar |
| status | TEXT | 'disconnected', 'connecting', 'connected' |
| qrcode_base64 | TEXT | NULL após conexão |
| webhook_secret | TEXT | `crypto.randomBytes(32)` por instância |

#### `whatsapp_pending` (migration 005)
| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| usuario_id | UUID FK → usuarios | ON DELETE CASCADE |
| from_number | TEXT | Validação de origem |
| payload | JSONB | Objeto do lançamento pronto |
| tipo_criacao | TEXT | 'avulso' ou 'recorrencia' |
| expires_at | TIMESTAMPTZ | DEFAULT NOW() + 24h |

### Índices Relevantes
- `idx_estados_usuario` ON estados(usuario_id)
- `idx_recorrencias_usuario` ON recorrencias(usuario_id)
- `idx_recorrencias_proxima` ON recorrencias(proxima_data)
- `idx_wa_sessions_usuario` ON whatsapp_sessions(usuario_id)
- `idx_wa_sessions_instance` ON whatsapp_sessions(instance_name)
- `idx_wa_pending_usuario` ON whatsapp_pending(usuario_id)
- `idx_wa_pending_expires` ON whatsapp_pending(expires_at)

---

## 7. Autenticação

- **Tipo:** Bearer JWT
- **Algoritmo:** default (HS256)
- **Expiração:** 30 dias (`{ expiresIn: "30d" }`)
- **Secret:** `process.env.JWT_SECRET` (fallback: `"dev_secret_MUDE_ANTES_DE_USAR"`)
- **Payload:** `{ id: UUID, email: string, role: "admin"|"user" }`
- **Armazenamento frontend:** `localStorage.getItem("gestor_token")`
- **Header HTTP:** `Authorization: Bearer <token>`

### Middlewares em cadeia
```
authMiddleware → adminMiddleware (apenas rotas admin)
authMiddleware → activeMiddleware (rotas protegidas comuns)
```

---

## 8. Regras de Negócio

1. **Tenant isolado:** cada usuário só acessa seus próprios `estados`, `recorrencias`, `whatsapp_sessions` e `whatsapp_pending`. Todas as queries usam `WHERE usuario_id = $1`.
2. **Admin não pode alterar própria conta nem conta de outro admin.**
3. **Estado JSONB:** toda a contabilidade (lançamentos, contas, plano de contas, clientes, etc.) é persistida como um único JSONB por tenant. O backend valida e normaliza antes de salvar.
4. **Recorrência `gerar`:** avança apenas a `proxima_data`. O lançamento real é criado pelo frontend via `lancCrud` (JSONB).
5. **WhatsApp pending:** máximo 1 por tenant. Novo substitui o anterior. Expira em 24h.
6. **Conta inativa:** `activeMiddleware` bloqueia qualquer rota com HTTP 403 se `ativo = false`.
7. **Verificação de conta:** na criação via `register`, conta começa com `ativo = false` e precisa de código. Admin criando usuário via painel define `ativo = true` e `email_verificado = true`.
8. **Admin view-only:** `PUT /api/admin/users/:id/state` sempre retorna 403. Admin só visualiza dados de tenant.
9. **Status "atrasado":** calculado no frontend (ContasAPagarPage), nunca persistido em banco.
10. **Exportação Domínio:** gera arquivo TXT com separador `|`, marca lançamentos como exportados no JSONB.

---

## 9. Integrações

### 9.1 Evolution API (WhatsApp)
- **Self-hosted** — variável `EVOLUTION_API_URL`
- **Versão testada:** v2.1.1 (bug de QR confirmado); **recomendada:** v2.3.7+
- Chamadas: `/instance/create`, `/instance/connect/{name}`, `/instance/fetchInstances`, `/instance/logout/{name}`, `/instance/delete/{name}`, `/instance/connectionState/{name}`
- **Arquivo:** `server/whatsapp/evolutionProvider.js`

### 9.2 SMTP (e-mail de verificação)
- Configuração via variáveis `SMTP_*` no `.env`
- **Opcional** — sem SMTP configurado, código aparece em `dev_code` na resposta da API (apenas em dev)

### 9.3 Twilio (SMS de verificação)
- Configuração via `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`
- **Opcional** — sem Twilio, verificação por SMS não funciona

### 9.4 Importação OFX
- Parse manual no frontend (`src/gestor/importExport.js`)

### 9.5 Importação Mercado Pago CSV
- Parse manual no frontend (`src/gestor/importExport.js`)

### 9.6 Importação XLSX
- Biblioteca `xlsx` no frontend

### 9.7 Exportação Domínio (Contabilidade)
- Arquivo TXT com separador `|`, formato proprietário Domínio Sistemas

---

## 10. Permissões (RBAC)

| Recurso | role=user | role=admin |
|---|---|---|
| Próprio estado (GET/PUT) | ✅ | ✅ |
| Próprias recorrências (CRUD) | ✅ | ✅ |
| Próprio WhatsApp (connect/status/qr/disconnect) | ✅ | ✅ |
| Trocar própria senha | ✅ | ✅ |
| Listar todos os usuários | ❌ | ✅ |
| Criar usuário | ❌ | ✅ |
| Ativar/desativar usuário | ❌ | ✅ |
| Redefinir senha de outro usuário | ❌ | ✅ |
| Ver estado de outro usuário | ❌ | ✅ (read-only) |
| Alterar estado de outro usuário | ❌ | ❌ (403) |
| Excluir usuário | ❌ | ✅ (não pode excluir admin) |
| Ver recorrências de outro usuário | ❌ | ✅ (read-only) |

---

## 11. Status Real de Implementação

| Módulo | Status |
|---|---|
| Autenticação (login/logout/JWT) | ✅ Completo |
| Registro + verificação (e-mail/SMS) | ✅ Completo |
| Painel Admin (gestão de tenants) | ✅ Completo |
| Finanças PJ (Lançamentos, DRE, Contas, Plano) | ✅ Completo |
| Finanças PJ (Balancete, Fechamento, Relatórios) | ✅ Completo |
| Finanças PF (Lançamentos, Categorias, Orçamento, Metas) | ✅ Completo |
| Recorrências (CRUD + gerar) | ✅ Completo |
| Contas a Pagar/Receber | ✅ Completo |
| Dashboard V2 (PJ + PF) | ✅ Completo |
| Importação OFX / CSV / XLSX | ✅ Completo |
| Exportação Domínio / JSON / CSV | ✅ Completo |
| WhatsApp — infraestrutura (tabelas, API, webhook) | ✅ Completo |
| WhatsApp — QR Code (exibição no app) | ⚠️ Bloqueado (Evolution v2.1.1) |
| WhatsApp — recebimento e confirmação de mensagens | 🔲 Roadmap (Fase 3+) |
| Conexões Bancárias (Open Finance) | 🔲 Estrutura SQL pronta, UI preparatória |
| Notificações Push | 🔲 Roadmap |
| Multi-empresa por tenant | 🔲 Campo empresa_id presente, não explorado como multi-tenant |
