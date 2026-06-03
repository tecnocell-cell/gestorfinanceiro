/**
 * Envio de códigos por e-mail e SMS.
 * E-mail: server/emailProvider.js (SMTP / Resend / console)
 */

import { sendEmail } from './emailProvider.js';

const CODE_TTL_MIN = parseInt(process.env.VERIFY_CODE_TTL_MIN || '15', 10);

export function codeTtlMinutes() {
  return CODE_TTL_MIN;
}

export async function sendVerificationEmail(email, nome, codigo) {
  const subject = 'Fluxiva — Confirme seu cadastro';
  const text =
    `Olá${nome ? `, ${nome}` : ''}!\n\n` +
    `Seu código de verificação é: ${codigo}\n\n` +
    `Válido por ${CODE_TTL_MIN} minutos.\n\n` +
    `Se você não solicitou este cadastro, ignore este e-mail.`;

  return sendEmail({ to: email, subject, text, logLabel: 'CÓDIGO E-MAIL CADASTRO' });
}

export async function sendOtpEmail(email, nome, codigo, tipo, ttlMin = 10) {
  const subject = `Fluxiva — Código de verificação (${tipo})`;
  const text =
    `Olá${nome ? `, ${nome}` : ''}!\n\n` +
    `Seu código de verificação é: ${codigo}\n\n` +
    `Válido por ${ttlMin} minutos.\n\n` +
    `Se você não solicitou esta ação, ignore esta mensagem.`;

  return sendEmail({ to: email, subject, text, logLabel: 'CÓDIGO OTP E-MAIL' });
}

export async function sendVerificationSms(telefone, codigo) {
  const text = `Fluxiva: seu código é ${codigo}. Válido por ${CODE_TTL_MIN} min.`;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (sid && token && from) {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const to = telefone.replace(/\D/g, '');
    const e164 = to.startsWith('55') ? `+${to}` : `+55${to}`;
    const body = new URLSearchParams({ To: e164, From: from, Body: text });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error('Twilio:', err);
      throw new Error('Falha ao enviar SMS.');
    }
    return { sent: true, canal: 'sms' };
  }

  console.log('\n────────── CÓDIGO SMS ──────────');
  console.log(`Para: ${telefone}`);
  console.log(`Código: ${codigo}`);
  console.log('────────────────────────────────\n');
  return { sent: true, canal: 'sms', dev: true };
}

export async function sendVerificationEmailLink(email, nome, token) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const subject = 'Fluxiva — Verifique seu e-mail';
  const text =
    `Olá${nome ? `, ${nome}` : ''}!\n\n` +
    `Para confirmar seu e-mail, use o token abaixo no app (Segurança) ou acesse:\n` +
    `${appUrl}/gestor?verify_token=${token}\n\n` +
    `Token: ${token}\n\n` +
    `Se você não solicitou esta verificação, ignore este e-mail.`;

  return sendEmail({ to: email, subject, text, logLabel: 'TOKEN VERIFICAÇÃO E-MAIL' });
}

export async function sendPasswordResetEmail(email, nome, token) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const subject = 'Fluxiva — Recuperação de senha';
  const text =
    `Olá${nome ? `, ${nome}` : ''}!\n\n` +
    `Recebemos uma solicitação para redefinir sua senha.\n` +
    `Use o token no app ou acesse: ${appUrl}/gestor?reset_token=${token}\n\n` +
    `Token: ${token}\n\n` +
    `Se você não solicitou, ignore este e-mail.`;

  return sendEmail({ to: email, subject, text, logLabel: 'TOKEN RECUPERAÇÃO SENHA' });
}

export async function sendEmpresaConviteEmail({
  email,
  empresaNome,
  perfil,
  token,
  convidadoPorNome,
}) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const subject = `Fluxiva — Convite para equipe (${empresaNome})`;
  const text =
    `Olá!\n\n` +
    `${convidadoPorNome || 'Um administrador'} convidou você para a equipe da empresa ${empresaNome} ` +
    `com o perfil "${perfil}".\n\n` +
    `Para aceitar, faça login na Fluxiva e use o token abaixo em Equipe, ` +
    `ou acesse:\n${appUrl}/gestor?aceitar_convite=${token}\n\n` +
    `Token: ${token}\n\n` +
    `O convite expira em ${parseInt(process.env.EMPRESA_CONVITE_TTL_DAYS || '7', 10)} dias.\n`;

  return sendEmail({ to: email, subject, text, logLabel: 'CONVITE EQUIPE EMPRESA' });
}

export { getEmailConfigStatus } from './emailProvider.js';
