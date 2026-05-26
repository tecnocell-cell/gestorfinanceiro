/**
 * Teste de integração: usuário PF → lançamentos → persistência → perfil
 * Uso: node server/integrationTest.js
 */
import { config } from "dotenv";
config();

import bcrypt from "bcryptjs";
import { query, pool } from "./db.js";
import { createInitialState, normalizeStateForUser } from "./initialState.js";

const BASE = `http://127.0.0.1:${process.env.PORT || 3001}/api`;
const TEST_EMAIL = `test_pf_${Date.now()}@test.local`;
const TEST_PASS = "test123456";

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...opts.headers,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${data.error || res.statusText}`);
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  console.log("=== Teste integração Gestor ===\n");

  // Health
  const status = await req("/status");
  assert(status.online, "API online");

  // Admin login
  const adminEmail = process.env.ADMIN_EMAIL || "giandersonfjs@gmail.com";
  let adminToken;
  try {
    const adminLogin = await req("/auth/login", {
      method: "POST",
      body: { email: adminEmail, senha: process.env.ADMIN_SENHA || "admin123" },
    });
    adminToken = adminLogin.token;
    assert(adminLogin.user.role === "admin", `Admin logado: ${adminEmail}`);
  } catch {
    console.log("  ⚠ Admin login falhou — criando tenant direto no DB");
  }

  // Cria usuário PF via admin ou DB
  let userId;
  if (adminToken) {
    const created = await req("/admin/users", {
      method: "POST",
      token: adminToken,
      body: {
        nome: "Teste PF",
        email: TEST_EMAIL,
        senha: TEST_PASS,
        tipo_perfil: "fisica",
        nome_perfil: "Finanças Teste",
      },
    });
    userId = created.user.id;
    assert(created.user.tipo_perfil === "fisica", "Usuário criado como PF");
  } else {
    const hash = await bcrypt.hash(TEST_PASS, 12);
    const ins = await query(
      `INSERT INTO usuarios (email, senha_hash, nome, role, ativo, tipo_perfil, nome_perfil)
       VALUES ($1,$2,'Teste PF','user',true,'fisica','Finanças Teste') RETURNING id`,
      [TEST_EMAIL, hash]
    );
    userId = ins.rows[0].id;
    const st = createInitialState("fisica", "Finanças Teste");
    await query("INSERT INTO estados (usuario_id, dados) VALUES ($1,$2)", [userId, JSON.stringify(st)]);
  }

  // Login PF
  const login = await req("/auth/login", {
    method: "POST",
    body: { email: TEST_EMAIL, senha: TEST_PASS },
  });
  const token = login.token;
  console.log("  login.user:", login.user);
  assert(login.user?.tipo_perfil === "fisica", `Login retorna tipo_perfil=fisica (got ${login.user?.tipo_perfil})`);

  const me = await req("/auth/me", { token });
  assert(me.user.tipo_perfil === "fisica", "/auth/me confirma PF");

  // Estado inicial
  let { dados, profile } = await req("/state", { token });
  if (!profile) profile = { tipo_perfil: login.user.tipo_perfil, nome_perfil: login.user.nome_perfil };
  const emp0 = dados.empresas.find((e) => e.id === dados.empresaAtivaId) || dados.empresas[0];
  assert(emp0.tipo === "fisica", `Empresa ativa é PF (tipo=${emp0.tipo})`);

  // Adiciona lançamento
  const lanc = {
    id: "test-lanc-1",
    codigo: 1,
    lote: "L001",
    data: `${new Date().getFullYear()}-05-15`,
    tipo: "Saida",
    valor: 150.5,
    historico: "Teste integração",
    planoId: emp0.planoContas[0]?.id || null,
    contaSaidaId: emp0.contas[0]?.id || null,
    contaEntradaId: null,
    consiliado: false,
    vencimento: `${new Date().getFullYear()}-05-20`,
    pago: false,
  };
  const empPatch = { ...emp0, lancamentos: [...(emp0.lancamentos || []), lanc] };
  const newState = {
    ...dados,
    empresas: dados.empresas.map((e) => (e.id === emp0.id ? empPatch : e)),
  };

  await req("/state", { method: "PUT", token, body: { dados: newState } });

  // Recarrega (simula logout/login)
  const reloaded = await req("/state", { token });
  const emp1 = reloaded.dados.empresas.find((e) => e.id === reloaded.dados.empresaAtivaId) || reloaded.dados.empresas[0];
  assert(emp1.lancamentos?.length >= 1, `Lançamento persistiu (${emp1.lancamentos?.length} itens)`);
  assert(emp1.lancamentos.some((l) => l.id === "test-lanc-1"), "Lançamento test-lanc-1 encontrado");
  assert(emp1.tipo === "fisica", "Após reload continua PF");

  // Normalização: estado PJ antigo + usuário PF
  const pjState = createInitialState("juridica", "Empresa Errada");
  pjState.empresas[0].lancamentos = [{ ...lanc, id: "lanc-pj-keep" }];
  const normalized = normalizeStateForUser(pjState, { tipo_perfil: "fisica", nome_perfil: "PF" });
  const empN = normalized.empresas[0];
  assert(empN.tipo === "fisica", "normalizeStateForUser converte para PF");
  assert(empN.lancamentos.length === 1, "normalizeStateForUser preserva lançamentos");

  // Cleanup
  await query("DELETE FROM estados WHERE usuario_id = $1", [userId]);
  await query("DELETE FROM usuarios WHERE id = $1", [userId]);
  console.log("\n=== Todos os testes passaram ===\n");
}

main()
  .catch((e) => {
    console.error("\n❌", e.message);
    process.exit(1);
  })
  .finally(() => pool.end());
