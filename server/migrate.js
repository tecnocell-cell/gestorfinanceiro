import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { query, pool } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");

export async function runMigrations() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const { rows } = await query(
      "SELECT 1 FROM schema_migrations WHERE name = $1",
      [file]
    );
    if (rows.length) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    await query(sql);
    await query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    console.log(`  ✓ migration: ${file}`);
  }
}

if (process.argv[1]?.includes("migrate.js")) {
  import("dotenv").then(({ config }) => {
    config();
    runMigrations()
      .then(() => pool.end())
      .catch((e) => {
        console.error(e);
        process.exit(1);
      });
  });
}
