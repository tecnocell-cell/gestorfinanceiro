/**
 * Reparo de lançamentos PF da integração PJ→PF (Entrada + receita).
 * Uso:
 *   node server/repairIntegracaoPfPjPfEntradas.js <email> --dry-run
 *   node server/repairIntegracaoPfPjPfEntradas.js <email>
 */
import { config } from 'dotenv';
config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, pool } from './db.js';
import { normalizeTipoPerfil } from './profileTipo.js';
import { prepareEstadoForWrite, profileForPf } from './integracaoPfPj/estadoMerge.js';
import {
  isLancamentoPfIntegracao,
  isPlanoReceita,
  repairLancamentoPfIntegracao,
  validateLancamentoPfIntegracao,
} from './integracaoPfPj/lancamentoPfPj.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, 'backups');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const email = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase();

if (!email) {
  console.error('Uso: node server/repairIntegracaoPfPjPfEntradas.js <email> [--dry-run]');
  process.exit(1);
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function repairEstado(dados, userRow) {
  const profile = profileForPf(userRow);
  const prepared = prepareEstadoForWrite(dados, profile);
  const emp = prepared.empresas[0];
  const contas = emp.contas || [];

  let corrigidos = 0;
  let jaOk = 0;
  const detalhes = [];

  const originais = emp.lancamentos || [];
  const totalIntegracao = originais.filter(isLancamentoPfIntegracao).length;

  const lancamentos = originais.map((l) => {
    if (!isLancamentoPfIntegracao(l)) return l;

    const errosAntes = validateLancamentoPfIntegracao(l, emp);
    if (!errosAntes.length) {
      jaOk += 1;
      return l;
    }

    const fixed = repairLancamentoPfIntegracao(l, emp, contas);
    const errosDepois = validateLancamentoPfIntegracao(fixed, emp);
    corrigidos += 1;
    detalhes.push({
      id: l.id,
      antes: errosAntes,
      depois: errosDepois,
      historico: l.historico,
      tipoAntes: l.tipo,
      tipoDepois: fixed.tipo,
    });
    return fixed;
  });

  const repaired = {
    ...prepared,
    empresas: [{ ...emp, lancamentos }],
  };

  return { repaired, corrigidos, jaOk, detalhes, totalIntegracao };
}

async function main() {
  const { rows: users } = await query(
    `SELECT id, email, nome, nome_perfil, tipo_perfil FROM usuarios WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  if (!users.length) {
    console.error(`Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  const user = users[0];
  if (normalizeTipoPerfil(user.tipo_perfil) !== 'fisica') {
    console.error('Script apenas para contas PF.');
    process.exit(1);
  }

  const { rows: est } = await query(
    'SELECT dados FROM estados WHERE usuario_id = $1',
    [user.id]
  );
  if (!est.length) {
    console.error('Sem estado.');
    process.exit(1);
  }

  const before = est[0].dados;
  const { repaired, corrigidos, jaOk, detalhes, totalIntegracao } = repairEstado(before, user);

  console.log('=== Reparo integração PF (entradas) —', email, dryRun ? '(DRY-RUN)' : '', '===\n');
  console.log('usuario_id:', user.id);
  console.log('Lançamentos integração PF:', totalIntegracao);
  console.log('Já corretos:', jaOk);
  console.log('A corrigir:', corrigidos);

  for (const d of detalhes.slice(0, 20)) {
    console.log(`  - ${d.historico?.slice(0, 50)}`);
    console.log(`    ${d.tipoAntes} → ${d.tipoDepois} | antes: ${d.antes.join(', ')}`);
    if (d.depois.length) console.log(`    ⚠ ainda inválido: ${d.depois.join(', ')}`);
  }
  if (detalhes.length > 20) console.log(`  ... +${detalhes.length - 20}`);

  if (corrigidos === 0) {
    console.log('\n✓ Nenhuma correção necessária.');
    await pool.end();
    return;
  }

  if (dryRun) {
    console.log('\n[DRY-RUN] Nenhuma gravação.');
    await pool.end();
    return;
  }

  ensureBackupDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `pf-integracao-entradas-${user.id}-${ts}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify({ backed_at: new Date().toISOString(), usuario_id: user.id, email: user.email, dados: before }, null, 2),
    'utf8'
  );
  console.log('\nBackup:', backupFile);

  await query('UPDATE estados SET dados = $1, updated_at = NOW() WHERE usuario_id = $2', [
    JSON.stringify(repaired),
    user.id,
  ]);
  console.log(`✓ ${corrigidos} lançamento(s) PF corrigido(s).`);
  await pool.end();
}

main().catch(async (err) => {
  console.error('Erro:', err.message);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
