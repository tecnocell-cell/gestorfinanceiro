import { query } from '../db.js';
import { authMiddleware, activeMiddleware } from '../middleware/auth.js';
import { createAndSendEmailVerificationToken, verifyEmailByToken } from './emailVerify.js';
import { requestPasswordReset, resetPasswordWithToken } from './passwordReset.js';
import { getLastSuccessfulLogin } from './loginAudit.js';

export function registerSecurityRoutes(app) {
  app.get('/api/auth/security', authMiddleware, activeMiddleware, async (req, res) => {
    try {
      const { rows } = await query(
        `SELECT id, email, nome, email_verificado, email_verificado_em, ultimo_acesso
         FROM usuarios WHERE id = $1`,
        [req.user.id]
      );
      const user = rows[0];
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const lastLogin = await getLastSuccessfulLogin(user.id);

      res.json({
        email: user.email,
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

      res.json({
        ok: true,
        message: 'Enviamos um link de verificação para seu e-mail.',
        ttl_hours: send.ttl_hours,
        dev_token: send.dev_token,
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
    const { token, nova_senha } = req.body || {};
    if (!token || !nova_senha) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
    }

    try {
      const result = await resetPasswordWithToken(token, nova_senha);
      if (!result.ok) return res.status(400).json({ error: result.error });

      res.json({ ok: true, message: 'Senha redefinida com sucesso.' });
    } catch (err) {
      console.error('reset-password:', err.message);
      res.status(500).json({ error: 'Erro ao redefinir senha.' });
    }
  });
}
