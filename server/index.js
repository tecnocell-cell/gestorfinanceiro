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
import { authMiddleware, adminMiddleware, adminMasterMiddleware, activeMiddleware, signToken } from "./middleware/auth.js";
import { subscriptionGuard } from "./middleware/subscriptionGuard.js";
import { startRenewalJobScheduler, runRenewalJob } from "./billing/billingRenewalJob.js";
import { findUsuario, rejectProtectedAdmin } from "./adminGuard.js";
import { createInitialState, normalizeStateForUser } from "./initialState.js";
import {
  fetchRollbackIntegracaoLancamentoIds,
  preserveIntegracaoLancamentosFromServer,
  stripLancamentosIntegracaoRollback,
} from "./integracaoPfPj/estadoMerge.js";
import { countPlanoContas } from "./initialState.js";
import { normalizeMoneyInState } from "./normalizeEstadoMoney.js";
import { runMigrations } from "./migrate.js";
import { registerAuthRoutes } from "./authPublic.js";
import { registerSecurityRoutes } from "./authSecurity/routes.js";
import { registerBillingRoutes } from "./billing/routes.js";
import { registerEmpresaRoutes, handleConviteInfo } from "./routes/empresa.js";
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
import { criarEnviarOtp, getPendingOtp } from "./authSecurity/otp.js";
import { OTP_TTL_MIN } from "./authSecurity/constants.js";
import { recorrenciasRouter } from "./routes/recorrencias.js";
import { conexoesRouter } from "./routes/conexoes.js";
import { importacoesRouter } from "./routes/importacoes.js";
import openFinanceRouter from "./routes/openFinance.js";
import { integracaoPfPjRouter } from "./routes/integracaoPfPj.js";
import whatsappRouter from "./routes/whatsapp.js";
import { whatsappAdminRouter } from "./routes/whatsappAdmin.js";
import systemRouter from "./routes/system.js";
import adminOverviewRouter from "./routes/adminOverview.js";
import adminSaasRouter from "./routes/adminSaas.js";
import adminBillingRouter from "./routes/adminBilling.js";
import adminPaymentConfigRouter from "./routes/adminPaymentConfig.js";
import adminReleaseRouter from "./routes/adminRelease.js";
import notificationsRouter from "./routes/notifications.js";
import betaRouter from "./routes/beta.js";
import { registerSupportRoutes } from "./routes/support.js";
import { getPublicPlanCatalog } from "./billing/planCatalogExport.js";
import { ambientesRouter } from "./routes/ambientes.js";
import {
  ensureAmbientePrincipal,
  listAmbientes,
  getAmbientePrincipal,
  setAmbienteAtualNoEstado,
  migrateToMultiambiente,
  rebuildEmpresasView,
  syncPortAmbienteFromView,
  mergeAmbienteIntoStored,
  buildEmptyAmbienteData,
} from "./ambientes/ambientesService.js";

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
app.get("/api/billing/catalog", (_req, res) => {
  res.json({ catalog: getPublicPlanCatalog() });
});
app.get("/api/status", (_req, res) =>
  res.json({ online: true, version: "2.0", port: PORT })
);

app.get("/api/empresa/convite-info", handleConviteInfo);

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

    // ADMIN_OTP_BYPASS: super admin ignora verificação OTP quando e-mail pode não estar configurado
    const adminBypass = user.role === "admin" && process.env.ADMIN_OTP_BYPASS === "true";
    if (adminBypass) {
      console.log(`[auth/otp] bypass admin habilitado para ${user.email}`);
    } else {
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
            otp = await getPendingOtp({ usuarioId: user.id, tipo: "login_suspeito" });
            if (!otp) {
              return res.status(429).json({
                error: err.message,
                requires_otp: true,
              });
            }
          } else if (err.code === "OTP_CANAL_INDISPONIVEL") {
            return res.status(503).json({ error: err.message });
          } else {
            // Falha ao enviar e-mail (Resend/SMTP) — não expõe erro interno
            console.error("[auth/otp] falha ao enviar código:", err.message);
            return res.status(503).json({
              error: "Não foi possível enviar o código de verificação. Tente novamente em instantes.",
            });
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
registerSupportRoutes(app);
app.use("/api/ambientes", ambientesRouter);

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

// ─── Multiambiente: helpers de estado ────────────────────────────────────────

/**
 * Mapeia tipo de ambiente para tipo_perfil de normalização.
 * pessoal → fisica (PF), empresa/outro → juridica (PJ).
 */
function tipoAmbienteParaTipoPerfil(tipoAmbiente) {
  return tipoAmbiente === "pessoal" ? "fisica" : "juridica";
}

/**
 * Retorna um profile de normalização cujo tipo_perfil reflete o tipo do ambiente,
 * não o tipo_perfil original do usuário.
 */
function profileParaAmbiente(profile, tipoAmbiente) {
  return { ...profile, tipo_perfil: tipoAmbienteParaTipoPerfil(tipoAmbiente) };
}

/**
 * Prepara o estado para multi-ambiente ANTES das normalizações:
 * - garante ambiente principal
 * - migra estrutura plana → porAmbiente (se necessário)
 * - reconstrói empresas[] como view do ambiente atual
 * Retorna { dados, ambienteAtualId, ambientes, needsMigrationSave, tipoAmbienteAtual }
 */
async function prepareMultiambienteState(dados, usuarioId, profile) {
  const ambiente = await ensureAmbientePrincipal(
    usuarioId,
    profile?.tipo_perfil || "juridica",
    profile?.nome_perfil || profile?.nome
  );
  const ambientes = await listAmbientes(usuarioId);
  const principal = ambiente || await getAmbientePrincipal(usuarioId);

  let ambienteAtualId =
    dados.ambienteAtualId && ambientes.some((a) => a.id === dados.ambienteAtualId)
      ? dados.ambienteAtualId
      : principal?.id || null;

  const ambienteAtual = ambientes.find((a) => a.id === ambienteAtualId);
  const tipoAmbienteAtual = ambienteAtual?.tipo || "pessoal";

  // Fase 2: migração de estrutura plana → porAmbiente
  let needsMigrationSave = false;
  let prepared = dados;
  if (!dados.porAmbiente && ambienteAtualId) {
    prepared = migrateToMultiambiente(dados, ambienteAtualId);
    needsMigrationSave = true;
  }
  prepared = { ...prepared, ambienteAtualId };

  // Reconstrói empresas[] a partir do ambiente atual
  prepared = rebuildEmpresasView(prepared, tipoAmbienteAtual);

  return { dados: prepared, ambienteAtualId, ambientes, needsMigrationSave, tipoAmbienteAtual };
}

/**
 * Injeta lista de ambientes no estado retornado ao cliente.
 * Remove porAmbiente do payload (cliente não precisa).
 */
function finalizeStateResponse(dados, ambientes, ambienteAtualId) {
  const { porAmbiente: _p, ...rest } = dados;
  return { ...rest, ambientes, ambienteAtualId };
}

// ─── Estado do App (protegido + conta ativa) ──────────────────────────────────
app.get("/api/state", authMiddleware, activeMiddleware, subscriptionGuard, attachEmpresaContext, requirePermission("state.read"), async (req, res) => {
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

    const isValid = (d) => d && Array.isArray(d.empresas) && d.empresas.length > 0;

    if (!rows.length) {
      const { profile, state: initialState } = await loadProfile();
      const { dados: prepared, ambienteAtualId, ambientes, needsMigrationSave } =
        await prepareMultiambienteState(initialState, stateOwnerId, profile);
      let toStore = needsMigrationSave ? syncPortAmbienteFromView(prepared) : prepared;
      await query(
        "INSERT INTO estados (usuario_id, dados) VALUES ($1, $2)",
        [stateOwnerId, JSON.stringify(toStore)]
      );
      return res.json({ dados: finalizeStateResponse(prepared, ambientes, ambienteAtualId), profile });
    }

    let dados = rows[0].dados;
    const { profile } = await loadProfile();

    // ── Fase 2: preparar multi-ambiente ANTES de normalizar ──────────────────
    let { dados: prepared, ambienteAtualId, ambientes, needsMigrationSave, tipoAmbienteAtual } =
      await prepareMultiambienteState(dados, stateOwnerId, profile);

    // ── Logging de diagnóstico multiambiente ─────────────────────────────────
    const empAtual = prepared.empresas?.[0];
    console.log(`[GET /state] user=${stateOwnerId.slice(0,8)} amb=${ambienteAtualId?.slice(0,8)} tipo=${tipoAmbienteAtual} lancs=${empAtual?.lancamentos?.length ?? 0} empresaTipo=${empAtual?.tipo}`);

    // ── Detecção e reparo de dados corrompidos por timer race ────────────────
    // Sintoma: ambiente 'empresa' mas porAmbiente contém dados PF (tipo='fisica' ou tem 'pessoa')
    if (tipoAmbienteAtual === 'empresa' && empAtual &&
        (empAtual.tipo === 'fisica' || (empAtual.pessoa && !empAtual.company))) {
      console.warn(`[GET /state] CORRUPÇÃO DETECTADA user=${stateOwnerId.slice(0,8)} amb=${ambienteAtualId?.slice(0,8)}: empresa tem dados PF (tipo=${empAtual.tipo}). Restaurando vazio PJ.`);
      const emptyPJ = buildEmptyAmbienteData('empresa', empAtual.nome || 'Empresa');
      prepared = {
        ...prepared,
        empresas: [emptyPJ],
        porAmbiente: {
          ...(prepared.porAmbiente || {}),
          [ambienteAtualId]: emptyPJ,
        },
      };
      needsMigrationSave = true;
    }

    dados = prepared;

    // Profile de normalização: tipo_perfil derivado do tipo do ambiente (não do usuário)
    const profileNorm = profileParaAmbiente(profile, tipoAmbienteAtual);

    if (isValid(dados)) {
      dados = normalizeMoneyInState(dados);
    }
    if (!isValid(dados)) {
      const tipoPerfil = tipoAmbienteParaTipoPerfil(tipoAmbienteAtual);
      const nomeAmbiente = profile?.nome_perfil || profile?.nome || "Perfil";
      const initialState = createInitialState(tipoPerfil, nomeAmbiente);
      const reset = syncPortAmbienteFromView(
        rebuildEmpresasView(migrateToMultiambiente(initialState, ambienteAtualId))
      );
      await query(
        `UPDATE estados SET dados = $2, updated_at = NOW() WHERE usuario_id = $1`,
        [stateOwnerId, JSON.stringify(reset)]
      );
      return res.json({ dados: finalizeStateResponse(reset, ambientes, ambienteAtualId), profile });
    }

    let normalized = normalizeStateForUser(dados, profileNorm);
    const rollbackIds = await fetchRollbackIntegracaoLancamentoIds(query, stateOwnerId);
    const stripped = stripLancamentosIntegracaoRollback(normalized, rollbackIds);
    if (stripped !== normalized) {
      normalized = normalizeStateForUser(stripped, profileNorm);
    }

    // ── Fase 2: sincronizar empresas[0] → porAmbiente após normalização ──────
    normalized = syncPortAmbienteFromView(normalized);

    // Comparação de segurança: usa dados APÓS prepareMultiambienteState (view do ambiente atual),
    // não rawDados do banco (que contém todos os ambientes acumulados em porAmbiente).
    // Isso evita falso positivo "48→26 categorias" que bloqueava saves.
    const planoAntes = countPlanoContas(dados); // dados = prepared (ambiente atual)
    const planoDepois = countPlanoContas(normalized);
    const normalizeSeguro = planoDepois >= planoAntes;
    const rawDados = rows[0].dados;
    const dadosChanged = JSON.stringify(normalized) !== JSON.stringify(rawDados);

    if (normalizeSeguro && (dadosChanged || needsMigrationSave)) {
      await query(
        `UPDATE estados SET dados = $2, updated_at = NOW() WHERE usuario_id = $1`,
        [stateOwnerId, JSON.stringify(normalized)]
      );
    } else if (!normalizeSeguro) {
      console.warn(
        `GET /state usuario ${stateOwnerId}: normalização ignorada (planoContas ${planoAntes} → ${planoDepois})`
      );
      // Mantém dados preparados (ambiente atual isolado), sem sobrescrever no banco
      normalized = dados;
      normalized = syncPortAmbienteFromView(normalized);
    } else if (needsMigrationSave) {
      // dadosChanged é false mas migração precisa ser salva
      await query(
        `UPDATE estados SET dados = $2, updated_at = NOW() WHERE usuario_id = $1`,
        [stateOwnerId, JSON.stringify(normalized)]
      );
    }

    res.json({ dados: finalizeStateResponse(normalized, ambientes, ambienteAtualId), profile });
  } catch (err) {
    console.error("get state:", err.message);
    res.status(500).json({ error: "Erro ao carregar estado." });
  }
});

app.put("/api/state", authMiddleware, activeMiddleware, subscriptionGuard, attachEmpresaContext, requirePermission("state.write"), async (req, res) => {
  let { dados } = req.body || {};
  if (!dados) return res.status(400).json({ error: "Campo 'dados' obrigatório." });
  // Strip de campos computados pelo servidor — não persistir no banco
  if (dados.ambientes !== undefined) {
    const { ambientes: _a, ...rest } = dados;
    dados = rest;
  }

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

    // Determina tipo do ambiente atual para normalização correta
    const ambienteAtualIdPut = dados.ambienteAtualId;
    let tipoAmbientePut = "pessoal";
    if (ambienteAtualIdPut) {
      const { rows: ambRows } = await query(
        "SELECT tipo FROM ambientes_financeiros WHERE id = $1 AND usuario_id = $2",
        [ambienteAtualIdPut, stateOwnerId]
      );
      tipoAmbientePut = ambRows[0]?.tipo || "pessoal";
    }
    const profileNorm = profileParaAmbiente(profile, tipoAmbientePut);

    const isValid = (d) => d && Array.isArray(d.empresas) && d.empresas.length > 0;
    let toSave = isValid(dados) ? normalizeMoneyInState(dados) : dados;
    toSave = isValid(toSave) ? normalizeStateForUser(toSave, profileNorm) : toSave;
    const rollbackIds = await fetchRollbackIntegracaoLancamentoIds(query, stateOwnerId);
    toSave = stripLancamentosIntegracaoRollback(toSave, rollbackIds);
    if (isValid(toSave)) {
      toSave = normalizeStateForUser(toSave, profileNorm);
    }

    const { rows: oldStateRows } = await query(
      "SELECT dados FROM estados WHERE usuario_id = $1",
      [stateOwnerId]
    );
    const serverDados = oldStateRows[0]?.dados;
    if (serverDados && isValid(toSave)) {
      toSave = preserveIntegracaoLancamentosFromServer(serverDados, toSave);
      if (isValid(toSave)) {
        toSave = normalizeStateForUser(toSave, profileNorm);
      }
    }
    const validation = await validateStateSave(
      stateOwnerId,
      serverDados,
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

    // ── Fase 2: salvar somente no ambiente atual, preservando outros ambientes ─
    const ambienteAtualId = ambienteAtualIdPut || serverDados?.ambienteAtualId;
    const empresaAtual = (toSave.empresas || [])[0];

    // Guard: bloqueia PUT se o ambiente não foi inicializado em porAmbiente.
    // Isso impede que um PUT em race condition (timer disparado durante criação de ambiente)
    // grave dados de outro ambiente em uma chave que ainda não existe no servidor.
    if (
      ambienteAtualId &&
      serverDados?.porAmbiente &&
      !(ambienteAtualId in serverDados.porAmbiente)
    ) {
      console.warn(
        `[PUT /state] BLOQUEADO user=${stateOwnerId.slice(0,8)} amb=${ambienteAtualId.slice(0,8)}: ` +
        `ambiente não existe em porAmbiente — race condition durante criação detectada.`
      );
      return res.status(409).json({
        error: 'Ambiente ainda não inicializado. Recarregue o estado antes de salvar.',
        code: 'AMBIENTE_NAO_INICIALIZADO',
      });
    }

    let finalToStore = toSave;
    if (ambienteAtualId && empresaAtual && serverDados) {
      // Guard primário: tipo explicitamente PF em ambiente empresa
      // Guard secundário: sobreposição de IDs de lançamentos com outro ambiente (timer race)
      //   - Detecta casos onde normalizeStateForUser converteu PF→PJ antes deste check
      const tipoConflito = tipoAmbientePut === 'empresa' &&
        (empresaAtual.tipo === 'fisica' || (empresaAtual.pessoa && !empresaAtual.company));

      let idConflito = false;
      if (!tipoConflito && tipoAmbientePut === 'empresa' && serverDados.porAmbiente) {
        const idsEntrando = new Set(
          (empresaAtual.lancamentos || []).map((l) => l.id).filter(Boolean)
        );
        if (idsEntrando.size > 0) {
          // Verifica se os IDs entrando já existem em outro ambiente (pessoal)
          for (const [outroId, outroAmb] of Object.entries(serverDados.porAmbiente)) {
            if (outroId === ambienteAtualId) continue;
            const idsOutro = (outroAmb?.lancamentos || []).map((l) => l.id).filter(Boolean);
            const sobrepostos = idsOutro.filter((id) => idsEntrando.has(id));
            const pctSobreposicao = sobrepostos.length / idsEntrando.size;
            if (pctSobreposicao >= 0.5) {
              idConflito = true;
              console.warn(
                `[PUT /state] BLOQUEADO user=${stateOwnerId.slice(0,8)} amb=${ambienteAtualId.slice(0,8)}: ` +
                `${sobrepostos.length}/${idsEntrando.size} lançamentos (${Math.round(pctSobreposicao*100)}%) ` +
                `já existem no ambiente ${outroId.slice(0,8)}. Timer race detectado.`
              );
              break;
            }
          }
        }
      }

      if (tipoConflito || idConflito) {
        console.warn(`[PUT /state] BLOQUEADO user=${stateOwnerId.slice(0,8)} amb=${ambienteAtualId.slice(0,8)}: tentativa de salvar dados PF (tipo=${empresaAtual.tipo}) em ambiente empresa. Timer race detectado.`);
        return res.status(409).json({
          error: 'Conflito de ambiente: dados PF não podem ser salvos em ambiente empresa.',
          code: 'AMBIENTE_TIPO_CONFLITO',
        });
      }

      // Migra serverDados se ainda não tiver porAmbiente
      const migratedServer = serverDados.porAmbiente
        ? serverDados
        : migrateToMultiambiente(serverDados, ambienteAtualId);

      finalToStore = mergeAmbienteIntoStored(
        migratedServer,
        empresaAtual,
        ambienteAtualId,
        toSave.filterPeriodo
      );
    } else {
      // Fallback: sync porAmbiente a partir da view (usuário sem ambienteAtualId)
      finalToStore = syncPortAmbienteFromView(toSave);
    }

    await query(
      `INSERT INTO estados (usuario_id, dados)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id)
       DO UPDATE SET dados = $2, updated_at = NOW()`,
      [stateOwnerId, JSON.stringify(finalToStore)]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("put state:", err.message);
    res.status(500).json({ error: "Erro ao salvar estado." });
  }
});

// ─── Reparo de isolamento multiambiente ──────────────────────────────────────
//
// POST /api/repair/ambiente-empresa
// Limpa lançamentos do ambiente empresa que são cópias do ambiente pessoal.
// Preserva lançamentos com tipoOrigem/tipoDestino de repasse entre ambientes.
// Seguro: não remove dados do ambiente pessoal, não altera assinaturas.
app.post(
  '/api/repair/ambiente-empresa',
  authMiddleware, activeMiddleware, attachEmpresaContext,
  async (req, res) => {
    try {
      const stateOwnerId = req.stateOwnerId;
      const { rows } = await query('SELECT dados FROM estados WHERE usuario_id = $1', [stateOwnerId]);
      if (!rows.length) return res.status(404).json({ error: 'Estado não encontrado.' });

      const dados = rows[0].dados;
      if (!dados.porAmbiente) return res.json({ ok: true, message: 'Nenhum porAmbiente encontrado. Nada a reparar.' });

      // Monta conjunto de IDs de lançamentos de todos os ambientes pessoal
      const ambientes = await listAmbientes(stateOwnerId);
      const ambientesEmpresa = ambientes.filter((a) => a.tipo === 'empresa');
      const ambientesPessoal = ambientes.filter((a) => a.tipo === 'pessoal');

      if (!ambientesEmpresa.length) return res.json({ ok: true, message: 'Nenhum ambiente empresa encontrado.' });

      const idsPessoal = new Set();
      for (const ap of ambientesPessoal) {
        const ambData = dados.porAmbiente[ap.id];
        for (const l of ambData?.lancamentos || []) {
          if (l?.id) idsPessoal.add(l.id);
        }
      }

      let totalRemovidos = 0;
      const novoPorAmbiente = { ...dados.porAmbiente };

      for (const ae of ambientesEmpresa) {
        const ambData = dados.porAmbiente[ae.id];
        if (!ambData) continue;

        const lancamentosOriginais = ambData.lancamentos || [];
        // Mantém apenas lançamentos que NÃO existem no ambiente pessoal
        // OU que são repasses explícitos (tipoOrigem/tipoDestino contém 'empresa' ou 'pessoal')
        const lancamentosFiltrados = lancamentosOriginais.filter((l) => {
          if (!l?.id) return false;
          if (!idsPessoal.has(l.id)) return true; // não está no pessoal — manter
          // Está no pessoal mas é um repasse explícito — manter CÓPIA no empresa
          const isRepasse =
            String(l.tipoOrigem || '').toLowerCase().includes('empresa') ||
            String(l.tipoOrigem || '').toLowerCase().includes('pessoal') ||
            String(l.tipoDestino || '').toLowerCase().includes('empresa') ||
            String(l.tipoDestino || '').toLowerCase().includes('pessoal') ||
            String(l.operacao || '').toLowerCase().includes('transf');
          return isRepasse;
        });

        totalRemovidos += lancamentosOriginais.length - lancamentosFiltrados.length;
        novoPorAmbiente[ae.id] = { ...ambData, lancamentos: lancamentosFiltrados };
      }

      if (totalRemovidos === 0) {
        return res.json({ ok: true, message: 'Nenhum lançamento contaminado encontrado. Ambientes já estão isolados.' });
      }

      // Reconstrói view para o ambiente atual
      const repairedDados = { ...dados, porAmbiente: novoPorAmbiente };
      const rebuilt = rebuildEmpresasView(repairedDados);

      await query(
        'UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2',
        [JSON.stringify(rebuilt), stateOwnerId]
      );

      console.log(`[REPAIR] user=${stateOwnerId.slice(0,8)}: removidos ${totalRemovidos} lançamentos contaminados de ambientes empresa.`);
      res.json({ ok: true, totalRemovidos, message: `Reparo concluído: ${totalRemovidos} lançamento(s) removido(s) do(s) ambiente(s) empresa.` });
    } catch (err) {
      console.error('POST /api/repair/ambiente-empresa:', err.message);
      res.status(500).json({ error: 'Erro ao reparar isolamento.' });
    }
  }
);

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

// ─── Rotas core — protegidas pelo subscriptionGuard ──────────────────────────
// authMiddleware é necessário antes do guard pois os sub-routers têm auth interno
app.use("/api/recorrencias", authMiddleware, subscriptionGuard, recorrenciasRouter);
app.use("/api/conexoes", authMiddleware, subscriptionGuard, conexoesRouter);
app.use("/api/importacoes", authMiddleware, subscriptionGuard, importacoesRouter);
app.use("/api/open-finance", authMiddleware, subscriptionGuard, openFinanceRouter);
app.use("/api/system", systemRouter);
app.use("/api/admin", adminOverviewRouter);
app.use("/api/admin", adminSaasRouter);
app.use("/api/admin", adminBillingRouter);
app.use("/api/admin", adminPaymentConfigRouter);
app.use("/api/admin", adminReleaseRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/beta", betaRouter);
app.use("/api/integracao-pf-pj", authMiddleware, subscriptionGuard, integracaoPfPjRouter);

// ─── WhatsApp Financeiro ──────────────────────────────────────────────────────
//
// ⚠️  IMPORTANTE — NÃO ALTERAR ESTE BLOCO SEM LER ABAIXO ⚠️
//
// O webhook POST /api/whatsapp/webhook/:instanceName é chamado pela Evolution API
// (gateway WhatsApp externo). A Evolution NÃO envia Bearer token — portanto este
// endpoint NÃO pode passar por authMiddleware nem subscriptionGuard.
//
// A segurança do webhook é feita INTERNAMENTE pelo handler via validateWebhookAuth,
// que valida o secret de cada instância (header x-centerflow-webhook-secret ou
// query ?secret). Alterar ou remover o bypass abaixo quebra todo o WhatsApp
// Financeiro (mensagens, lançamentos, comprovantes, confirmações).
//
// Demais rotas /api/whatsapp (connect, status, qrcode, etc.) continuam protegidas
// por authMiddleware + subscriptionGuard na linha seguinte.
//
app.use("/api/whatsapp", (req, res, next) => {
  if (req.method === "POST" && req.path.startsWith("/webhook/")) {
    return whatsappRouter(req, res, next);
  }
  next();
});
app.use("/api/whatsapp", authMiddleware, subscriptionGuard, whatsappRouter);
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

// ─── Admin: job de renovação manual ──────────────────────────────────────────
app.post("/api/admin/billing/run-renewal-job", authMiddleware, adminMasterMiddleware, async (_req, res) => {
  try {
    const resultado = await runRenewalJob();
    res.json({ ok: true, ...resultado });
  } catch (err) {
    console.error("admin/run-renewal-job:", err.message);
    res.status(500).json({ error: "Erro ao executar job de renovação.", detalhe: err.message });
  }
});

// ─── SPA fallback (React Router) — não capturar /api/* ───────────────────────
if (existsSync(DIST)) {
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(DIST, "index.html")));
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
    startRenewalJobScheduler();
  });
}

start();
