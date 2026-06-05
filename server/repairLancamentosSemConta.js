/**
 * Reparo: preenche contaSaidaId/contaEntradaId em recorrências pagas sem conta.
 * Não altera lançamentos manuais nem transferências PF/PJ.
 *
 * Uso:
 *   node server/repairLancamentosSemConta.js --email email@usuario.com --dry-run
 *   node server/repairLancamentosSemConta.js --email email@usuario.com
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, pool } from './db.js';
import { auditDadosSemConta, repairDadosSemConta } from './lancamentosSemContaUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, 'backups');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const emailArg = args.find((a) => a.startsWith('--email='));
const emailFlagIdx = args.indexOf('--email');
const email = (
  emailArg?.split('=')[1] ||
  (emailFlagIdx >= 0 ? args[emailFlagIdx + 1] : null) ||
  args.find((a) => !a.startsWith('--'))
)?.trim().toLowerCase();

if (!email) {
  console.error('Uso: node server/repairLancamentosSemConta.js --email <email> [--dry-run]');
  process.exit(1);
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function main() {
  const { rows: users } = await query(
    `SELECT id, email, nome, tipo_perfil FROM usuarios WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  if (!users.length) {
    console.error(`Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  const user = users[0];
  const { rows: est } = await query(
    'SELECT usuario_id, dados, updated_at FROM estados WHERE usuario_id = $1',
    [user.id]
  );
  if (!est.length) {
    console.error('Sem registro em estados.');
    process.exit(1);
  }

  const before = est[0].dados;
  const auditAntes = auditDadosSemConta(before);
  const { dados: repaired, patched, detalhes } = repairDadosSemConta(before);
  const auditDepois = auditDadosSemConta(repaired);

  console.log('=== Reparo lançamentos sem conta —', user.email, dryRun ? '(DRY-RUN)' : '', '===\n');
  console.log('usuario_id:', user.id);
  console.log('Sem conta (antes):     ', auditAntes.itens.length);
  console.log('Reparáveis (antes):    ', auditAntes.reparaveis);
  console.log('Alertas manuais:       ', auditAntes.alertas);
  console.log('Patches aplicados:     ', patched);
  console.log('Sem conta (depois):    ', auditDepois.itens.length);

  if (detalhes.length) {
    console.log('\n--- Patches ---');
    for (const d of detalhes) {
      console.log(`  ${d.id} | ${d.historico || '—'} |`, d);
    }
  }

  if (auditAntes.alertas > 0) {
    console.log('\n⚠ Lançamentos manuais sem conta (não alterados):');
    for (const i of auditAntes.itens.filter((x) => !x.reparavel)) {
      console.log(`  ${i.id} | ${i.historico} | R$ ${i.valor}`);
    }
  }

  if (patched === 0) {
    console.log('\n✓ Nada a reparar.');
    await pool.end();
    return;
  }

  if (dryRun) {
    console.log('\n[DRY-RUN] Nenhuma gravação. Remova --dry-run para aplicar.');
    await pool.end();
    return;
  }

  ensureBackupDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `sem-conta-${user.id}-${ts}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify({ backed_at: new Date().toISOString(), usuario_id: user.id, email: user.email, dados: before }, null, 2),
    'utf8'
  );
  console.log('\nBackup gravado:', backupFile);

  await query(
    'UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2',
    [JSON.stringify(repaired), user.id]
  );

  console.log('✓ Reparo persistido. Peça ao usuário recarregar o app (F5).');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Erro:', err.message);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
