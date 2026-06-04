#!/usr/bin/env node
/**
 * Checklist de produção — npm run check:production
 * Uso: node server/homologacao/runProductionCheck.js [API_BASE_URL]
 */
import { config } from 'dotenv';
config();

import { pool } from '../db.js';
import { runProductionChecks } from './productionCheck.js';

const apiBase = process.argv[2] || process.env.CHECK_API_URL;

async function main() {
  console.log('=== Checklist de produção (Fluxiva) ===\n');
  const result = await runProductionChecks({ apiBaseUrl: apiBase });

  for (const c of result.checks) {
    const icon = c.ok ? '✓' : c.warnOnly ? '⚠' : '✗';
    console.log(`  ${icon} ${c.label}: ${c.detail}`);
  }

  console.log('');
  if (result.ok) {
    console.log('✅ Produção OK (avisos podem existir)\n');
    await pool.end();
    process.exit(result.warningCount > 0 ? 0 : 0);
  }
  console.log(`❌ ${result.blockingCount} item(ns) bloqueante(s)\n`);
  await pool.end();
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  pool.end().finally(() => process.exit(1));
});
