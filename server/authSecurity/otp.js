import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { query } from '../db.js';
import { sendOtpEmail } from '../notify.js';
import {
  OTP_TTL_MIN,
  MAX_OTP_ATTEMPTS,
  OTP_RATE_LIMIT_COUNT,
  OTP_RATE_LIMIT_WINDOW_MIN,
} from './constants.js';

const VALID_TIPOS = new Set([
  'login_suspeito',
  'reset_senha',
  'verificar_telefone',
  'acao_sensivel',
]);

export function isWhatsappGatewayConfigured() {
  return Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);
}

/** Gera código de 6 dígitos e hash (nunca persiste o código puro). */
export async function gerarOtp() {
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const codigoHash = await bcrypt.hash(codigo, 10);
  return { codigo, codigoHash };
}

export async function enviarOtpEmail(destino, codigo, tipo, nome = '') {
  return sendOtpEmail(destino, nome, codigo, tipo, OTP_TTL_MIN);
}

export async function enviarOtpWhatsapp(destino, codigo, tipo) {
  if (!isWhatsappGatewayConfigured()) {
    return { sent: false, canal: 'whatsapp', error: 'gateway_nao_configurado' };
  }

  const instance =
    process.env.WHATSAPP_OTP_INSTANCE ||
    process.env.WHATSAPP_ADMIN_INSTANCE ||
    'cf-admin';
  const digits = String(destino || '').replace(/\D/g, '');
  if (!digits) {
    return { sent: false, canal: 'whatsapp', error: 'telefone_invalido' };
  }

  const text =
    `Fluxiva: seu código de verificação (${tipoLabel(tipo)}) é ${codigo}. ` +
    `Válido por ${OTP_TTL_MIN} minutos.`;

  try {
    const { sendText } = await import('../whatsapp/evolutionProvider.js');
    await sendText(instance, digits, text);
    return { sent: true, canal: 'whatsapp' };
  } catch (err) {
    console.error('enviarOtpWhatsapp:', err.message);
    return { sent: false, canal: 'whatsapp', error: err.message };
  }
}

function tipoLabel(tipo) {
  const map = {
    login_suspeito: 'login',
    reset_senha: 'redefinição de senha',
    verificar_telefone: 'verificação de telefone',
    acao_sensivel: 'segurança',
  };
  return map[tipo] || 'verificação';
}

async function assertRateLimit(usuarioId, destino) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n
     FROM otps
     WHERE usuario_id = $1
       AND destino = $2
       AND created_at > NOW() - ($3::text || ' minutes')::interval`,
    [usuarioId, destino, String(OTP_RATE_LIMIT_WINDOW_MIN)]
  );
  if (rows[0]?.n >= OTP_RATE_LIMIT_COUNT) {
    const err = new Error('Muitas solicitações de código. Aguarde alguns minutos.');
    err.code = 'OTP_RATE_LIMIT';
    throw err;
  }
}

/** OTP válido ainda não usado (ex.: rate limit no reenvio). */
export async function getPendingOtp({ usuarioId, tipo }) {
  const { rows } = await query(
    `SELECT id, expires_at, canal, destino
     FROM otps
     WHERE usuario_id = $1 AND tipo = $2 AND used_at IS NULL
       AND expires_at > NOW() AND tentativas < $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [usuarioId, tipo, MAX_OTP_ATTEMPTS]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ok: true,
    otp_id: row.id,
    expires_at: row.expires_at,
    canal: row.canal,
    destino_mascarado: maskDestino(row.destino, row.canal),
    ttl_minutes: OTP_TTL_MIN,
  };
}

export async function invalidarOtp({ otpId, usuarioId, tipo }) {
  if (otpId) {
    await query(
      `UPDATE otps SET used_at = COALESCE(used_at, NOW())
       WHERE id = $1 AND used_at IS NULL`,
      [otpId]
    );
    return;
  }
  if (usuarioId && tipo) {
    await query(
      `UPDATE otps SET used_at = NOW()
       WHERE usuario_id = $1 AND tipo = $2 AND used_at IS NULL`,
      [usuarioId, tipo]
    );
  }
}

async function pickCanalDestino(user, preferido) {
  const email = String(user.email || '').toLowerCase().trim();
  const telefone = String(user.telefone || '').replace(/\D/g, '');

  if (preferido === 'whatsapp' && telefone && isWhatsappGatewayConfigured()) {
    return { canal: 'whatsapp', destino: telefone, fallback: false };
  }
  if (preferido === 'email' && email) {
    return { canal: 'email', destino: email, fallback: false };
  }

  if (preferido === 'whatsapp' && telefone && !isWhatsappGatewayConfigured()) {
    if (email) {
      return {
        canal: 'email',
        destino: email,
        fallback: true,
        aviso: 'WhatsApp indisponível. Enviamos o código por e-mail.',
      };
    }
    const err = new Error('WhatsApp não configurado e e-mail indisponível.');
    err.code = 'OTP_CANAL_INDISPONIVEL';
    throw err;
  }

  if (telefone && isWhatsappGatewayConfigured() && preferido !== 'email') {
    return { canal: 'whatsapp', destino: telefone, fallback: false };
  }
  if (email) {
    return { canal: 'email', destino: email, fallback: false };
  }

  const err = new Error('Nenhum canal disponível para envio do código.');
  err.code = 'OTP_CANAL_INDISPONIVEL';
  throw err;
}

/**
 * Cria OTP, envia e retorna metadados (sem código em produção).
 */
export async function criarEnviarOtp({
  usuarioId,
  tipo,
  canalPreferido = 'email',
  destinoOverride,
  nome,
}) {
  if (!VALID_TIPOS.has(tipo)) {
    throw new Error('Tipo de OTP inválido.');
  }

  const { rows: userRows } = await query(
    `SELECT id, email, nome, telefone FROM usuarios WHERE id = $1`,
    [usuarioId]
  );
  const user = userRows[0];
  if (!user) throw new Error('Usuário não encontrado.');

  let canal;
  let destino;
  let fallback = false;
  let aviso;

  if (destinoOverride) {
    destino = destinoOverride;
    canal =
      canalPreferido === 'whatsapp' && isWhatsappGatewayConfigured()
        ? 'whatsapp'
        : 'email';
  } else {
    const picked = await pickCanalDestino(user, canalPreferido);
    canal = picked.canal;
    destino = picked.destino;
    fallback = Boolean(picked.fallback);
    aviso = picked.aviso;
  }

  await assertRateLimit(usuarioId, destino);
  await invalidarOtp({ usuarioId, tipo });

  const { codigo, codigoHash } = await gerarOtp();

  const { rows: ins } = await query(
    `INSERT INTO otps (usuario_id, canal, destino, codigo_hash, tipo, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + ($6::text || ' minutes')::interval)
     RETURNING id, expires_at, canal, destino`,
    [usuarioId, canal, destino, codigoHash, tipo, String(OTP_TTL_MIN)]
  );
  const row = ins[0];

  let sendResult;
  if (canal === 'whatsapp') {
    sendResult = await enviarOtpWhatsapp(destino, codigo, tipo);
    if (!sendResult.sent && user.email) {
      canal = 'email';
      destino = user.email;
      fallback = true;
      aviso = aviso || 'WhatsApp indisponível. Enviamos o código por e-mail.';
      sendResult = await enviarOtpEmail(destino, codigo, tipo, nome || user.nome);
      await query(`UPDATE otps SET canal = 'email', destino = $1 WHERE id = $2`, [
        destino,
        row.id,
      ]);
    }
  } else {
    sendResult = await enviarOtpEmail(destino, codigo, tipo, nome || user.nome);
  }

  if (!sendResult?.sent) {
    await invalidarOtp({ otpId: row.id });
    throw new Error('Falha ao enviar código de verificação.');
  }

  const payload = {
    ok: true,
    otp_id: row.id,
    expires_at: row.expires_at,
    canal,
    destino_mascarado: maskDestino(destino, canal),
    ttl_minutes: OTP_TTL_MIN,
    fallback,
    aviso: aviso || null,
  };

  if (process.env.NODE_ENV !== 'production') {
    payload.dev_codigo = codigo;
  }

  return payload;
}

export async function validarOtp({ otpId, usuarioId, tipo, codigo }) {
  if (!otpId || !codigo) {
    return { ok: false, error: 'Código obrigatório.' };
  }

  const { rows } = await query(
    `SELECT id, usuario_id, codigo_hash, tipo, expires_at, used_at, tentativas
     FROM otps WHERE id = $1`,
    [otpId]
  );
  const row = rows[0];
  if (!row) return { ok: false, error: 'Código inválido.' };
  if (usuarioId && row.usuario_id !== usuarioId) {
    return { ok: false, error: 'Código inválido.' };
  }
  if (tipo && row.tipo !== tipo) {
    return { ok: false, error: 'Tipo de verificação incorreto.' };
  }
  if (row.used_at) return { ok: false, error: 'Código já utilizado.' };
  if (new Date(row.expires_at) <= new Date()) {
    return { ok: false, error: 'Código expirado.' };
  }
  if (row.tentativas >= MAX_OTP_ATTEMPTS) {
    return { ok: false, error: 'Limite de tentativas excedido. Solicite um novo código.' };
  }

  const match = await bcrypt.compare(String(codigo).trim(), row.codigo_hash);
  if (!match) {
    await query(
      `UPDATE otps SET tentativas = tentativas + 1 WHERE id = $1`,
      [row.id]
    );
    const remaining = MAX_OTP_ATTEMPTS - (row.tentativas + 1);
    return {
      ok: false,
      error:
        remaining > 0
          ? `Código incorreto. ${remaining} tentativa(s) restante(s).`
          : 'Limite de tentativas excedido. Solicite um novo código.',
    };
  }

  await query(`UPDATE otps SET used_at = NOW() WHERE id = $1`, [row.id]);
  return { ok: true, usuario_id: row.usuario_id, tipo: row.tipo };
}

export async function getUsuarioForOtp({ otpId, email }) {
  if (otpId) {
    const { rows } = await query(
      `SELECT u.id, u.email, u.nome, u.telefone, u.role, u.tipo_perfil, u.nome_perfil, u.ativo
       FROM otps o
       JOIN usuarios u ON u.id = o.usuario_id
       WHERE o.id = $1`,
      [otpId]
    );
    return rows[0] || null;
  }
  if (email) {
    const { rows } = await query(
      `SELECT id, email, nome, telefone, role, tipo_perfil, nome_perfil, ativo
       FROM usuarios WHERE email = $1 AND role = 'user'`,
      [String(email).toLowerCase().trim()]
    );
    return rows[0] || null;
  }
  return null;
}

function maskDestino(destino, canal) {
  if (canal === 'email') {
    const [local, domain] = String(destino).split('@');
    if (!domain) return '***';
    const vis = local.slice(0, Math.min(2, local.length));
    return `${vis}***@${domain}`;
  }
  const d = String(destino).replace(/\D/g, '');
  if (d.length <= 4) return '****';
  return `***${d.slice(-4)}`;
}
