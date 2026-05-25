/**
 * Gestor Financeiro — Seed do administrador do sistema
 *
 * Cria a conta de admin APENAS se não existir nenhum usuário com role='admin'.
 * Uso: node server/seed.js
 *
 * Credenciais padrão (altere após o primeiro login ou via .env):
 *   E-mail : admin@gestor.local
 *   Senha  : admin123
 */

import { config } from "dotenv";
config();

import bcrypt from "bcryptjs";
import { query, pool } from "./db.js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@gestor.local";
const ADMIN_SENHA = process.env.ADMIN_SENHA || "admin123";
const ADMIN_NOME  = process.env.ADMIN_NOME || "Administrador do Sistema";

async function seed() {
  try {
    const { rows } = await query(
      "SELECT COUNT(*) AS total FROM usuarios WHERE role = 'admin'"
    );
    if (parseInt(rows[0].total, 10) > 0) {
      console.log("ℹ️  Admin já existe — seed ignorado.");
      return;
    }

    const hash = await bcrypt.hash(ADMIN_SENHA, 12);
    const insert = await query(
      `INSERT INTO usuarios (email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil)
       VALUES ($1, $2, $3, 'admin', true, 'juridica', 'Sistema')
       RETURNING id`,
      [ADMIN_EMAIL, hash, ADMIN_NOME]
    );
    const userId = insert.rows[0].id;

    await query(
      "INSERT INTO estados (usuario_id, dados) VALUES ($1, $2)",
      [userId, JSON.stringify({})]
    );

    console.log("✅ Administrador criado com sucesso!");
    console.log(`   E-mail : ${ADMIN_EMAIL}`);
    console.log("   ⚠️  Altere a senha após o primeiro acesso!");
  } catch (err) {
    console.error("❌ Erro no seed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
