/**
 * Multiusuário PJ — rotas de equipe (Etapa 6.7)
 */
import { Router } from 'express';
import { authMiddleware, activeMiddleware } from '../middleware/auth.js';
import {
  attachEmpresaContext,
  requirePermission,
  getUserPermissions,
  handlePermissionError,
  PermissionError,
} from '../auth/permissions.js';
import {
  listMembros,
  convidarMembro,
  aceitarConvite,
  atualizarMembro,
  removerMembro,
  isPlanAccessError,
} from '../empresa/empresaService.js';
import { sendEmpresaConviteEmail, getEmailConfigStatus } from '../notify.js';
import { query } from '../db.js';

const router = Router();

/** GET /api/empresa/convite-info?token=... — público, sem JWT (Etapa 7.1) */
export async function handleConviteInfo(req, res) {
  const token = String(req.query.token || req.query.t || '').trim();
  try {
    if (!token) {
      throw new PermissionError('Token do convite é obrigatório.', { status: 400 });
    }
    const { rows } = await query(
      `SELECT c.email, c.perfil, c.expires_at, c.accepted_at,
              u.nome_perfil AS empresa_nome, u.nome AS owner_nome
       FROM convites_empresa c
       JOIN usuarios u ON u.id = c.empresa_usuario_id
       WHERE c.token = $1`,
      [token]
    );
    const row = rows[0];
    if (!row) {
      throw new PermissionError('Convite não encontrado ou inválido.', { status: 404 });
    }
    const expired = new Date(row.expires_at) < new Date();
    res.json({
      ok: true,
      convite: {
        empresaNome: row.empresa_nome || row.owner_nome || 'Empresa',
        perfil: row.perfil,
        emailConvidado: row.email,
        expiresAt: row.expires_at,
        accepted: Boolean(row.accepted_at),
        expired,
        valid: !row.accepted_at && !expired,
      },
    });
  } catch (err) {
    if (handlePermissionError(res, err)) return;
    console.error('empresa/convite-info:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Convite inválido.' });
  }
}

router.post(
  '/aceitar-convite',
  authMiddleware,
  activeMiddleware,
  async (req, res) => {
    const { token } = req.body || {};
    try {
      const result = await aceitarConvite({
        token,
        membroUsuarioId: req.user.id,
      });
      const perms = await getUserPermissions(req.user.id);
      res.json({ ok: true, ...result, permissions: perms });
    } catch (err) {
      if (handlePermissionError(res, err)) return;
      if (isPlanAccessError(err)) {
        return res.status(err.status).json({
          error: err.message,
          code: err.code,
          recurso: err.recurso,
        });
      }
      console.error('empresa/aceitar-convite:', err.message);
      res.status(500).json({ error: 'Erro ao aceitar convite.' });
    }
  }
);

router.use(authMiddleware, activeMiddleware, attachEmpresaContext);

router.get('/context', async (req, res) => {
  try {
    const perms = await getUserPermissions(req.user.id);
    res.json({
      empresaOwnerId: req.empresaContext.empresaOwnerId,
      perfil: req.empresaContext.perfil,
      isOwner: req.empresaContext.isOwner,
      isMember: req.empresaContext.isMember,
      permissions: perms.permissions,
      canWrite: perms.canWrite,
      viewOnly: perms.viewOnly,
    });
  } catch (err) {
    console.error('empresa/context:', err.message);
    res.status(500).json({ error: 'Erro ao carregar permissões.' });
  }
});

router.get(
  '/membros',
  requirePermission('equipe.view'),
  async (req, res) => {
    try {
      const membros = await listMembros(req.empresaContext.empresaOwnerId);
      res.json({ membros });
    } catch (err) {
      if (handlePermissionError(res, err)) return;
      console.error('empresa/membros GET:', err.message);
      res.status(500).json({ error: 'Erro ao listar membros.' });
    }
  }
);

router.post(
  '/convidar',
  requirePermission('equipe.manage'),
  async (req, res) => {
    const { email, perfil } = req.body || {};
    try {
      const { rows: actor } = await query('SELECT nome FROM usuarios WHERE id = $1', [
        req.user.id,
      ]);
      const payload = await convidarMembro({
        empresaOwnerId: req.empresaContext.empresaOwnerId,
        email,
        perfil,
        convidadoPorId: req.user.id,
      });

      const mailResult = await sendEmpresaConviteEmail({
        email: payload.convite.email,
        empresaNome: payload.empresaNome,
        perfil: payload.convite.perfil,
        token: payload.convite.token,
        convidadoPorNome: actor[0]?.nome,
      });

      const emailStatus = getEmailConfigStatus();
      const emailSent = Boolean(mailResult.configured && !mailResult.dev);

      res.status(201).json({
        ok: true,
        message: emailSent
          ? 'Convite enviado por e-mail.'
          : 'Convite gerado. Copie o token manualmente (e-mail não configurado).',
        email: payload.convite.email,
        perfil: payload.convite.perfil,
        expiresAt: payload.convite.expires_at,
        email_configurado: emailStatus.configured,
        email_sent: emailSent,
        manual_token: emailSent ? undefined : payload.convite.token,
        dev_token: payload.devToken || (!emailSent ? payload.convite.token : undefined),
      });
    } catch (err) {
      if (handlePermissionError(res, err)) return;
      if (isPlanAccessError(err)) {
        return res.status(err.status).json({
          error: err.message,
          code: err.code,
          recurso: err.recurso,
          limite: err.limite,
        });
      }
      console.error('empresa/convidar:', err.message);
      res.status(500).json({ error: 'Erro ao enviar convite.' });
    }
  }
);

router.patch(
  '/membros/:id',
  requirePermission('equipe.manage'),
  async (req, res) => {
    const { perfil } = req.body || {};
    try {
      const membro = await atualizarMembro({
        empresaOwnerId: req.empresaContext.empresaOwnerId,
        membroRowId: req.params.id,
        perfil,
        actorId: req.user.id,
      });
      res.json({ ok: true, membro });
    } catch (err) {
      if (handlePermissionError(res, err)) return;
      console.error('empresa/membros PATCH:', err.message);
      res.status(500).json({ error: 'Erro ao atualizar membro.' });
    }
  }
);

router.delete(
  '/membros/:id',
  requirePermission('equipe.manage'),
  async (req, res) => {
    try {
      await removerMembro({
        empresaOwnerId: req.empresaContext.empresaOwnerId,
        membroRowId: req.params.id,
        actorId: req.user.id,
      });
      res.json({ ok: true });
    } catch (err) {
      if (handlePermissionError(res, err)) return;
      console.error('empresa/membros DELETE:', err.message);
      res.status(500).json({ error: 'Erro ao remover membro.' });
    }
  }
);

export function registerEmpresaRoutes(app) {
  app.get('/api/empresa/convite-info', handleConviteInfo);
  app.use('/api/empresa', router);
}
