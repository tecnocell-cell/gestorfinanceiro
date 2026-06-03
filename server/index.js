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
import { createInitialState, normalizeStateForUser } from "./initialState.js";
import {
  fetchRollbackIntegracaoLancamentoIds,
  stripLancamentosIntegracaoRollback,
} from "./integracaoPfPj/estadoMerge.js";
import { countPlanoContas } from "./initialState.js";
import { normalizeMoneyInState } from "./normalizeEstadoMoney.js";
import { runMigrations } from "./migrate.js";
import { registerAuthRoutes } from "./authPublic.js";
import { registerSecurityRoutes } from "./authSecurity/routes.js";
import { registerBillingRoutes } from "./billing/routes.js";
import { registerEmpresaRoutes } from "./routes/empresa.js";
import { validateStateSave } from "./billing/accessControl.js";
import {
  attachEmpresaContext,
  requirePermission,
  getUserPermissions,
} from "./auth/permissions.js";
import { isAccountVerified } from "./verification.js";
import { getRequestMeta } from "./authSecurity/requestMeta.js";
import { recordLoginAudit } from "./authSecurity/loginAudit.js";
import {
  isLockedOut,
  lockoutMessage,
  recordFailedLogin,
  resetLoginAttempts,
} from "./authSecurity/bruteForce.js";
import { assessSuspiciousLogin } from "./authSecurity/suspiciousLogin.js";
import { criarEnviarOtp } from "./authSecurity/otp.js";
import { OTP_TTL_MIN } from "./authSecurity/constants.js";
import { recorrenciasRouter } from "./routes/recorrencias.js";
import { conexoesRouter } from "./routes/conexoes.js";
import { importacoesRouter } from "./routes/importacoes.js";
import openFinanceRouter from "./routes/openFinance.js";
import { integracaoPfPjRouter } from "./routes/integracaoPfPj.js";
import whatsappRouter from "./routes/whatsapp.js";
import { whatsappAdminRouter } from "./routes/whatsappAdmin.js";
import systemRouter from "./routes/system.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: dev (Vite) + CORS_ORIGIN (várias origens separadas por vírgula)
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  ...(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
];

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

  const { ip, userAgent } = getRequestMeta(req);

  try {
    const { rows } = await query(
      `SELECT id, email, nome, senha_hash, role, ativo, tipo_perfil, nome_perfil,
              email_verificado, telefone_verificado, tentativas_login, bloqueado_ate
       FROM usuarios WHERE email = $1`,
      [email.toLowerCase()]
    );
    const user = rows[0];

    if (user && isLockedOut(user)) {
      return res.status(429).json({ error: lockoutMessage(user) });
    }

    const senhaOk = user && (await bcrypt.compare(senha, user.senha_hash));

    if (!senhaOk) {
      if (user) {
        await recordFailedLogin(user.id);
        await recordLoginAudit({ usuarioId: user.id, ip, userAgent, sucesso: false });
      } else {
        await recordLoginAudit({ usuarioId: null, ip, userAgent, sucesso: false });
      }
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    // Se o admin ativou a conta manualmente (ativo=true), dispensa verificação de e-mail/SMS.
    // Só exige código se o usuário ainda não verificou E o admin não liberou.
    if (!isAccountVerified(user) && !user.ativo) {
      return res.status(403).json({
        error: "Confirme seu cadastro com o código enviado por e-mail ou SMS.",
        needs_verification: true,
        email: user.email,
      });
    }
    if (!user.ativo) {
      return res.status(403).json({ error: "Conta desativada. Entre em contato com o administrador." });
    }

    const risk = await assessSuspiciousLogin(user.id, ip, userAgent);
    if (risk.suspicious) {
      let otp;
      try {
        otp = await criarEnviarOtp({
          usuarioId: user.id,
          tipo: "login_suspeito",
          canalPreferido: "email",
          nome: user.nome,
        });
      } catch (err) {
        if (err.code === "OTP_RATE_LIMIT") {
          return res.status(429).json({
            error: err.message,
            requires_otp: true,
          });
        } else if (err.code === "OTP_CANAL_INDISPONIVEL") {
          return res.status(503).json({ error: err.message });
        } else {
          throw err;
        }
      }

      return res.status(403).json({
        error: "Login suspeito detectado. Confirme com o código enviado.",
        requires_otp: true,
        otp_id: otp.otp_id,
        expires_at: otp.expires_at,
        canal: otp.canal,
        destino_mascarado: otp.destino_mascarado,
        ttl_minutes: OTP_TTL_MIN,
        motivos: risk.reasons,
        aviso: otp.aviso,
        dev_codigo: otp.dev_codigo,
      });
    }

    await resetLoginAttempts(user.id);
    await recordLoginAudit({ usuarioId: user.id, ip, userAgent, sucesso: true });
    await query("UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1", [user.id]);

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        role: user.role,
        tipo_perfil: user.tipo_perfil || "juridica",
        nome_perfil: user.nome_perfil || user.nome,
      },
    });
  } catch (err) {
    console.error("login:", err.message);
    res.status(500).json({ error: "Erro interno ao autenticar." });
  }
});

registerAuthRoutes(app);
registerSecurityRoutes(app);
registerBillingRoutes(app);
registerEmpresaRoutes(app);

// ─── Auth: perfil atual (atualiza tipo_perfil no cliente) ─────────────────────
app.get("/api/auth/me", authMiddleware, activeMiddleware, attachEmpresaContext, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT id, email, nome, role, ativo, tipo_perfil, nome_perfil FROM usuarios WHERE id = $1",
      [req.user.id]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
    const perms = await getUserPermissions(req.user.id);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        role: user.role,
        tipo_perfil: user.tipo_perfil || "juridica",
        nome_perfil: user.nome_perfil || user.nome,
      },
      empresa: {
        ownerId: req.empresaContext.empresaOwnerId,
        perfil: req.empresaContext.perfil,
        isOwner: req.empresaContext.isOwner,
        isMember: req.empresaContext.isMember,
        permissions: perms.permissions,
        canWrite: perms.canWrite,
        viewOnly: perms.viewOnly,
      },
    });
  } catch (err) {
    console.error("auth/me:", err.message);
    res.status(500).json({ error: "Erro ao carregar perfil." });
  }
});

// ─── Estado do App (protegido + conta ativa) ──────────────────────────────────
app.get("/api/state", authMiddleware, activeMiddleware, attachEmpresaContext, requirePermission("state.read"), async (req, res) => {
  try {
    const stateOwnerId = req.stateOwnerId;
    const { rows } = await query(
      "SELECT dados FROM estados WHERE usuario_id = $1",
      [stateOwnerId]
    );

    const loadProfile = async () => {
      const { rows: userRows } = await query(
        "SELECT tipo_perfil, nome_perfil, nome FROM usuarios WHERE id = $1",
        [stateOwnerId]
      );
      const u = userRows[0];
      return {
        profile: {
          tipo_perfil: u?.tipo_perfil || "juridica",
          nome_perfil: u?.nome_perfil || u?.nome,
          nome: u?.nome,
        },
        state: createInitialState(u?.tipo_perfil || "juridica", u?.nome_perfil || u?.nome || "Perfil"),
      };
    };

    const isValid = (dados) => dados && Array.isArray(dados.empresas) && dados.empresas.length > 0;

    if (!rows.length) {
      const { profile, state: initialState } = await loadProfile();
      await query(
        "INSERT INTO estados (usuario_id, dados) VALUES ($1, $2)",
        [stateOwnerId, JSON.stringify(initialState)]
      );
      return res.json({ dados: initialState, profile });
    }

    let dados = rows[0].dados;
    if (isValid(dados)) {
      dados = normalizeMoneyInState(dados);
    }
    if (!isValid(dados)) {
      const { profile, state: initialState } = await loadProfile();
      await query(
        `UPDATE estados SET dados = $2, updated_at = NOW() WHERE usuario_id = $1`,
        [stateOwnerId, JSON.stringify(initialState)]
      );
      return res.json({ dados: initialState, profile });
    }

    const { profile } = await loadProfile();
    let normalized = normalizeStateForUser(dados, profile);
    const rollbackIds = await fetchRollbackIntegracaoLancamentoIds(query, stateOwnerId);
    const stripped = stripLancamentosIntegracaoRollback(normalized, rollbackIds);
    if (stripped !== normalized) {
      normalized = normalizeStateForUser(stripped, profile);
    }
    const planoAntes = countPlanoContas(dados);
    const planoDepois = countPlanoContas(normalized);
    const normalizeSeguro = planoDepois >= planoAntes;
    if (normalizeSeguro && JSON.stringify(normalized) !== JSON.stringify(dados)) {
      await query(
        `UPDATE estados SET dados = $2, updated_at = NOW() WHERE usuario_id = $1`,
        [stateOwnerId, JSON.stringify(normalized)]
      );
    } else if (!normalizeSeguro && planoDepois < planoAntes) {
      console.warn(
        `GET /state usuario ${stateOwnerId}: normalização ignorada (planoContas ${planoAntes} → ${planoDepois})`
      );
      normalized = dados;
    }

    res.json({ dados: normalized, profile });
  } catch (err) {
    console.error("get state:", err.message);
    res.status(500).json({ error: "Erro ao carregar estado." });
  }
});

app.put("/api/state", authMiddleware, activeMiddleware, attachEmpresaContext, requirePermission("state.write"), async (req, res) => {
  const { dados } = req.body || {};
  if (!dados) return res.status(400).json({ error: "Campo 'dados' obrigatório." });

  try {
    const stateOwnerId = req.stateOwnerId;
    const { rows: userRows } = await query(
      "SELECT tipo_perfil, nome_perfil, nome FROM usuarios WHERE id = $1",
      [stateOwnerId]
    );
    const u = userRows[0];
    const profile = {
      tipo_perfil: u?.tipo_perfil || "juridica",
      nome_perfil: u?.nome_perfil || u?.nome,
      nome: u?.nome,
    };
    const isValid = (d) => d && Array.isArray(d.empresas) && d.empresas.length > 0;
    let toSave = isValid(dados) ? normalizeMoneyInState(dados) : dados;
    toSave = isValid(toSave) ? normalizeStateForUser(toSave, profile) : toSave;
    const rollbackIds = await fetchRollbackIntegracaoLancamentoIds(query, stateOwnerId);
    toSave = stripLancamentosIntegracaoRollback(toSave, rollbackIds);
    if (isValid(toSave)) {
      toSave = normalizeStateForUser(toSave, profile);
    }

    const { rows: oldStateRows } = await query(
      "SELECT dados FROM estados WHERE usuario_id = $1",
      [stateOwnerId]
    );
    const validation = await validateStateSave(
      stateOwnerId,
      oldStateRows[0]?.dados,
      toSave
    );
    if (!validation.ok) {
      return res.status(403).json({
        error: validation.error,
        code: validation.code,
        recurso: validation.recurso,
        limite: validation.limite,
      });
    }

    await query(
      `INSERT INTO estados (usuario_id, dados)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id)
       DO UPDATE SET dados = $2, updated_at = NOW()`,
      [stateOwnerId, JSON.stringify(toSave)]
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
      `INSERT INTO usuarios (
         email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil,
         email_verificado, telefone_verificado
       )
       VALUES ($1, $2, $3, 'user', true, $4, $5, true, false)
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

// Estado de um tenant (super admin entra na conta)
app.get("/api/admin/users/:id/state", authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const alvo = await findUsuario(query, id);
    if (rejectProtectedAdmin(alvo, res, "acessada")) return;

    const { rows } = await query(
      "SELECT dados FROM estados WHERE usuario_id = $1",
      [id]
    );
    if (!rows.length) return res.json({ dados: {} });

    const profile = {
      tipo_perfil: alvo.tipo_perfil || "juridica",
      nome_perfil: alvo.nome_perfil || alvo.nome,
      nome: alvo.nome,
    };
    const dados = rows[0].dados;
    const isValid = (d) => d && Array.isArray(d.empresas) && d.empresas.length > 0;
    if (!isValid(dados)) {
      const initialState = createInitialState(profile.tipo_perfil, profile.nome_perfil || profile.nome || "Perfil");
      return res.json({ dados: initialState, profile });
    }
    res.json({ dados: normalizeStateForUser(dados, profile), profile });
  } catch (err) {
    console.error("admin/user state GET:", err.message);
    res.status(500).json({ error: "Erro ao carregar estado do cliente." });
  }
});

app.put("/api/admin/users/:id/state", authMiddleware, adminMiddleware, async (_req, res) => {
  return res.status(403).json({
    error: "O administrador só pode visualizar a conta do cliente, não alterar os dados.",
    view_only: true,
  });
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

// ─── Recorrências (despesas e receitas fixas) ─────────────────────────────────
app.use("/api/recorrencias", recorrenciasRouter);
app.use("/api/conexoes", conexoesRouter);
app.use("/api/importacoes", importacoesRouter);
app.use("/api/open-finance", openFinanceRouter);
app.use("/api/system", systemRouter);
app.use("/api/integracao-pf-pj", integracaoPfPjRouter);

// ─── WhatsApp Financeiro ──────────────────────────────────────────────────────
app.use("/api/whatsapp", whatsappRouter);
app.use("/api/whatsapp-admin", whatsappAdminRouter);

// Admin: lê recorrências de um tenant (somente leitura, modo impersonation)
app.get("/api/admin/users/:id/recorrencias", authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await query(
      `SELECT * FROM recorrencias WHERE usuario_id = $1
       ORDER BY CASE status WHEN 'ativa' THEN 0 WHEN 'pausada' THEN 1 ELSE 2 END,
                proxima_data ASC`,
      [id]
    );
    res.json({ recorrencias: rows });
  } catch (err) {
    console.error("admin/recorrencias:", err.message);
    res.status(500).json({ error: "Erro ao listar recorrências do cliente." });
  }
});

// Altera senha do próprio usuário (qualquer role)
app.patch("/api/auth/change-password", authMiddleware, async (req, res) => {
  const { senha_atual, nova_senha, otp_id, codigo } = req.body || {};
  if (!senha_atual || !nova_senha)
    return res.status(400).json({ error: "Informe a senha atual e a nova senha." });
  if (!otp_id || !codigo) {
    return res.status(400).json({
      error: "Confirme a alteração com o código OTP enviado.",
      requires_otp: true,
    });
  }
  if (nova_senha.length < 6)
    return res.status(400).json({ error: "Senha mínima: 6 caracteres." });

  try {
    const { validarOtp } = await import("./authSecurity/otp.js");
    const otpCheck = await validarOtp({
      otpId: otp_id,
      usuarioId: req.user.id,
      tipo: "acao_sensivel",
      codigo,
    });
    if (!otpCheck.ok) return res.status(400).json({ error: otpCheck.error });

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

// ─── SPA fallback (React Router) ─────────────────────────────────────────────
if (existsSync(DIST)) {
  app.get("/{*path}", (_req, res) => res.sendFile(join(DIST, "index.html")));
}

async function start() {
  try {
    console.log("Aplicando migrations…");
    await runMigrations();
  } catch (err) {
    console.error("Migrations:", err.message);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n✅ Gestor Financeiro API rodando em http://0.0.0.0:${PORT}`);
    console.log(`   Banco: ${process.env.DATABASE_URL ? "PostgreSQL (env)" : "PostgreSQL (padrão local)"}`);
    console.log(`   Modo:  ${process.env.NODE_ENV || "development"}\n`);
  });
}

start();
