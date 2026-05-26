/**
 * Repara estados PF com empresas PJ órfãs no PostgreSQL.
 * Uso: node server/repairTenants.js
 */
import { config } from "dotenv";
config();
import { query, pool } from "./db.js";
import { normalizeStateForUser } from "./initialState.js";

const { rows } = await query(
  `SELECT u.id, u.email, u.tipo_perfil, u.nome_perfil, u.nome, e.dados
   FROM usuarios u
   JOIN estados e ON e.usuario_id = u.id
   WHERE u.role = 'user'`
);

let fixed = 0;
for (const row of rows) {
  const profile = {
    tipo_perfil: row.tipo_perfil || "juridica",
    nome_perfil: row.nome_perfil || row.nome,
    nome: row.nome,
  };
  const normalized = normalizeStateForUser(row.dados, profile);
  if (JSON.stringify(normalized) !== JSON.stringify(row.dados)) {
    await query("UPDATE estados SET dados = $2, updated_at = NOW() WHERE usuario_id = $1", [
      row.id,
      JSON.stringify(normalized),
    ]);
    console.log(`✓ ${row.email} (${profile.tipo_perfil})`);
    fixed++;
  }
}
console.log(`\nReparados: ${fixed}/${rows.length}`);
await pool.end();
