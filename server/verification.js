import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { query } from "./db.js";
import { sendVerificationEmail, sendVerificationSms, codeTtlMinutes } from "./notify.js";

export function generateCode() {
  return String(randomInt(100000, 999999));
}

export async function createAndSendVerification(usuarioId, canal, { email, nome, telefone }) {
  const codigo = generateCode();
  const hash = await bcrypt.hash(codigo, 10);
  const ttl = codeTtlMinutes();

  await query(
    `UPDATE verificacoes SET usado = true WHERE usuario_id = $1 AND usado = false`,
    [usuarioId]
  );

  await query(
    `INSERT INTO verificacoes (usuario_id, canal, codigo_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + ($4::text || ' minutes')::interval)`,
    [usuarioId, canal, hash, String(ttl)]
  );

  if (canal === "sms") {
    await sendVerificationSms(telefone, codigo);
  } else {
    await sendVerificationEmail(email, nome, codigo);
  }

  const payload = { ttl, canal };
  if (process.env.NODE_ENV !== "production") {
    payload.devCode = codigo;
  }
  return payload;
}

export async function verifyCode(email, codigo, canal = "email") {
  const { rows } = await query(
    `SELECT u.id, u.email, u.nome, u.role, u.tipo_perfil, u.nome_perfil,
            v.codigo_hash, v.expires_at
     FROM usuarios u
     JOIN verificacoes v ON v.usuario_id = u.id
     WHERE u.email = $1 AND v.canal = $2 AND v.usado = false
     ORDER BY v.created_at DESC
     LIMIT 1`,
    [email.toLowerCase(), canal]
  );

  const row = rows[0];
  if (!row) return { ok: false, error: "Código inválido ou expirado." };
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, error: "Código expirado. Solicite um novo código." };
  }
  if (!(await bcrypt.compare(String(codigo).trim(), row.codigo_hash))) {
    return { ok: false, error: "Código incorreto." };
  }

  await query(
    `UPDATE verificacoes SET usado = true WHERE usuario_id = $1 AND usado = false`,
    [row.id]
  );

  if (canal === "sms") {
    await query(
      `UPDATE usuarios SET telefone_verificado = true, ativo = true, updated_at = NOW() WHERE id = $1`,
      [row.id]
    );
  } else {
    await query(
      `UPDATE usuarios SET email_verificado = true, ativo = true, updated_at = NOW() WHERE id = $1`,
      [row.id]
    );
  }

  const { rows: urows } = await query(
    `SELECT id, email, nome, role, ativo, tipo_perfil, nome_perfil, email_verificado, telefone_verificado
     FROM usuarios WHERE id = $1`,
    [row.id]
  );

  return { ok: true, user: urows[0] };
}

export function isAccountVerified(user) {
  return user.email_verificado || user.telefone_verificado;
}
