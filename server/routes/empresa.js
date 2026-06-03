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
import { sendEmpresaConviteEmail } from '../notify.js';
import { query } from '../db.js';

const router = Router();

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

      await sendEmpresaConviteEmail({
        email: payload.convite.email,
        empresaNome: payload.empresaNome,
        perfil: payload.convite.perfil,
        token: payload.convite.token,
        convidadoPorNome: actor[0]?.nome,
      });

      res.status(201).json({
        ok: true,
        message: 'Convite enviado.',
        email: payload.convite.email,
        perfil: payload.convite.perfil,
        expiresAt: payload.convite.expires_at,
        dev_token: payload.devToken,
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
  app.use('/api/empresa', router);
}
