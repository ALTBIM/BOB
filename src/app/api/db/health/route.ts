import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";

let pool: Pool | null = null;

const getPool = () => {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL missing");
  }
  pool = new Pool({
    connectionString: url,
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });
  return pool;
};

export async function GET() {
  try {
    const db = getPool();
    const result = await db.query("SELECT 1 as ok");
    return NextResponse.json({ ok: true, result: result.rows?.[0]?.ok ?? 1 });
  } catch (err: any) {
    console.error("DB health error", err);
    return NextResponse.json(
      { ok: false, error: "DB health failed", detail: String(err) },
      { status: 500 }
    );
  }
}
