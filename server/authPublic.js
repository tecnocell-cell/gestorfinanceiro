import bcrypt from "bcryptjs";
import { query } from "./db.js";
import { createInitialState } from "./initialState.js";
import { createAndSendVerification, verifyCode, isAccountVerified } from "./verification.js";
import { signToken } from "./middleware/auth.js";

function normalizePhone(t) {
  const d = String(t || "").replace(/\D/g, "");
  if (d.length < 10 || d.length > 13) return null;
  return d;
}

export function registerAuthRoutes(app) {
  app.post("/api/auth/register", async (req, res) => {
    const {
      nome,
      email,
      senha,
      tipo_perfil = "juridica",
      nome_perfil,
      telefone,
      canal_verificacao = "email",
      whatsapp_phone,
      whatsapp_source,
    } = req.body || {};

    if (!nome?.trim() || !email?.trim() || !senha) {
      return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
    }
    if (senha.length < 6) {
      return res.status(400).json({ error: "Senha mínima: 6 caracteres." });
    }
    if (!["fisica", "juridica"].includes(tipo_perfil)) {
      return res.status(400).json({ error: "Tipo de perfil inválido." });
    }
    if (!nome_perfil?.trim()) {
      return res.status(400).json({
        error: tipo_perfil === "juridica" ? "Informe o nome da empresa." : "Informe o nome do perfil.",
      });
    }

    const canal = canal_verificacao === "sms" ? "sms" : "email";
    const tel = normalizePhone(telefone);
    if (canal === "sms" && !tel) {
      return res.status(400).json({ error: "Informe um celular válido para verificação por SMS." });
    }

    try {
      const existe = await query("SELECT id FROM usuarios WHERE email = $1", [email.toLowerCase()]);
      if (existe.rows.length) {
        return res.status(409).json({ error: "Este e-mail já está cadastrado." });
      }

      const hash = await bcrypt.hash(senha, 12);
      const perfil = nome_perfil.trim();

      const { rows } = await query(
        `INSERT INTO usuarios (
           email, senha_hash, nome, role, ativo,
           tipo_perfil, nome_perfil, telefone,
           email_verificado, telefone_verificado
         )
         VALUES ($1, $2, $3, 'user', false, $4, $5, $6, false, false)
         RETURNING id, email, nome, tipo_perfil, nome_perfil, telefone`,
        [email.toLowerCase(), hash, nome.trim(), tipo_perfil, perfil, tel || ""]
      );
      const user = rows[0];

      const initialState = createInitialState(tipo_perfil, perfil);
      await query(
        "INSERT INTO estados (usuario_id, dados) VALUES ($1, $2)",
        [user.id, JSON.stringify(initialState)]
      );

      const send = await createAndSendVerification(user.id, canal, {
        email: user.email,
        nome: user.nome,
        telefone: tel || user.telefone,
      });

      // Auto-authorize WhatsApp number from lead flow
      const waPhone = normalizePhone(whatsapp_phone);
      if (waPhone && whatsapp_source === "whatsapp") {
        const { rows: conflict } = await query(
          `SELECT id FROM whatsapp_authorized_numbers
             WHERE phone_number = $1 AND active = true AND usuario_id != $2
             LIMIT 1`,
          [waPhone, user.id]
        );
        if (conflict.length) {
          // Rollback: remove o usuário recém-criado e retorna erro
          await query("DELETE FROM estados WHERE usuario_id = $1", [user.id]);
          await query("DELETE FROM usuarios WHERE id = $1", [user.id]);
          return res.status(409).json({
            error: "Este número já está vinculado a outra conta Fluxiva. Remova da conta anterior antes de usar aqui.",
            code: "WHATSAPP_PHONE_CONFLICT",
          });
        }
        await query(
          `INSERT INTO whatsapp_authorized_numbers (usuario_id, phone_number, label, is_primary)
           VALUES ($1, $2, 'WhatsApp', true)
           ON CONFLICT DO NOTHING`,
          [user.id, waPhone]
        );
        console.log(`[register] WhatsApp auto-autorizado: usuario=${user.id} phone=${waPhone}`);
      }

      res.status(201).json({
        ok: true,
        message:
          canal === "sms"
            ? "Enviamos um código por SMS. Digite-o para ativar sua conta."
            : "Enviamos um código por e-mail. Digite-o para ativar sua conta.",
        email: user.email,
        canal,
        ttl_minutos: send.ttl,
        dev_code: send.devCode,
      });
    } catch (err) {
      console.error("register:", err.message);
      res.status(500).json({ error: "Erro ao criar cadastro." });
    }
  });

  app.post("/api/auth/verify", async (req, res) => {
    const { email, codigo, canal = "email" } = req.body || {};
    if (!email || !codigo) {
      return res.status(400).json({ error: "E-mail e código são obrigatórios." });
    }

    try {
      const result = await verifyCode(email, codigo, canal === "sms" ? "sms" : "email");
      if (!result.ok) {
        return res.status(400).json({ error: result.error });
      }

      const u = result.user;
      const token = signToken({ id: u.id, email: u.email, role: u.role });

      res.json({
        ok: true,
        token,
        user: {
          id: u.id,
          email: u.email,
          nome: u.nome,
          role: u.role,
          tipo_perfil: u.tipo_perfil || "juridica",
          nome_perfil: u.nome_perfil || u.nome,
        },
      });
    } catch (err) {
      console.error("verify:", err.message);
      res.status(500).json({ error: "Erro ao verificar código." });
    }
  });

  app.post("/api/auth/resend-code", async (req, res) => {
    const { email, canal = "email" } = req.body || {};
    if (!email) return res.status(400).json({ error: "E-mail obrigatório." });

    try {
      const { rows } = await query(
        `SELECT id, email, nome, telefone, email_verificado, telefone_verificado, ativo
         FROM usuarios WHERE email = $1 AND role = 'user'`,
        [email.toLowerCase()]
      );
      const u = rows[0];
      if (!u) return res.status(404).json({ error: "Cadastro não encontrado." });
      if (isAccountVerified(u) && u.ativo) {
        return res.status(400).json({ error: "Conta já verificada. Faça login." });
      }

      const ch = canal === "sms" ? "sms" : "email";
      if (ch === "sms" && !u.telefone) {
        return res.status(400).json({ error: "Cadastro sem telefone. Use verificação por e-mail." });
      }

      const send = await createAndSendVerification(u.id, ch, {
        email: u.email,
        nome: u.nome,
        telefone: u.telefone,
      });

      res.json({
        ok: true,
        canal: ch,
        ttl_minutos: send.ttl,
        dev_code: send.devCode,
        message: ch === "sms" ? "Novo código enviado por SMS." : "Novo código enviado por e-mail.",
      });
    } catch (err) {
      console.error("resend-code:", err.message);
      res.status(500).json({ error: "Erro ao reenviar código." });
    }
  });
}
