/**
 * Testes monetários completos (casos reportados pelo usuário).
 * Uso: npm run test:money-full
 */
import { addMoney, subMoney, roundMoney, safeNum } from '../src/gestor/finance.js';
import {
  parseValorToCentavos,
  reaisFromCentavos,
  parseDecimalMoneyString,
} from './utils/money.js';
import { fixValorFromCentavosDrift } from './normalizeEstadoMoney.js';

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

function eq(a, b, msg) {
  assert(a === b, `${msg} (esperado ${b}, obteve ${a})`);
}

console.log('=== test:money-full ===\n');

eq(subMoney(5000, 0), 5000, '5000 - 0 = 5000');
eq(subMoney(15000, 0), 15000, '15000 - 0 = 15000');
eq(subMoney(35000, 34000), 1000, '35000 - 34000 = 1000');
eq(addMoney(0.1, 0.2), 0.3, '0.1 + 0.2 = 0.3');
eq(addMoney(15000, 5000), 20000, '15000 + 5000 = 20000');

eq(parseValorToCentavos(5000), 500000, '5000 → centavos');
eq(reaisFromCentavos(500000), 5000, '500000 centavos → 5000');
eq(reaisFromCentavos(1500000), 15000, '1500000 centavos → 15000');
eq(parseDecimalMoneyString('15.000,00'), 15000, 'BR 15.000,00');

eq(fixValorFromCentavosDrift(4999.99), 5000, 'corrige 4999.99 → 5000');
eq(fixValorFromCentavosDrift(14999.98), 15000, 'corrige 14999.98 → 15000');
eq(safeNum(4999.99), 4999.99, 'safeNum não inventa centavo');
eq(roundMoney(safeNum(5000)), 5000, '5000 estável');

console.log('\n=== test:money-full: OK ===\n');
