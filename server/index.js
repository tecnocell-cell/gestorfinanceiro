import express from "express";
import cors from "cors";
import { buildSyncPayload } from "./lacusMap.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "4mb" }));

let odbcModule = null;
async function getOdbc() {
  if (odbcModule) return odbcModule;
  try {
    odbcModule = await import("odbc");
    return odbcModule;
  } catch {
    return null;
  }
}

async function queryTable(connection, tableName) {
  try {
    return await connection.query(`SELECT * FROM [${tableName}]`);
  } catch {
    return [];
  }
}

const SYNC_TABLES = [
  { key: "contas", table: "BC_Contas" },
  { key: "plano", table: "BC_Classificacao_DRE" },
  { key: "empresa", table: "BC_Cadastro_Empresa" },
  { key: "clientes", table: "BC_Cadastro_Clientes" },
  { key: "fornecedores", table: "BC_Cadastro_Fornecedores" },
  { key: "lancamentos", table: "BC_Lancamentos" },
  { key: "versao", table: "TB_Versao_Banco_dados" },
];

app.get("/api/status", (_req, res) => {
  res.json({ online: true, driver: "Microsoft Access Driver (Lacus TB_*)", port: PORT });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/sync", async (req, res) => {
  const { path: dbPath, password } = req.body || {};
  if (!dbPath) {
    return res.status(400).json({ error: "Informe o caminho do banco Access (path)." });
  }

  const odbc = await getOdbc();
  if (!odbc?.connect) {
    return res.status(503).json({
      error: "Driver ODBC não disponível. Instale o pacote odbc e o Microsoft Access Driver (Windows).",
    });
  }

  const pwd = password ? `;PWD=${password}` : "";
  const connStr = `Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=${dbPath}${pwd};`;

  let connection;
  try {
    connection = await odbc.connect(connStr);
    const raw = {};
    for (const { key, table } of SYNC_TABLES) {
      raw[key] = await queryTable(connection, table);
    }

    const payload = buildSyncPayload(raw);
    if (
      !payload.contas?.length &&
      !payload.planoContas?.length &&
      !payload.lancamentos?.length &&
      !payload.company
    ) {
      return res.status(404).json({
        error: "Banco conectado, mas sem tabelas BC_* preenchidas. Use um .accdb Lacus com dados.",
        meta: payload.meta,
      });
    }

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message || "Erro ao conectar no Access" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch {
        /* ignore */
      }
    }
  }
});

app.listen(PORT, () => {
  console.log(`Gestor API Lacus em http://localhost:${PORT}`);
});
