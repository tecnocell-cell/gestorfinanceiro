/**
 * Diagnóstico do estado PF (JSONB estados).
 * Uso: node server/diagnosticoPfEstado.js <email>
 */
import { config } from 'dotenv';
config();

import { query, pool } from './db.js';
import { normalizeTipoPerfil } from './profileTipo.js';
import { analyzePfEstado, collectLancamentosRaw } from './repairPfLegacyState.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Uso: node server/diagnosticoPfEstado.js <email>');
  process.exit(1);
}

async function main() {
  const { rows: users } = await query(
    `SELECT id, email, nome, nome_perfil, tipo_perfil, ativo
     FROM usuarios WHERE LOWER(email) = LOWER($1)`,
    [email]
  );

  if (!users.length) {
    console.error(`Usuário não encontrado: ${email}`);
    process.exit(1);
  }

  const user = users[0];
  const tipo = normalizeTipoPerfil(user.tipo_perfil);

  const { rows: est } = await query(
    'SELECT usuario_id, dados, updated_at FROM estados WHERE usuario_id = $1',
    [user.id]
  );

  const { rows: recs } = await query(
    `SELECT id, descricao, status, proxima_data, periodicidade, valor, tipo
     FROM recorrencias WHERE usuario_id = $1 ORDER BY proxima_data`,
    [user.id]
  );

  console.log('=== Diagnóstico PF —', email, '===\n');
  console.log('usuario_id:     ', user.id);
  console.log('tipo_perfil:    ', tipo, `(bruto: ${JSON.stringify(user.tipo_perfil)})`);
  console.log('nome_perfil:    ', user.nome_perfil || user.nome);
  console.log('estado updated: ', est[0]?.updated_at || '(sem linha estados)');

  if (!est.length) {
    console.log('\n⚠ Sem registro em estados.');
    await pool.end();
    return;
  }

  const dados = est[0].dados;
  const rootLen = Array.isArray(dados?.lancamentos) ? dados.lancamentos.length : 0;

  console.log('\n--- Estrutura dados ---');
  console.log('dados.lancamentos.length (root):', rootLen);
  console.log('dados.empresas.length:          ', dados?.empresas?.length ?? 0);
  console.log('dados.empresaAtivaId:           ', dados?.empresaAtivaId ?? '(não definido)');
  console.log(
    'dados.recorrencias (JSONB):     ',
    Array.isArray(dados?.recorrencias) ? dados.recorrencias.length : '(ausente)'
  );

  const analysis = analyzePfEstado(dados);
  console.log('\n--- Por empresa ---');
  for (const e of analysis.porEmpresa) {
    console.log(
      `  [${e.index}] ${e.nome || '?'} (${e.tipo || '?'})` +
        `${e.ativa ? ' ← ATIVA' : ''} id=${e.id}`
    );
    console.log(
      `      lancamentos=${e.lancamentos} metas=${e.metas} orcamentos=${e.orcamentos}` +
        ` contas=${e.contas} categorias=${e.planoContas}`
    );
    if (!e.ativa && e.lancamentos > 0) {
      console.log(`      ⚠ ${e.lancamentos} lançamento(s) em empresa NÃO ativa`);
    }
  }

  console.log('\n--- Lançamentos (todas as fontes) ---');
  console.log('Total (com duplicatas de id):', analysis.totalLancamentosTagged);
  console.log('Total únicos por id:         ', analysis.totalLancamentosUnicos);
  console.log('Duplicados por id:           ', analysis.duplicadosPorId);
  console.log('Em empresas inativas:        ', analysis.emEmpresasInativas);
  console.log('Em root dados.lancamentos:   ', analysis.emRoot);
  console.log('Por source:', analysis.bySource);

  console.log('\n--- Vencimento / status ---');
  console.log('Com campo vencimento:', analysis.vencimentoStatus.comVencimento);
  console.log('Com campo status:    ', analysis.vencimentoStatus.comStatus);
  console.log('Marcados pagos:      ', analysis.vencimentoStatus.comPago);
  console.log('Em aberto (aprox.):  ', analysis.vencimentoStatus.abertos);

  const { all } = collectLancamentosRaw(dados);
  const byLoc = {};
  for (const l of all) {
    byLoc[l._location] = (byLoc[l._location] || 0) + 1;
  }
  console.log('\n--- Onde estão os lançamentos ---');
  for (const [loc, n] of Object.entries(byLoc).sort()) {
    console.log(`  ${loc}: ${n}`);
  }

  console.log('\n--- Recorrências (tabela recorrencias) ---');
  console.log('Total no banco:', recs.length);
  for (const r of recs.slice(0, 15)) {
    console.log(
      `  - ${r.descricao} | ${r.status} | próx: ${r.proxima_data} | ${r.periodicidade} | R$ ${r.valor}`
    );
  }
  if (recs.length > 15) console.log(`  ... +${recs.length - 15} mais`);

  const activeCount = analysis.porEmpresa.find((e) => e.ativa)?.lancamentos ?? 0;
  const hidden =
    analysis.totalLancamentosUnicos - activeCount - (analysis.emRoot > 0 ? 0 : 0);

  console.log('\n--- Conclusão ---');
  if (analysis.emEmpresasInativas > 0 || analysis.emRoot > 0) {
    console.log(
      '⚠ Lançamentos fora da empresa ativa detectados.',
      `UI mostra ~${activeCount} na ativa, mas existem ${analysis.totalLancamentosUnicos} únicos no JSONB.`
    );
    console.log(
      '  Rode: node server/repairPfLegacyState.js',
      email,
      '--dry-run'
    );
  } else if (analysis.duplicadosPorId > 0) {
    console.log('⚠ Há IDs duplicados — reparo pode consolidar.');
  } else if (activeCount < analysis.totalLancamentosUnicos) {
    console.log('⚠ Contagem ativa < total único — verificar empresaAtivaId.');
  } else {
    console.log('✓ Todos os lançamentos parecem estar na empresa ativa (ou root).');
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error('Erro:', err.message);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
