/**
 * Provedor central de e-mail — SMTP, Resend ou console (dev).
 * EMAIL_PROVIDER=smtp|resend|console (auto se omitido)
 */

const SECRET_KEYS = new Set([
  'SMTP_PASS',
  'SMTP_USER',
  'RESEND_API_KEY',
  'ASAAS_API_KEY',
  'EVOLUTION_API_KEY',
  'JWT_SECRET',
]);

let warnedUnconfigured = false;

function resolveProvider() {
  const explicit = String(process.env.EMAIL_PROVIDER || '').toLowerCase().trim();
  if (explicit === 'console') return 'console';
  if (explicit === 'resend') return 'resend';
  if (explicit === 'smtp') return 'smtp';
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.SMTP_HOST) return 'smtp';
  return 'console';
}

function fromAddress() {
  return (
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    'Fluxiva <noreply@fluxiva.app>'
  );
}

export function getEmailConfigStatus() {
  const provider = resolveProvider();
  const configured =
    provider === 'resend'
      ? Boolean(process.env.RESEND_API_KEY)
      : provider === 'smtp'
        ? Boolean(process.env.SMTP_HOST)
        : false;

  let message;
  if (configured) {
    message =
      provider === 'resend'
        ? 'E-mail configurado via Resend.'
        : 'E-mail configurado via SMTP.';
  } else if (provider === 'console' || !configured) {
    message = 'Envio de e-mail não configurado.';
  } else {
    message = `Provedor ${provider} selecionado, mas credenciais incompletas.`;
  }

  return {
    configured,
    provider: configured ? provider : 'console',
    message,
  };
}

function warnUnconfiguredOnce() {
  if (warnedUnconfigured) return;
  warnedUnconfigured = true;
  console.warn(
    '[email] Envio de e-mail não configurado. Defina EMAIL_PROVIDER e credenciais (SMTP_* ou RESEND_API_KEY). ' +
      'Em dev, mensagens vão para o console.'
  );
}

async function sendViaSmtp({ to, subject, text }) {
  let nodemailer;
  try {
    nodemailer = await import('nodemailer');
  } catch {
    return { ok: false, error: 'nodemailer não instalado (npm install nodemailer)' };
  }

  const transport = nodemailer.default.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transport.sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
  });
  return { ok: true };
}

async function sendViaResend({ to, subject, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY ausente' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [to],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, error: body || res.statusText };
  }
  return { ok: true };
}

function logToConsole({ label, to, subject, text }) {
  console.log(`\n────────── ${label} ──────────`);
  console.log(`Para: ${to}`);
  console.log(`Assunto: ${subject}`);
  if (text.length <= 500) {
    console.log(text);
  } else {
    console.log(text.slice(0, 500) + '…');
  }
  console.log('──────────────────────────────────\n');
}

/**
 * Envia e-mail. Nunca lança em modo console — fallback seguro em dev.
 */
export async function sendEmail({ to, subject, text, logLabel = 'E-MAIL' }) {
  const status = getEmailConfigStatus();
  const provider = resolveProvider();

  if (!status.configured || provider === 'console') {
    warnUnconfiguredOnce();
    logToConsole({ label: logLabel, to, subject, text });
    return {
      sent: true,
      dev: true,
      provider: 'console',
      configured: false,
      canal: 'email',
    };
  }

  let result;
  if (provider === 'resend') {
    result = await sendViaResend({ to, subject, text });
  } else {
    result = await sendViaSmtp({ to, subject, text });
  }

  if (!result.ok) {
    console.error(`[email/${provider}]`, result.error);
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Falha ao enviar e-mail.');
    }
    logToConsole({ label: `${logLabel} (fallback)`, to, subject, text });
    return {
      sent: true,
      dev: true,
      provider: 'console',
      configured: false,
      canal: 'email',
      fallback: true,
    };
  }

  return { sent: true, provider, configured: true, canal: 'email' };
}

/** Garante que objetos de status não vazam segredos. */
export function sanitizeForPublic(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null ? sanitizeForPublic(item) : item
    );
  }
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEYS.has(k)) continue;
    if (typeof v === 'string' && /key|secret|pass|token/i.test(k)) continue;
    if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        typeof item === 'object' && item !== null ? sanitizeForPublic(item) : item
      );
    } else {
      out[k] = typeof v === 'object' && v !== null ? sanitizeForPublic(v) : v;
    }
  }
  return out;
}
