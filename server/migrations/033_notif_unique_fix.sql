-- Corrige índice parcial (ON CONFLICT exige constraint completa)
DROP INDEX IF EXISTS idx_notif_usuario_codigo;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_usuario_codigo
  ON usuario_notificacoes(usuario_id, codigo);
