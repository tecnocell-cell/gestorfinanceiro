/**
 * Envio de códigos por e-mail e SMS.
 * Dev: imprime no console. Produção: SMTP (e-mail) e Twilio (SMS) via .env
 */

const CODE_TTL_MIN = parseInt(process.env.VERIFY_CODE_TTL_MIN || "15", 10);

export function codeTtlMinutes() {
  return CODE_TTL_MIN;
}

export async function sendVerificationEmail(email, nome, codigo) {
  const subject = "CenterTech Gestor — Confirme seu cadastro";
  const text =
    `Olá${nome ? `, ${nome}` : ""}!\n\n` +
    `Seu código de verificação é: ${codigo}\n\n` +
    `Válido por ${CODE_TTL_MIN} minutos.\n\n` +
    `Se você não solicitou este cadastro, ignore este e-mail.`;

  if (process.env.SMTP_HOST) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@gestor.local",
        to: email,
        subject,
        text,
      });
      return { sent: true, canal: "email" };
    } catch (err) {
      console.error("SMTP error:", err.message);
      throw new Error("Falha ao enviar e-mail. Tente SMS ou contate o suporte.");
    }
  }

  console.log("\n────────── CÓDIGO E-MAIL ──────────");
  console.log(`Para: ${email}`);
  console.log(`Código: ${codigo}`);
  console.log("──────────────────────────────────\n");
  return { sent: true, canal: "email", dev: true };
}

export async function sendOtpEmail(email, nome, codigo, tipo, ttlMin = 10) {
  const subject = `Fluxiva — Código de verificação (${tipo})`;
  const text =
    `Olá${nome ? `, ${nome}` : ""}!\n\n` +
    `Seu código de verificação é: ${codigo}\n\n` +
    `Válido por ${ttlMin} minutos.\n\n` +
    `Se você não solicitou esta ação, ignore esta mensagem.`;

  if (process.env.SMTP_HOST) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@gestor.local",
        to: email,
        subject,
        text,
      });
      return { sent: true, canal: "email" };
    } catch (err) {
      console.error("SMTP OTP error:", err.message);
      if (process.env.NODE_ENV === "production") {
        throw new Error("Falha ao enviar código por e-mail.");
      }
    }
  }

  console.log("\n────────── CÓDIGO OTP E-MAIL ──────────");
  console.log(`Para: ${email}`);
  console.log(`Tipo: ${tipo}`);
  console.log(`Código: ${codigo}`);
  console.log("──────────────────────────────────────\n");
  return { sent: true, canal: "email", dev: true };
}

export async function sendVerificationSms(telefone, codigo) {
  const text = `CenterTech Gestor: seu código é ${codigo}. Válido por ${CODE_TTL_MIN} min.`;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (sid && token && from) {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const to = telefone.replace(/\D/g, "");
    const e164 = to.startsWith("55") ? `+${to}` : `+55${to}`;
    const body = new URLSearchParams({ To: e164, From: from, Body: text });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error("Twilio:", err);
      throw new Error("Falha ao enviar SMS.");
    }
    return { sent: true, canal: "sms" };
  }

  console.log("\n────────── CÓDIGO SMS ──────────");
  console.log(`Para: ${telefone}`);
  console.log(`Código: ${codigo}`);
  console.log("────────────────────────────────\n");
  return { sent: true, canal: "sms", dev: true };
}

export async function sendVerificationEmailLink(email, nome, token) {
  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const subject = "CenterTech Gestor — Verifique seu e-mail";
  const text =
    `Olá${nome ? `, ${nome}` : ""}!\n\n` +
    `Para confirmar seu e-mail, use o token abaixo no app (Configurações → Segurança) ou acesse:\n` +
    `${appUrl}/?verify_token=${token}\n\n` +
    `Token: ${token}\n\n` +
    `Se você não solicitou esta verificação, ignore este e-mail.`;

  if (process.env.SMTP_HOST) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@gestor.local",
        to: email,
        subject,
        text,
      });
      return { sent: true, canal: "email" };
    } catch (err) {
      console.error("SMTP error:", err.message);
      if (process.env.NODE_ENV === "production") {
        throw new Error("Falha ao enviar e-mail de verificação.");
      }
    }
  }

  console.log("\n────────── TOKEN VERIFICAÇÃO E-MAIL ──────────");
  console.log(`Para: ${email}`);
  console.log(`Token: ${token}`);
  console.log("────────────────────────────────────────────\n");
  return { sent: true, canal: "email", dev: true };
}

export async function sendPasswordResetEmail(email, nome, token) {
  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const subject = "CenterTech Gestor — Recuperação de senha";
  const text =
    `Olá${nome ? `, ${nome}` : ""}!\n\n` +
    `Recebemos uma solicitação para redefinir sua senha.\n` +
    `Use o token no app ou acesse: ${appUrl}/?reset_token=${token}\n\n` +
    `Token: ${token}\n\n` +
    `Se você não solicitou, ignore este e-mail.`;

  if (process.env.SMTP_HOST) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@gestor.local",
        to: email,
        subject,
        text,
      });
      return { sent: true, canal: "email" };
    } catch (err) {
      console.error("SMTP error:", err.message);
      if (process.env.NODE_ENV === "production") {
        throw new Error("Falha ao enviar e-mail de recuperação.");
      }
    }
  }

  console.log("\n────────── TOKEN RECUPERAÇÃO SENHA ──────────");
  console.log(`Para: ${email}`);
  console.log(`Token: ${token}`);
  console.log("──────────────────────────────────────────\n");
  return { sent: true, canal: "email", dev: true };
}

export async function sendEmpresaConviteEmail({
  email,
  empresaNome,
  perfil,
  token,
  convidadoPorNome,
}) {
  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const subject = `Fluxiva — Convite para equipe (${empresaNome})`;
  const text =
    `Olá!\n\n` +
    `${convidadoPorNome || "Um administrador"} convidou você para a equipe da empresa ${empresaNome} ` +
    `com o perfil "${perfil}".\n\n` +
    `Para aceitar, faça login na Fluxiva e use o token abaixo em Configurações → Equipe, ` +
    `ou acesse:\n${appUrl}/gestor?aceitar_convite=${token}\n\n` +
    `Token: ${token}\n\n` +
    `O convite expira em ${parseInt(process.env.EMPRESA_CONVITE_TTL_DAYS || "7", 10)} dias.\n`;

  if (process.env.SMTP_HOST) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@gestor.local",
        to: email,
        subject,
        text,
      });
      return { sent: true, canal: "email" };
    } catch (err) {
      console.error("SMTP convite empresa:", err.message);
      if (process.env.NODE_ENV === "production") {
        throw new Error("Falha ao enviar convite por e-mail.");
      }
    }
  }

  console.log("\n────────── CONVITE EQUIPE EMPRESA ──────────");
  console.log(`Para: ${email}`);
  console.log(`Empresa: ${empresaNome}`);
  console.log(`Perfil: ${perfil}`);
  console.log(`Token: ${token}`);
  console.log("──────────────────────────────────────────\n");
  return { sent: true, canal: "email", dev: true };
}
