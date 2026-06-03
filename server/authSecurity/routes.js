import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { authMiddleware, activeMiddleware } from '../middleware/auth.js';
import { createAndSendEmailVerificationToken, verifyEmailByToken } from './emailVerify.js';
import { requestPasswordReset, resetPasswordWithToken, resetPasswordWithOtp } from './passwordReset.js';
import { getLastSuccessfulLogin, getRecentSuccessfulLogins } from './loginAudit.js';
import { getEmailConfigStatus } from '../notify.js';
import {
  criarEnviarOtp,
  validarOtp,
  getUsuarioForOtp,
} from './otp.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_MUDE_ANTES_DE_USAR';

function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
    } catch {
      /* token inválido — rotas públicas seguem sem usuário */
    }
  }
  next();
}

export function registerSecurityRoutes(app) {
  app.get('/api/auth/security', authMiddleware, activeMiddleware, async (req, res) => {
    try {
      const { rows } = await query(
        `SELECT id, email, nome, telefone, telefone_verificado,
                email_verificado, email_verificado_em, ultimo_acesso
         FROM usuarios WHERE id = $1`,
        [req.user.id]
      );
      const user = rows[0];
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const lastLogin = await getLastSuccessfulLogin(user.id);
      const recentLogins = await getRecentSuccessfulLogins(user.id, 5);
      const emailStatus = getEmailConfigStatus();

      res.json({
        email: user.email,
        telefone: user.telefone || '',
        telefone_verificado: Boolean(user.telefone_verificado),
        email_verificado: Boolean(user.email_verificado),
        email_verificado_em: user.email_verificado_em,
        ultimo_acesso: user.ultimo_acesso,
        ultimo_login: lastLogin
          ? {
              ip: lastLogin.ip,
              user_agent: lastLogin.user_agent,
              em: lastLogin.created_at,
            }
          : null,
        logins_recentes: recentLogins.map((l) => ({
          ip: l.ip,
          user_agent: l.user_agent,
          em: l.created_at,
        })),
        email_configurado: emailStatus.configured,
        email_provider: emailStatus.provider,
      });
    } catch (err) {
      console.error('auth/security:', err.message);
      res.status(500).json({ error: 'Erro ao carregar dados de segurança.' });
    }
  });

  app.post('/api/auth/send-verification', authMiddleware, activeMiddleware, async (req, res) => {
    try {
      const { rows } = await query(
        `SELECT id, email, nome, email_verificado FROM usuarios WHERE id = $1`,
        [req.user.id]
      );
      const user = rows[0];
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
      if (user.email_verificado) {
        return res.status(400).json({ error: 'E-mail já verificado.' });
      }

      const send = await createAndSendEmailVerificationToken(user.id, {
        email: user.email,
        nome: user.nome,
      });

      const emailStatus = getEmailConfigStatus();

      res.json({
        ok: true,
        message: emailStatus.configured
          ? 'Enviamos um link de verificação para seu e-mail.'
          : 'Envio de e-mail não configurado. Use o token abaixo (ambiente de teste).',
        ttl_hours: send.ttl_hours,
        dev_token: send.dev_token,
        email_configurado: emailStatus.configured,
      });
    } catch (err) {
      console.error('send-verification:', err.message);
      res.status(500).json({ error: 'Erro ao enviar verificação.' });
    }
  });

  app.post('/api/auth/verify-email', async (req, res) => {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Token obrigatório.' });

    try {
      const result = await verifyEmailByToken(token);
      if (!result.ok) return res.status(400).json({ error: result.error });

      res.json({
        ok: true,
        message: 'E-mail verificado com sucesso.',
        email: result.email,
      });
    } catch (err) {
      console.error('verify-email:', err.message);
      res.status(500).json({ error: 'Erro ao verificar e-mail.' });
    }
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body || {};
    try {
      const result = await requestPasswordReset(email);
      res.json(result);
    } catch (err) {
      console.error('forgot-password:', err.message);
      res.status(500).json({ error: 'Erro ao solicitar recuperação.' });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const { token, nova_senha, otp_id, codigo, email } = req.body || {};
    if (!nova_senha) {
      return res.status(400).json({ error: 'Nova senha é obrigatória.' });
    }

    try {
      if (otp_id && codigo) {
        const result = await resetPasswordWithOtp({ otpId: otp_id, codigo, novaSenha: nova_senha, email });
        if (!result.ok) return res.status(400).json({ error: result.error });
        return res.json({ ok: true, message: 'Senha redefinida com sucesso.' });
      }

      if (!token) {
        return res.status(400).json({ error: 'Token ou código OTP é obrigatório.' });
      }

      const result = await resetPasswordWithToken(token, nova_senha);
      if (!result.ok) return res.status(400).json({ error: result.error });

      res.json({ ok: true, message: 'Senha redefinida com sucesso.' });
    } catch (err) {
      console.error('reset-password:', err.message);
      res.status(500).json({ error: 'Erro ao redefinir senha.' });
    }
  });

  app.patch('/api/auth/security/telefone', authMiddleware, activeMiddleware, async (req, res) => {
    const { telefone } = req.body || {};
    const digits = String(telefone || '').replace(/\D/g, '');
    if (digits.length < 10) {
      return res.status(400).json({ error: 'Informe um telefone válido com DDD.' });
    }

    try {
      await query(
        `UPDATE usuarios SET telefone = $1, telefone_verificado = false, updated_at = NOW()
         WHERE id = $2`,
        [digits, req.user.id]
      );
      res.json({ ok: true, telefone: digits, telefone_verificado: false });
    } catch (err) {
      console.error('security/telefone:', err.message);
      res.status(500).json({ error: 'Erro ao salvar telefone.' });
    }
  });

  app.post('/api/auth/otp/send', optionalAuth, async (req, res) => {
    const { tipo, canal, email, otp_id } = req.body || {};
    let usuarioId = req.user?.id;

    try {
      if (!usuarioId) {
        if (otp_id) {
          const u = await getUsuarioForOtp({ otpId: otp_id });
          if (!u) return res.status(400).json({ error: 'Sessão OTP inválida.' });
          usuarioId = u.id;
        } else if (email && tipo === 'reset_senha') {
          const u = await getUsuarioForOtp({ email });
          if (!u) {
            return res.json({
              ok: true,
              message: 'Se o e-mail existir, enviaremos um código.',
            });
          }
          usuarioId = u.id;
        } else {
          return res.status(401).json({ error: 'Autenticação ou e-mail necessário.' });
        }
      }

      if (!tipo) return res.status(400).json({ error: 'tipo é obrigatório.' });

      if (['acao_sensivel', 'verificar_telefone'].includes(tipo) && !req.user?.id) {
        return res.status(401).json({ error: 'Autenticação necessária.' });
      }

      const result = await criarEnviarOtp({
        usuarioId,
        tipo,
        canalPreferido: canal === 'whatsapp' ? 'whatsapp' : 'email',
      });

      res.json({
        ok: true,
        message: 'Código enviado.',
        ...result,
      });
    } catch (err) {
      if (err.code === 'OTP_RATE_LIMIT') {
        return res.status(429).json({ error: err.message });
      }
      console.error('otp/send:', err.message);
      res.status(500).json({ error: err.message || 'Erro ao enviar código.' });
    }
  });

  app.post('/api/auth/otp/verify', optionalAuth, async (req, res) => {
    const { otp_id, codigo, tipo, email } = req.body || {};

    if (!otp_id || !codigo) {
      return res.status(400).json({ error: 'otp_id e codigo são obrigatórios.' });
    }

    try {
      let usuarioId = req.user?.id;
      if (!usuarioId && email) {
        const u = await getUsuarioForOtp({ email });
        usuarioId = u?.id;
      }

      const result = await validarOtp({
        otpId: otp_id,
        usuarioId: usuarioId || undefined,
        tipo,
        codigo,
      });

      if (!result.ok) {
        return res.status(400).json({ error: result.error });
      }

      if (tipo === 'login_suspeito') {
        const { rows } = await query(
          `SELECT id, email, nome, role, tipo_perfil, nome_perfil, ativo
           FROM usuarios WHERE id = $1`,
          [result.usuario_id]
        );
        const user = rows[0];
        if (!user?.ativo) {
          return res.status(403).json({ error: 'Conta desativada.' });
        }

        const { resetLoginAttempts } = await import('./bruteForce.js');
        const { recordLoginAudit } = await import('./loginAudit.js');
        const { getRequestMeta } = await import('./requestMeta.js');
        await resetLoginAttempts(user.id);
        await recordLoginAudit({
          usuarioId: user.id,
          ip: getRequestMeta(req).ip,
          userAgent: getRequestMeta(req).userAgent,
          sucesso: true,
        });
        await query('UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1', [user.id]);

        const { signToken } = await import('../middleware/auth.js');
        const token = signToken({ id: user.id, email: user.email, role: user.role });

        return res.json({
          ok: true,
          verified: true,
          token,
          user: {
            id: user.id,
            email: user.email,
            nome: user.nome,
            role: user.role,
            tipo_perfil: user.tipo_perfil || 'juridica',
            nome_perfil: user.nome_perfil || user.nome,
          },
        });
      }

      if (tipo === 'verificar_telefone') {
        await query(
          `UPDATE usuarios SET telefone_verificado = true, updated_at = NOW() WHERE id = $1`,
          [result.usuario_id]
        );
      }

      res.json({ ok: true, verified: true, usuario_id: result.usuario_id });
    } catch (err) {
      console.error('otp/verify:', err.message);
      res.status(500).json({ error: 'Erro ao validar código.' });
    }
  });
}
