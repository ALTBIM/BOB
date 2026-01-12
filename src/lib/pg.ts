import { Pool } from "pg";

let pool: Pool | null = null;
let ready = false;

export async function getPgPool(): Promise<Pool> {
  if (pool && ready) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL mangler");
  }
  pool = new Pool({ connectionString: url });
  await pool.query("SELECT 1");
  ready = true;
  return pool;
}
