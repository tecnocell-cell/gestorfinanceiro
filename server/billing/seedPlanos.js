/**
 * Reaplica seed dos planos comerciais (Etapa 6.3B).
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
  const sql = readFileSync(join(__dirname, '../migrations/024_planos_comerciais.sql'), 'utf-8');
  await query(sql);
  console.log('✓ Planos comerciais PF/PJ atualizados (024).');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  pool.end().finally(() => process.exit(1));
});
