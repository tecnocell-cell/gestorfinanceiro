import jwt from "jsonwebtoken";
import { query } from "../db.js";

const SECRET = process.env.JWT_SECRET || "dev_secret_MUDE_ANTES_DE_USAR";

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

// Verifica se o usuário autenticado é admin
export function adminMiddleware(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }
  next();
}

// Verifica se a conta está ativa (bloqueia usuários desativados)
export async function activeMiddleware(req, res, next) {
  try {
    const { rows } = await query(
      "SELECT ativo FROM usuarios WHERE id = $1",
      [req.user.id]
    );
    if (!rows.length || !rows[0].ativo) {
      return res.status(403).json({ error: "Conta desativada. Entre em contato com o administrador." });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Erro ao verificar conta." });
  }
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}
