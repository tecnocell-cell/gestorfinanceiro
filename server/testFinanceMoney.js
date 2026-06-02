/**
 * Testes de arredondamento monetário (hotfix centavos).
 * Uso: node server/testFinanceMoney.js
 */
import { addMoney, fmtBRL, roundMoney, safeNum, subMoney } from "../src/gestor/finance.js";

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

function eq(a, b, msg) {
  assert(a === b, `${msg} (esperado ${b}, obteve ${a})`);
}

console.log("=== Testes roundMoney / safeNum ===\n");

eq(subMoney(35000, 34000), 1000, "35000 - 34000 = 1000.00");
eq(addMoney(0.1, 0.2), 0.3, "0.1 + 0.2 = 0.30");
eq(subMoney(1000.1, 999.9), 0.2, "1000.10 - 999.90 = 0.20");
eq(addMoney(-1000, 500), -500, "-1000 + 500 = -500.00");
eq(safeNum(-1500.555), -1500.56, "valor negativo arredondado");
eq(roundMoney(-99.994), -99.99, "negativo próximo de zero");

eq(
  fmtBRL(subMoney(35000, 34000)),
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(1000),
  "fmtBRL exibe R$ 1.000,00 no lucro"
);

let acc = 0;
for (let i = 0; i < 10; i++) acc = addMoney(acc, 0.1);
eq(acc, 1, "10 × 0,10 = 1,00");

console.log("\n=== Todos os testes monetários passaram ===\n");
