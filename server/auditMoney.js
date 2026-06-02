/**
 * Relatório de pontos com aritmética monetária fora de roundMoney/addMoney/subMoney/safeNum.
 * Uso: node server/auditMoney.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const SCAN_DIRS = [
  path.join(ROOT, 'server'),
  path.join(ROOT, 'src', 'gestor'),
];

const SKIP_FILES = new Set([
  'auditMoney.js',
  'testFinanceMoney.js',
  'testMoneyFull.js',
  'money.js',
  'finance.js',
  'normalizeEstadoMoney.js',
]);

const SAFE_FUNCS = ['roundMoney', 'addMoney', 'subMoney', 'safeNum', 'reaisFromCentavos', 'parseValorToCentavos', 'parseValor', 'resolveValorCentavos', 'parseDecimalMoneyString', 'parseMoneyInputToCentavos', 'fixValorFromCentavosDrift', 'normValorField'];

const RISK_PATTERNS = [
  { re: /parseFloat\s*\(/g, label: 'parseFloat(' },
  { re: /Math\.round\s*\([^)]*\*\s*100/g, label: 'Math.round(*100)' },
  { re: /valor\s*:\s*parseFloat/g, label: 'valor: parseFloat' },
  { re: /\.valor\s*[\+\-\*\/]=/g, label: 'valor op=' },
  { re: /reduce\s*\(\s*\(\s*\w+\s*,/g, label: 'reduce(sum,' },
];

function isSafeLine(line) {
  if (SAFE_FUNCS.some((f) => line.includes(f))) return true;
  if (/addMoney|subMoney|roundMoney|safeNum/.test(line)) return true;
  if (/waiting_seconds|Math\.round\(.*\/\s*1000\)/.test(line)) return true;
  if (/orcado|percent|%\)|codigo|Number\(l\.codigo\)/.test(line)) return true;
  return false;
}

function scanFile(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const base = path.basename(filePath);
  if (SKIP_FILES.has(base)) return [];
  if (!/\.(js|jsx)$/.test(base)) return [];

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const findings = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    for (const { re, label } of RISK_PATTERNS) {
      re.lastIndex = 0;
      if (!re.test(line)) continue;
      if (isSafeLine(line)) continue;
      findings.push({ rel, line: i + 1, label, snippet: trimmed.slice(0, 100) });
    }
  });

  return findings;
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'backups' || name === 'migrations') continue;
      walk(full, acc);
    } else acc.push(full);
  }
  return acc;
}

const allFindings = [];
for (const dir of SCAN_DIRS) {
  for (const f of walk(dir)) {
    allFindings.push(...scanFile(f));
  }
}

console.log('=== auditMoney — pontos a revisar ===\n');
console.log(`Total: ${allFindings.length}\n`);

const byFile = new Map();
for (const x of allFindings) {
  if (!byFile.has(x.rel)) byFile.set(x.rel, []);
  byFile.get(x.rel).push(x);
}

for (const [rel, items] of [...byFile.entries()].sort()) {
  console.log(`\n${rel} (${items.length})`);
  for (const it of items) {
    console.log(`  L${it.line} [${it.label}] ${it.snippet}`);
  }
}

const reportPath = path.join(__dirname, 'auditMoney-report.txt');
const body = [
  `# auditMoney ${new Date().toISOString()}`,
  `Total: ${allFindings.length}`,
  ...allFindings.map((x) => `${x.rel}:${x.line} [${x.label}] ${x.snippet}`),
].join('\n');
fs.writeFileSync(reportPath, body, 'utf8');
console.log(`\nRelatório gravado: ${reportPath}`);
