import pg from "pg";
const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://gestor:gestor123@localhost:5432/gestor_db",
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err.message);
});

export const query = (text, params) => pool.query(text, params);
