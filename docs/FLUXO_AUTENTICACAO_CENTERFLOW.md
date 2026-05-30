# FLUXO DE AUTENTICAÇÃO — CenterFlow Financeiro
> Documentação completa do sistema de autenticação: JWT, login, registro, verificação, RBAC, middlewares e segurança.

---

## 1. Visão Geral

O sistema usa **JWT (JSON Web Tokens)** para autenticação stateless com validade de **30 dias**. Não há refresh tokens. Senhas são armazenadas com **bcryptjs (custo 12)**.

**Arquivos principais:**
- `server/middleware/auth.js` — middlewares de autenticação
- `server/index.js` — endpoints de login, admin, state, change-password
- `server/authPublic.js` — endpoints públicos: register, verify, resend-code
- `server/verification.js` — lógica de verificação por e-mail/SMS
- `src/gestor/AuthContext.jsx` — contexto React de autenticação
- `src/gestor/api.js` — cliente API frontend (armazena token)

---

## 2. JWT

### Configuração
```javascript
// server/middleware/auth.js
const SECRET = process.env.JWT_SECRET || "dev_secret_MUDE_ANTES_DE_USAR";

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}
```

### Payload do token
```javascript
{
  id: "uuid-do-usuario",
  email: "usuario@empresa.com",
  role: "user" | "admin"
}
```

### Armazenamento no Frontend
```javascript
// localStorage
localStorage.getItem("gestor_token")   // JWT
localStorage.getItem("gestor_user")    // objeto User serializado
```

### Header HTTP
```
Authorization: Bearer {token}
```

---

## 3. Fluxo de Login

### Endpoint
```
POST /api/auth/login
Body: { email, senha }
```

### Fluxo
```
1. Valida campos obrigatórios
2. Busca usuário por email (case insensitive)
3. bcrypt.compare(senha, usuario.senha_hash)
4. Verifica se conta está verificada ou ativa
   → Se não verificado E não ativo → HTTP 403 { needs_verification: true }
   → Se não ativo → HTTP 403 "Conta desativada"
5. UPDATE usuarios SET ultimo_acesso = NOW()
6. signToken({ id, email, role })
7. Retorna token + dados do usuário
```

### Resposta de sucesso
```json
{
  "token": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "usuario@empresa.com",
    "nome": "João Silva",
    "role": "user",
    "tipo_perfil": "juridica",
    "nome_perfil": "Empresa ABC"
  }
}
```

---

## 4. Fluxo de Registro

### Endpoint
```
POST /api/auth/register
Body: {
  nome, email, senha,
  tipo_perfil: "juridica"|"fisica",
  nome_perfil: "Nome da Empresa ou Perfil",
  telefone?: "11999999999",
  canal_verificacao?: "email"|"sms"
}
```

### Fluxo
```
1. Validações: nome, email, senha (min 6 chars), tipo_perfil, nome_perfil
2. Se canal=sms: valida telefone (10-13 dígitos)
3. Verifica se email já existe → 409
4. bcrypt.hash(senha, 12)
5. INSERT usuarios (ativo=false, email_verificado=false)
6. createInitialState(tipo_perfil, nome_perfil) → INSERT estados
7. createAndSendVerification() → código de 6 dígitos
   - se SMTP configurado: envia e-mail
   - se Twilio configurado: envia SMS
   - se nenhum: retorna dev_code na resposta (DEV ONLY)
8. Retorna { ok: true, canal, ttl_minutos, dev_code? }
```

> **Conta criada com `ativo = false`** — não pode logar até verificar.

---

## 5. Fluxo de Verificação

### Endpoint
```
POST /api/auth/verify
Body: { email, codigo, canal?: "email"|"sms" }
```

### Fluxo
```
1. verifyCode(email, codigo, canal) — verifica hash + expiry
2. Se ok: UPDATE usuarios SET email_verificado=true (ou telefone_verificado=true)
3. signToken() — retorna JWT imediatamente após verificação
4. Usuário já fica logado
```

### Tabela `verificacoes`
```sql
id, usuario_id, canal, codigo_hash, expires_at, usado, created_at
```
- TTL: `VERIFY_CODE_TTL_MIN` (padrão 15 min) ou configurável no `.env`
- Campo `usado = true` após verificação (previne reuso)

### Reenvio de código
```
POST /api/auth/resend-code
Body: { email, canal?: "email"|"sms" }
```
- Apenas para contas não verificadas
- Cria novo registro na tabela `verificacoes`

---

## 6. Middlewares

### `authMiddleware`
```javascript
// server/middleware/auth.js
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não informado." });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado." });
  }
}
```

Popula `req.user = { id, email, role }` — usado por todos os handlers protegidos.

### `adminMiddleware`
```javascript
export function adminMiddleware(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }
  next();
}
```

### `activeMiddleware`
```javascript
export async function activeMiddleware(req, res, next) {
  const { rows } = await query(
    "SELECT ativo FROM usuarios WHERE id = $1", [req.user.id]
  );
  if (!rows.length || !rows[0].ativo) {
    return res.status(403).json({ error: "Conta desativada." });
  }
  next();
}
```

Consulta o banco a cada request para garantir que a conta não foi desativada após o token ser emitido.

### Cadeia nos endpoints
```javascript
// Rotas comuns de usuário
authMiddleware → activeMiddleware → handler

// Rotas de admin
authMiddleware → adminMiddleware → handler

// Troca de senha (qualquer role, sem activeMiddleware)
authMiddleware → handler
```

---

## 7. RBAC — Controle de Acesso por Role

### Roles existentes
| Role | Descrição |
|---|---|
| `user` | Tenant padrão — acessa apenas seus próprios dados |
| `admin` | Super Admin — acessa painel administrativo e dados de todos os tenants |

### Hierarquia de proteção

```
Público (sem token):
  POST /api/auth/login
  POST /api/auth/register
  POST /api/auth/verify
  POST /api/auth/resend-code
  GET  /api/health
  GET  /api/status
  POST /api/whatsapp/webhook/:instanceName  ← validado por secret, não por JWT

JWT apenas (authMiddleware):
  PATCH /api/auth/change-password

JWT + Ativo (authMiddleware + activeMiddleware):
  GET/PUT /api/state
  GET/POST/PATCH/DELETE /api/recorrencias
  POST /api/recorrencias/:id/gerar
  GET  /api/auth/me
  POST/GET/POST /api/whatsapp/connect|status|qrcode|disconnect

JWT + Admin (authMiddleware + adminMiddleware):
  GET  /api/admin/users
  POST /api/admin/users
  PATCH /api/admin/users/:id/toggle
  PATCH /api/admin/users/:id/reset-password
  GET  /api/admin/users/:id/state
  PUT  /api/admin/users/:id/state    ← sempre retorna 403
  DELETE /api/admin/users/:id
  GET  /api/admin/users/:id/recorrencias
```

---

## 8. Isolamento Multi-Tenant

Todas as queries de recursos protegidos usam `usuario_id = req.user.id`:

```javascript
// recorrencias
WHERE usuario_id = $1

// estado
WHERE usuario_id = $1

// whatsapp_sessions
WHERE usuario_id = $1
```

O admin pode ler dados de outros tenants via rotas `/api/admin/users/:id/*`, mas **nunca escrever** (o endpoint de escrita do estado de tenant retorna 403).

---

## 9. Proteção do Admin

**Arquivo:** `server/adminGuard.js`

O admin padrão (seed inicial) é protegido contra:
- Desativação por outro admin
- Exclusão
- Troca de senha por terceiro

```javascript
// adminGuard.js
export function rejectProtectedAdmin(alvo, res, acao) {
  if (alvo.role === "admin") {
    res.status(403).json({
      error: `A conta do administrador principal não pode ser ${acao}.`
    });
    return true;
  }
  return false;
}
```

---

## 10. Troca de Senha

### Pelo próprio usuário
```
PATCH /api/auth/change-password
Auth: JWT (authMiddleware apenas — sem activeMiddleware)
Body: { senha_atual, nova_senha }
```

- Verifica `senha_atual` com bcrypt
- Nova senha: mínimo 6 caracteres
- Hash com bcryptjs custo 12

### Pelo admin (reset)
```
PATCH /api/admin/users/:id/reset-password
Auth: JWT + Admin
Body: { nova_senha }
```

- Não exige senha atual
- Não funciona para outros admins

---

## 11. Segurança

### Senhas
- Hash: bcryptjs, custo 12
- Mínimo: 6 caracteres (validado no backend)

### JWT
- Algoritmo: HS256 (padrão jsonwebtoken)
- Secret: `JWT_SECRET` no `.env` — **deve ser trocado antes de produção**
- Expiração: 30 dias (sem refresh)
- Token expirado → HTTP 401 → frontend limpa localStorage e recarrega

### CORS
```javascript
// Origens permitidas
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  ...process.env.CORS_ORIGIN?.split(",").map(o => o.trim()).filter(Boolean)
];
```
- Sem origin (curl, Postman, same-origin): permitido
- Origin não listada: bloqueado com erro

### Webhook WhatsApp
- Autenticado por `webhookSecret` gerado por `crypto.randomBytes(32)` — nunca exposto ao frontend
- Comparação com `crypto.timingSafeEqual` para prevenir timing attacks

### Body limit
```javascript
app.use(express.json({ limit: "8mb" }));
```

---

## 12. Frontend — Fluxo do AuthContext

**Arquivo:** `src/gestor/AuthContext.jsx`

```javascript
// Estados do AuthContext
user: null | { id, email, nome, role, tipo_perfil, nome_perfil }
isLoading: boolean
isSuperAdmin: user?.role === "admin"

// Funções
login(email, senha)   → POST /api/auth/login → salva no localStorage
logout()              → limpa localStorage → redireciona para login
```

### Persistência de sessão
```javascript
// api.js — tokenStorage
tokenStorage.set(token)   → localStorage.setItem("gestor_token", token)
tokenStorage.get()        → localStorage.getItem("gestor_token")
tokenStorage.clear()      → remove "gestor_token" e "gestor_user"
```

### Tratamento de 401/403
```javascript
// api.js
if (res.status === 401) {
  const hadSession = !!localStorage.getItem("gestor_token");
  localStorage.removeItem("gestor_token");
  localStorage.removeItem("gestor_user");
  if (hadSession) window.location.reload();
}
```

---

## 13. Verificação de Conta — Lógica Especial

```javascript
// server/verification.js
function isAccountVerified(user) {
  return user.email_verificado || user.telefone_verificado;
}
```

**Regra de acesso ao login:**
- `isAccountVerified(user) = true` OU `user.ativo = true` → permite login
- Admin ativando manualmente (`ativo = true`) dispensa verificação de código

**Admin criando usuário pelo painel:**
- Cria com `ativo = true` e `email_verificado = true`
- Usuário já pode logar sem verificação

---

## 14. Página de Login e Registro

**Arquivos:**
- `src/gestor/pages/LoginPage.jsx` — formulário de login
- `src/gestor/pages/RegisterPage.jsx` — formulário de registro

O `RegisterPage` permite escolher:
- Tipo de perfil: Pessoa Jurídica ou Pessoa Física
- Canal de verificação: e-mail ou SMS (se telefone fornecido)

---

## 15. Modo de Impersonação (Admin View-Only)

O admin pode "entrar" na conta de um tenant para visualizar dados:

```javascript
// GestorContext.jsx
enterAsTenant(tenantUser)  // Admin carrega o estado JSONB de outro usuário
exitAsTenant()             // Admin volta ao painel admin
```

- Todas as ações de escrita ficam desabilitadas (flag `viewOnly = true`)
- Banner vermelho exibido: "Modo visualização — você está vendo a conta do cliente"
- `PUT /api/admin/users/:id/state` sempre retorna 403 (proteção em dupla camada)
