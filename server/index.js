// Carrega .env antes de tudo
import { config } from "dotenv";
config();

import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { query } from "./db.js";
import { authMiddleware, adminMiddleware, activeMiddleware, signToken } from "./middleware/auth.js";
import { findUsuario, rejectProtectedAdmin } from "./adminGuard.js";
import { buildSyncPayload } from "./lacusMap.js";
import { createInitialState } from "./initialState.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: em dev aceita o Vite (5173); em prod aceita a origem configurada
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.CORS_ORIGIN,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // sem origin = curl / Postman / same-origin → OK
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS bloqueado para origem: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: "8mb" }));

// ─── Servir React build (produção) ───────────────────────────────────────────
if (existsSync(DIST)) {
  app.use(express.static(DIST));
}

// ─── Health ──────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/status", (_req, res) =>
  res.json({ online: true, version: "2.0", port: PORT })
);

// ─── Auth: Login ─────────────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ error: "E-mail e senha obrigatórios." });

  try {
    const { rows } = await query(
      "SELECT id, email, nome, senha_hash, role, ativo FROM usuarios WHERE email = $1",
      [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(senha, user.senha_hash))) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }
    if (!user.ativo) {
      return res.status(403).json({ error: "Conta desativada. Entre em contato com o administrador." });
    }

    // Atualiza último acesso
    await query("UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1", [user.id]);

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({
      token,
      user: { id: user.id, email: user.email, nome: user.nome, role: user.role },
    });
  } catch (err) {
    console.error("login:", err.message);
    res.status(500).json({ error: "Erro interno ao autenticar." });
  }
});

// ─── Estado do App (protegido + conta ativa) ──────────────────────────────────
app.get("/api/state", authMiddleware, activeMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT dados FROM estados WHERE usuario_id = $1",
      [req.user.id]
    );
    if (!rows.length) {
      await query(
        "INSERT INTO estados (usuario_id, dados) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [req.user.id, JSON.stringify({})]
      );
      return res.json({ dados: {} });
    }
    res.json({ dados: rows[0].dados });
  } catch (err) {
    console.error("get state:", err.message);
    res.status(500).json({ error: "Erro ao carregar estado." });
  }
});

app.put("/api/state", authMiddleware, activeMiddleware, async (req, res) => {
  const { dados } = req.body || {};
  if (!dados) return res.status(400).json({ error: "Campo 'dados' obrigatório." });

  try {
    await query(
      `INSERT INTO estados (usuario_id, dados)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id)
       DO UPDATE SET dados = $2, updated_at = NOW()`,
      [req.user.id, JSON.stringify(dados)]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("put state:", err.message);
    res.status(500).json({ error: "Erro ao salvar estado." });
  }
});

// ─── Admin: gestão de tenants ─────────────────────────────────────────────────

// Lista todos os usuários (exceto o próprio admin)
app.get("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, email, nome, role, ativo, tipo_perfil, nome_perfil,
              ultimo_acesso, created_at
       FROM usuarios
       ORDER BY role DESC, created_at ASC`
    );
    res.json({ users: rows });
  } catch (err) {
    console.error("admin/users GET:", err.message);
    res.status(500).json({ error: "Erro ao listar usuários." });
  }
});

// Cria novo tenant (admin cria conta PF ou PJ)
app.post("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
  const { nome, email, senha, tipo_perfil = "juridica", nome_perfil } = req.body || {};
  if (!nome || !email || !senha)
    return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
  if (senha.length < 6)
    return res.status(400).json({ error: "Senha mínima: 6 caracteres." });

  try {
    const existe = await query("SELECT id FROM usuarios WHERE email = $1", [email.toLowerCase()]);
    if (existe.rows.length) return res.status(409).json({ error: "E-mail já cadastrado." });

    const hash = await bcrypt.hash(senha, 12);
    const perfil = nome_perfil || nome;

    const { rows } = await query(
      `INSERT INTO usuarios (email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil)
       VALUES ($1, $2, $3, 'user', true, $4, $5)
       RETURNING id, email, nome, role, ativo, tipo_perfil, nome_perfil, created_at`,
      [email.toLowerCase(), hash, nome, tipo_perfil, perfil]
    );
    const user = rows[0];

    // Cria estado inicial com perfil PF ou PJ já configurado
    const initialState = createInitialState(tipo_perfil, perfil);
    await query(
      "INSERT INTO estados (usuario_id, dados) VALUES ($1, $2)",
      [user.id, JSON.stringify(initialState)]
    );

    res.status(201).json({ user });
  } catch (err) {
    console.error("admin/users POST:", err.message);
    res.status(500).json({ error: "Erro ao criar usuário." });
  }
});

// Ativa / Desativa tenant
app.patch("/api/admin/users/:id/toggle", authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const alvo = await findUsuario(query, id);
    if (rejectProtectedAdmin(alvo, res, "desativada")) return;

    const { rows } = await query(
      "UPDATE usuarios SET ativo = NOT ativo WHERE id = $1 AND role != 'admin' RETURNING id, ativo",
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json({ id: rows[0].id, ativo: rows[0].ativo });
  } catch (err) {
    console.error("toggle:", err.message);
    res.status(500).json({ error: "Erro ao alterar status." });
  }
});

// Reseta senha do tenant
app.patch("/api/admin/users/:id/reset-password", authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { nova_senha } = req.body || {};
  if (!nova_senha || nova_senha.length < 6)
    return res.status(400).json({ error: "Senha mínima: 6 caracteres." });

  try {
    const alvo = await findUsuario(query, id);
    if (rejectProtectedAdmin(alvo, res, "alterada por terceiros")) return;

    const hash = await bcrypt.hash(nova_senha, 12);
    const { rows } = await query(
      "UPDATE usuarios SET senha_hash = $1 WHERE id = $2 AND role != 'admin' RETURNING id",
      [hash, id]
    );
    if (!rows.length) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json({ ok: true });
  } catch (err) {
    console.error("reset-password:", err.message);
    res.status(500).json({ error: "Erro ao redefinir senha." });
  }
});

// Deleta tenant e todos os dados
app.delete("/api/admin/users/:id", authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const alvo = await findUsuario(query, id);
    if (rejectProtectedAdmin(alvo, res, "excluída")) return;
    if (alvo.id === req.user.id) {
      return res.status(403).json({ error: "Você não pode excluir a própria conta." });
    }

    const { rows } = await query(
      "DELETE FROM usuarios WHERE id = $1 AND role != 'admin' RETURNING id",
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Usuário não encontrado." });
    res.json({ ok: true });
  } catch (err) {
    console.error("delete user:", err.message);
    res.status(500).json({ error: "Erro ao excluir usuário." });
  }
});

// Altera senha do próprio usuário (qualquer role)
app.patch("/api/auth/change-password", authMiddleware, async (req, res) => {
  const { senha_atual, nova_senha } = req.body || {};
  if (!senha_atual || !nova_senha)
    return res.status(400).json({ error: "Informe a senha atual e a nova senha." });
  if (nova_senha.length < 6)
    return res.status(400).json({ error: "Senha mínima: 6 caracteres." });

  try {
    const { rows } = await query("SELECT senha_hash FROM usuarios WHERE id = $1", [req.user.id]);
    if (!rows.length || !(await bcrypt.compare(senha_atual, rows[0].senha_hash))) {
      return res.status(401).json({ error: "Senha atual incorreta." });
    }
    const hash = await bcrypt.hash(nova_senha, 12);
    await query("UPDATE usuarios SET senha_hash = $1 WHERE id = $2", [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("change-password:", err.message);
    res.status(500).json({ error: "Erro ao alterar senha." });
  }
});

// ─── Sync Microsoft Access (legado) ──────────────────────────────────────────
let odbcModule = null;
async function getOdbc() {
  if (odbcModule) return odbcModule;
  try { odbcModule = await import("odbc"); return odbcModule; } catch { return null; }
}

async function queryTable(conn, table) {
  try { return await conn.query(`SELECT * FROM [${table}]`); } catch { return []; }
}

const SYNC_TABLES = [
  { key: "contas",       table: "BC_Contas" },
  { key: "plano",        table: "BC_Classificacao_DRE" },
  { key: "empresa",      table: "BC_Cadastro_Empresa" },
  { key: "clientes",     table: "BC_Cadastro_Clientes" },
  { key: "fornecedores", table: "BC_Cadastro_Fornecedores" },
  { key: "lancamentos",  table: "BC_Lancamentos" },
  { key: "versao",       table: "TB_Versao_Banco_dados" },
];

app.post("/api/sync", authMiddleware, activeMiddleware, async (req, res) => {
  const { path: dbPath, password } = req.body || {};
  if (!dbPath) return res.status(400).json({ error: "Informe o caminho do banco Access." });

  const odbc = await getOdbc();
  if (!odbc?.connect) {
    return res.status(503).json({ error: "Driver ODBC não disponível neste servidor." });
  }

  const connStr = `Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=${dbPath}${password ? `;PWD=${password}` : ""};`;
  let conn;
  try {
    conn = await odbc.connect(connStr);
    const raw = {};
    for (const { key, table } of SYNC_TABLES) raw[key] = await queryTable(conn, table);
    res.json(buildSyncPayload(raw));
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) try { await conn.close(); } catch {}
  }
});

// ─── SPA fallback (React Router) ─────────────────────────────────────────────
if (existsSync(DIST)) {
  app.get("/{*path}", (_req, res) => res.sendFile(join(DIST, "index.html")));
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✅ Gestor Financeiro API rodando em http://0.0.0.0:${PORT}`);
  console.log(`   Banco: ${process.env.DATABASE_URL ? "PostgreSQL (env)" : "PostgreSQL (padrão local)"}`);
  console.log(`   Modo:  ${process.env.NODE_ENV || "development"}\n`);
});
