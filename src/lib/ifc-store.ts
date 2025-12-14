import { promises as fs } from "fs";
import path from "path";
import { Pool } from "pg";

type IfcMetadata = {
  modelId: string;
  projectId: string;
  name?: string;
  materials: string[];
  objects?: number;
  zones?: number;
  createdAt?: string;
};

const dataDir = path.join(process.cwd(), "data");
const metaFile = path.join(dataDir, "ifc-metadata.json");

let cached: IfcMetadata[] | null = null;
let dbPool: Pool | null = null;
let dbReady = false;

async function ensureFile() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.access(metaFile);
  } catch {
    await fs.writeFile(metaFile, "[]", "utf-8");
  }
}

async function getDb(): Promise<Pool | null> {
  if (dbReady && dbPool) return dbPool;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    dbPool = new Pool({ connectionString: url });
    await dbPool.query("SELECT 1");
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS ifc_metadata (
        model_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT,
        materials TEXT[],
        objects INTEGER,
        zones INTEGER,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    dbReady = true;
    return dbPool;
  } catch (err) {
    console.error("IFC metadata: fallback til fil pga DB-feil", err);
    dbPool = null;
    return null;
  }
}

async function loadAll(): Promise<IfcMetadata[]> {
  const db = await getDb();
  if (db) {
    try {
      const res = await db.query<{
        model_id: string;
        project_id: string;
        name: string | null;
        materials: string[] | null;
        objects: number | null;
        zones: number | null;
        created_at: string;
      }>("SELECT model_id, project_id, name, materials, objects, zones, created_at FROM ifc_metadata");
      return res.rows.map((row) => ({
        modelId: row.model_id,
        projectId: row.project_id,
        name: row.name || undefined,
        materials: row.materials || [],
        objects: row.objects || undefined,
        zones: row.zones || undefined,
        createdAt: row.created_at,
      }));
    } catch (err) {
      console.error("IFC metadata: kunne ikke lese fra DB, fallback til fil", err);
    }
  }

  if (cached) return cached;
  await ensureFile();
  try {
    const raw = await fs.readFile(metaFile, "utf-8");
    const parsed = JSON.parse(raw) as IfcMetadata[];
    cached = parsed;
    return parsed;
  } catch (err) {
    console.error("IFC metadata: kunne ikke lese fil", err);
    return [];
  }
}

async function persistAll(data: IfcMetadata[]) {
  const db = await getDb();
  if (db) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      for (const row of data) {
        await client.query(
          `
            INSERT INTO ifc_metadata (model_id, project_id, name, materials, objects, zones)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (model_id) DO UPDATE SET
              project_id = excluded.project_id,
              name = excluded.name,
              materials = excluded.materials,
              objects = excluded.objects,
              zones = excluded.zones;
          `,
          [row.modelId, row.projectId, row.name || null, row.materials, row.objects || null, row.zones || null]
        );
      }
      await client.query("COMMIT");
      return;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("IFC metadata: kunne ikke skrive til DB, fallback til fil", err);
    } finally {
      client.release();
    }
  }

  cached = data;
  await ensureFile();
  await fs.writeFile(metaFile, JSON.stringify(data, null, 2), "utf-8");
}

export async function saveIfcMetadata(data: IfcMetadata) {
  const all = await loadAll();
  const idx = all.findIndex((m) => m.modelId === data.modelId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...data };
  } else {
    all.push(data);
  }
  await persistAll(all);
}

export async function getIfcMetadata(projectId: string, modelId: string): Promise<IfcMetadata | null> {
  const all = await loadAll();
  const match = all.find((m) => m.modelId === modelId && m.projectId === projectId);
  return match || null;
}

export async function getMaterialsForModel(projectId: string, modelId: string): Promise<string[]> {
  const meta = await getIfcMetadata(projectId, modelId);
  return meta?.materials || [];
}
