import { Pool, PoolClient } from "pg";

export type IfcObjectRow = {
  modelId: string;
  projectId: string;
  globalId: string;
  expressId: number;
  ifcType: string;
  name: string | null;
  storey: string | null;
  space: string | null;
};

export type IfcPsetRow = {
  modelId: string;
  projectId: string;
  globalId: string;
  psetName: string;
  propName: string;
  value: string | null;
  unit: string | null;
};

export type IfcQuantityRow = {
  modelId: string;
  projectId: string;
  globalId: string;
  qtoSet: string | null;
  name: string;
  value: number;
  unit: string | null;
  source: "ifc_qto" | "pset_qto" | "calculated";
  method: string | null;
  quantityType: "AREA" | "LENGTH" | "VOLUME" | "COUNT" | "WEIGHT" | "OTHER";
};

type IfcIndex = {
  objects: IfcObjectRow[];
  psets: IfcPsetRow[];
  quantities: IfcQuantityRow[];
};

let dbPool: Pool | null = null;
let dbReady = false;

async function getDb(): Promise<Pool> {
  if (dbPool && dbReady) return dbPool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL mangler");
  }
  dbPool = new Pool({ connectionString: url });
  await dbPool.query("SELECT 1");
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS ifc_object (
      model_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      global_id TEXT NOT NULL,
      express_id INTEGER NOT NULL,
      ifc_type TEXT NOT NULL,
      name TEXT,
      storey TEXT,
      space TEXT,
      PRIMARY KEY (model_id, global_id)
    );
  `);
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS ifc_pset (
      model_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      global_id TEXT NOT NULL,
      pset_name TEXT NOT NULL,
      prop_name TEXT NOT NULL,
      value TEXT,
      unit TEXT
    );
  `);
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS ifc_quantity (
      model_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      global_id TEXT NOT NULL,
      qto_set TEXT,
      name TEXT NOT NULL,
      value NUMERIC NOT NULL,
      unit TEXT,
      source TEXT NOT NULL,
      method TEXT,
      quantity_type TEXT NOT NULL
    );
  `);
  dbReady = true;
  return dbPool;
}

const insertBatch = async (
  pool: Pool | PoolClient,
  table: string,
  columns: string[],
  rows: unknown[][],
  batchSize = 500
) => {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders = batch
      .map((row, rowIndex) => {
        const offset = rowIndex * columns.length;
        values.push(...row);
        const cols = columns.map((_, colIndex) => `$${offset + colIndex + 1}`);
        return `(${cols.join(", ")})`;
      })
      .join(", ");
    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${placeholders}`;
    await pool.query(sql, values);
  }
};

export async function saveIfcIndex(modelId: string, projectId: string, index: IfcIndex) {
  const pool = await getDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM ifc_object WHERE model_id = $1 AND project_id = $2", [modelId, projectId]);
    await client.query("DELETE FROM ifc_pset WHERE model_id = $1 AND project_id = $2", [modelId, projectId]);
    await client.query("DELETE FROM ifc_quantity WHERE model_id = $1 AND project_id = $2", [modelId, projectId]);

    await insertBatch(
      client,
      "ifc_object",
      ["model_id", "project_id", "global_id", "express_id", "ifc_type", "name", "storey", "space"],
      index.objects.map((row) => [
        row.modelId,
        row.projectId,
        row.globalId,
        row.expressId,
        row.ifcType,
        row.name,
        row.storey,
        row.space,
      ])
    );

    await insertBatch(
      client,
      "ifc_pset",
      ["model_id", "project_id", "global_id", "pset_name", "prop_name", "value", "unit"],
      index.psets.map((row) => [
        row.modelId,
        row.projectId,
        row.globalId,
        row.psetName,
        row.propName,
        row.value,
        row.unit,
      ])
    );

    await insertBatch(
      client,
      "ifc_quantity",
      ["model_id", "project_id", "global_id", "qto_set", "name", "value", "unit", "source", "method", "quantity_type"],
      index.quantities.map((row) => [
        row.modelId,
        row.projectId,
        row.globalId,
        row.qtoSet,
        row.name,
        row.value,
        row.unit,
        row.source,
        row.method,
        row.quantityType,
      ])
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getQuantitySummary(params: {
  modelId: string;
  projectId: string;
  groupBy: "type" | "storey" | "space";
  fields: ("AREA" | "LENGTH" | "VOLUME" | "COUNT" | "WEIGHT")[];
  filterType?: string;
  filterName?: string;
}) {
  const pool = await getDb();
  const groupColumn =
    params.groupBy === "storey"
      ? "o.storey"
      : params.groupBy === "space"
        ? "o.space"
        : "o.ifc_type";

  const fieldList = params.fields.length > 0 ? params.fields : ["AREA", "LENGTH", "VOLUME"];
  const values: unknown[] = [params.modelId, params.projectId, fieldList];
  let where = "o.model_id = $1 AND o.project_id = $2 AND q.quantity_type = ANY($3)";
  if (params.filterType) {
    values.push(params.filterType);
    where += ` AND o.ifc_type = $${values.length}`;
  }
  if (params.filterName) {
    values.push(params.filterName);
    where += ` AND q.name = $${values.length}`;
  }

  const sql = `
    SELECT
      COALESCE(${groupColumn}, 'Ukjent') AS group_label,
      q.quantity_type AS quantity_type,
      q.name AS quantity_name,
      q.source AS source,
      q.unit AS unit,
      SUM(q.value) AS value
    FROM ifc_quantity q
    JOIN ifc_object o
      ON q.model_id = o.model_id
      AND q.project_id = o.project_id
      AND q.global_id = o.global_id
    WHERE ${where}
    GROUP BY group_label, q.quantity_type, q.name, q.source, q.unit
    ORDER BY group_label, q.quantity_type, q.name;
  `;

  const res = await pool.query(sql, values);
  return res.rows.map((row) => ({
    group: row.group_label as string,
    quantityType: row.quantity_type as string,
    name: row.quantity_name as string,
    source: row.source as string,
    unit: row.unit as string | null,
    value: Number(row.value || 0),
  }));
}
