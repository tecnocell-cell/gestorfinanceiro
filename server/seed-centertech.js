/**
 * Seed da empresa padrão Center Tech no tenant admin (estado PJ inicial).
 *
 * Uso: node server/seed-centertech.js
 * Idempotente: ignora se o admin já tiver estado com empresas válidas.
 *
 * Variáveis (opcionais, sem segredos):
 *   ADMIN_EMAIL      — e-mail do admin (padrão: admin@gestor.local)
 *   CENTER_TECH_NOME — nome da empresa (padrão: Center Tech)
 */

import { config } from "dotenv";
config();

import { query, pool } from "./db.js";
import { createInitialState } from "./initialState.js";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@gestor.local";
const EMPRESA_NOME = process.env.CENTER_TECH_NOME || "Center Tech";

const isValidAppState = (dados) =>
  dados && Array.isArray(dados.empresas) && dados.empresas.length > 0;

async function seedCenterTech() {
  try {
    const { rows: users } = await query(
      "SELECT id, email FROM usuarios WHERE email = $1 AND role = 'admin'",
      [ADMIN_EMAIL.toLowerCase()]
    );
    if (!users.length) {
      console.log("ℹ️  Admin não encontrado — execute node server/seed.js antes.");
      return;
    }
    const adminId = users[0].id;

    const { rows: estados } = await query(
      "SELECT dados FROM estados WHERE usuario_id = $1",
      [adminId]
    );

    const dados = estados[0]?.dados ?? {};
    if (isValidAppState(dados)) {
      const nome =
        dados.empresas[0]?.nome ||
        dados.empresas[0]?.company?.nomeFantasia ||
        "empresa";
      console.log(`ℹ️  Estado do admin já configurado (${nome}) — seed ignorado.`);
      return;
    }

    const initialState = createInitialState("juridica", EMPRESA_NOME);

    if (!estados.length) {
      await query(
        "INSERT INTO estados (usuario_id, dados) VALUES ($1, $2)",
        [adminId, JSON.stringify(initialState)]
      );
    } else {
      await query(
        "UPDATE estados SET dados = $2, updated_at = NOW() WHERE usuario_id = $1",
        [adminId, JSON.stringify(initialState)]
      );
    }

    await query(
      `UPDATE usuarios
       SET nome_perfil = $1, tipo_perfil = 'juridica', updated_at = NOW()
       WHERE id = $2`,
      [EMPRESA_NOME, adminId]
    );

    console.log(`✅ Empresa padrão "${EMPRESA_NOME}" aplicada ao admin (${ADMIN_EMAIL}).`);
  } catch (err) {
    console.error("❌ Erro no seed Center Tech:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedCenterTech();
