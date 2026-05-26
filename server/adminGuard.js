/** Proteções para contas super admin (role = 'admin') em operações multi-tenant. */

export async function findUsuario(query, id) {
  const { rows } = await query(
    "SELECT id, email, nome, role, ativo, tipo_perfil, nome_perfil FROM usuarios WHERE id = $1",
    [id]
  );
  return rows[0] || null;
}

export function rejectProtectedAdmin(user, res, action = "alterada") {
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return true;
  }
  if (user.role === "admin") {
    res.status(403).json({
      error: `Conta de super administrador não pode ser ${action}.`,
    });
    return true;
  }
  return false;
}
