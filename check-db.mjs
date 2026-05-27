/**
 * Script de diagnóstico — verifica dados no banco PostgreSQL
 * Execute: node check-db.mjs
 */
import { config } from "dotenv";
config();

import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        u.id,
        u.email,
        u.nome,
        u.tipo_perfil,
        e.updated_at,
        jsonb_array_length(COALESCE(e.dados->'empresas'->0->'lancamentos', '[]'::jsonb)) AS lancamentos,
        jsonb_array_length(COALESCE(e.dados->'empresas'->0->'planoContas',  '[]'::jsonb)) AS categorias,
        jsonb_array_length(COALESCE(e.dados->'empresas'->0->'contas',       '[]'::jsonb)) AS contas
      FROM usuarios u
      LEFT JOIN estados e ON e.usuario_id = u.id
      ORDER BY u.tipo_perfil, u.created_at
    `);

    console.log("\n=== ESTADO DOS USUÁRIOS NO BANCO ===\n");
    for (const r of rows) {
      console.log(`👤 ${r.nome} (${r.email})`);
      console.log(`   Perfil: ${r.tipo_perfil}  |  Última atualização: ${r.updated_at}`);
      console.log(`   Lançamentos: ${r.lancamentos}  |  Categorias: ${r.categorias}  |  Contas: ${r.contas}`);
      console.log();
    }
  } finally {
    client.release();
    pool.end();
  }
}

main().catch((err) => { console.error("Erro:", err.message); process.exit(1); });
