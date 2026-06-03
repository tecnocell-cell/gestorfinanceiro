/**
 * Reaplica seed dos planos Free / Pro / Empresarial.
 * Uso: npm run seed:planos
 */
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, pool } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  config();
  const sql = readFileSync(join(__dirname, '../migrations/023_planos_assinaturas.sql'), 'utf-8');
  const match = sql.match(/INSERT INTO planos[\s\S]*?;/);
  if (!match) {
    console.error('INSERT de planos não encontrado na migration 023.');
    process.exit(1);
  }
  await query(match[0]);
  console.log('✓ Planos Free, Pro e Empresarial atualizados.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  pool.end().finally(() => process.exit(1));
});
