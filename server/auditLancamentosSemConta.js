/**
 * Auditoria read-only: lançamentos pagos sem conta.
 * Uso: node server/auditLancamentosSemConta.js email@usuario.com
 */
import { config } from 'dotenv';
config();

import { query, pool } from './db.js';
import { auditDadosSemConta } from './lancamentosSemContaUtils.js';

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error('Uso: node server/auditLancamentosSemConta.js <email>');
  process.exit(1);
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
    'SELECT dados FROM estados WHERE usuario_id = $1',
    [user.id]
  );
  if (!est.length) {
    console.error('Sem registro em estados.');
    process.exit(1);
  }

  const { itens, reparaveis, alertas } = auditDadosSemConta(est[0].dados);

  console.log('=== Audit lançamentos sem conta —', user.email, '===\n');
  console.log('usuario_id:', user.id);
  console.log('tipo_perfil:', user.tipo_perfil);
  console.log('Total sem conta:     ', itens.length);
  console.log('Reparáveis (recorr.):', reparaveis);
  console.log('Alertas (manual):    ', alertas);

  if (!itens.length) {
    console.log('\n✓ Nenhum lançamento pago sem conta.');
    await pool.end();
    return;
  }

  console.log('\n--- Detalhes ---');
  for (const i of itens) {
    console.log(
      `[${i.reparavel ? 'REPARAR' : 'ALERTA'}] ${i.id} | ${i.tipo} R$ ${i.valor} | ${i.historico || '—'} | ${i.motivo}${i.recorrenciaId ? ` rec=${i.recorrenciaId}` : ''}`
    );
  }

  if (reparaveis > 0) {
    console.log('\nReparo sugerido:');
    console.log(`  node server/repairLancamentosSemConta.js --email ${email} --dry-run`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error('Erro:', err.message);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
