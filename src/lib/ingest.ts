import { v4 as uuidv4 } from "uuid";
import xlsx from "xlsx";
import { getPgPool } from "@/lib/pg";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
const EMBED_DIM = Number(
  process.env.OPENAI_EMBED_DIM ||
    (OPENAI_EMBED_MODEL === "text-embedding-3-large" ? "3072" : "1536")
);

const chunkText = (text: string, maxChars = 1500, overlap = 200) => {
  const clean = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  if (!clean) return chunks;
  for (let i = 0; i < clean.length; i += maxChars - overlap) {
    chunks.push(clean.slice(i, i + maxChars));
  }
  return chunks;
};

const toSqlVector = (embedding: number[]) => `[${embedding.join(",")}]`;

const embedTexts = async (texts: string[]) => {
  if (!OPENAI_API_KEY) return null;
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBED_MODEL,
      input: texts,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Embedding feilet: ${response.status} ${text}`);
  }
  const json = await response.json();
  return (json?.data || []).map((d: any) => d.embedding as number[]);
};

export type IngestTextParams = {
  projectId: string;
  fileId?: string;
  title: string;
  discipline?: string;
  reference?: string;
  sourcePath?: string;
  sourceType?: string;
  text: string;
  userId: string;
};

export async function ingestTextDocument(params: IngestTextParams) {
  const pool = await getPgPool();
  const client = await pool.connect();
  const jobId = uuidv4();
  const documentId = uuidv4();
  const warnings: Array<{ code: string; message: string }> = [];

  const chunks = chunkText(params.text);
  let embeddings: number[][] | null = null;
  if (!OPENAI_API_KEY) {
    warnings.push({
      code: "missing_openai_key",
      message: "OPENAI_API_KEY mangler. Dokumentet er lagret uten embeddings.",
    });
  }
  try {
    embeddings = await embedTexts(chunks);
    if (embeddings && embeddings.some((embedding) => embedding?.length !== EMBED_DIM)) {
      const bad = embeddings.find((embedding) => embedding?.length !== EMBED_DIM);
      warnings.push({
        code: "embedding_dim_mismatch",
        message: `Embedding-dimensjon ${bad?.length ?? "ukjent"} matcher ikke forventet ${EMBED_DIM}.`,
      });
      embeddings = null;
    }
  } catch (err: any) {
    warnings.push({ code: "embedding_failed", message: err?.message || "Kunne ikke hente embeddings" });
    embeddings = null;
  }

  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO ingest_jobs (id, project_id, file_id, status, started_at, created_by)
       VALUES ($1, $2, $3, $4, now(), $5)`,
      [jobId, params.projectId, params.fileId || null, "running", params.userId]
    );

    await client.query(
      `INSERT INTO documents (id, project_id, file_id, title, discipline, reference, source_path, source_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        documentId,
        params.projectId,
        params.fileId || null,
        params.title,
        params.discipline || null,
        params.reference || null,
        params.sourcePath || null,
        params.sourceType || null,
        params.userId,
      ]
    );

    for (let i = 0; i < chunks.length; i += 1) {
      const content = chunks[i];
      const embedding = embeddings ? embeddings[i] : null;
      const tokenCount = content.split(/\s+/).filter(Boolean).length;
      const chunkId = uuidv4();
      await client.query(
        `INSERT INTO document_chunks (id, project_id, document_id, chunk_index, content, token_count, embedding, source_page, source_section)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          chunkId,
          params.projectId,
          documentId,
          i,
          content,
          tokenCount,
          embedding ? toSqlVector(embedding) : null,
          null,
          null,
        ]
      );

      await client.query(
        `INSERT INTO sources (project_id, document_id, chunk_id, title, reference, discipline, snippet, source_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          params.projectId,
          documentId,
          chunkId,
          params.title,
          params.reference || null,
          params.discipline || null,
          content.slice(0, 240),
          params.sourcePath || null,
        ]
      );
    }

    for (const warning of warnings) {
      await client.query(
        `INSERT INTO ingest_warnings (project_id, file_id, ingest_job_id, code, message)
         VALUES ($1, $2, $3, $4, $5)`,
        [params.projectId, params.fileId || null, jobId, warning.code, warning.message]
      );
    }

    await client.query(
      `UPDATE ingest_jobs SET status = $2, finished_at = now() WHERE id = $1`,
      [jobId, "completed"]
    );

    await client.query("COMMIT");
    return { jobId, documentId, chunks: chunks.length, warnings };
  } catch (err) {
    await client.query("ROLLBACK");
    await client.query(
      `UPDATE ingest_jobs SET status = $2, error = $3, finished_at = now() WHERE id = $1`,
      [jobId, "failed", (err as Error).message]
    );
    throw err;
  } finally {
    client.release();
  }
}

type ScheduleRow = Record<string, any>;

const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, "");

const mapScheduleRow = (row: ScheduleRow) => {
  const normalized: Record<string, any> = {};
  Object.entries(row).forEach(([key, value]) => {
    normalized[normalizeKey(key)] = value;
  });

  const value = (keys: string[]) => keys.map((k) => normalized[normalizeKey(k)]).find((v) => v !== undefined && v !== "");
  const parseDate = (input: any) => {
    if (!input) return null;
    if (input instanceof Date) return input.toISOString().slice(0, 10);
    if (typeof input === "number") {
      const parsed = xlsx.SSF.parse_date_code(input);
      if (parsed) {
        const month = String(parsed.m).padStart(2, "0");
        const day = String(parsed.d).padStart(2, "0");
        return `${parsed.y}-${month}-${day}`;
      }
    }
    const d = new Date(input);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  };

  return {
    task_id: value(["task_id", "taskid", "id"]),
    name: value(["name", "task", "taskname", "aktivitet", "aktivitetsnavn"]),
    discipline: value(["discipline", "owner", "fag", "ansvarlig"]),
    owner: value(["owner", "discipline", "ansvarlig"]),
    zone: value(["zone", "sone"]),
    room: value(["room", "rom"]),
    start_date: parseDate(value(["start_date", "start", "startdato"])),
    end_date: parseDate(value(["end_date", "end", "sluttdato"])),
    duration_days: Number(value(["duration_days", "duration", "varighet"])) || null,
    status: value(["status"]),
    dependencies: value(["dependencies", "predecessors", "depends"]) || null,
    milestone: Boolean(value(["milestone", "milepæl", "is_milestone"])),
    notes: value(["notes", "notat", "comments"]),
  };
};

export async function ingestScheduleFile(params: {
  projectId: string;
  fileId?: string;
  filename: string;
  buffer: Buffer;
  userId: string;
}) {
  const pool = await getPgPool();
  const client = await pool.connect();
  const jobId = uuidv4();
  const warnings: Array<{ code: string; message: string }> = [];

  let rows: ScheduleRow[] = [];
  try {
    const workbook = xlsx.read(params.buffer, { type: "buffer" });
    const sheetName = workbook.Sheets["Tasks"] ? "Tasks" : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      warnings.push({ code: "missing_sheet", message: "Fant ingen ark i fremdriftsplanen." });
    } else {
      rows = xlsx.utils.sheet_to_json(sheet, { defval: "" }) as ScheduleRow[];
    }
  } catch (err: any) {
    warnings.push({ code: "parse_error", message: err?.message || "Kunne ikke lese regneark" });
  }

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO ingest_jobs (id, project_id, file_id, status, started_at, created_by)
       VALUES ($1, $2, $3, $4, now(), $5)`,
      [jobId, params.projectId, params.fileId || null, "running", params.userId]
    );

    let inserted = 0;
    for (const row of rows) {
      const mapped = mapScheduleRow(row);
      if (!mapped.name) {
        warnings.push({ code: "missing_name", message: "Fant rad uten navn i fremdriftsplan." });
        continue;
      }
      const dependencies =
        typeof mapped.dependencies === "string"
          ? mapped.dependencies.split(",").map((d: string) => d.trim()).filter(Boolean)
          : Array.isArray(mapped.dependencies)
          ? mapped.dependencies
          : null;

      await client.query(
        `INSERT INTO project_schedule_tasks (
          project_id, file_id, task_id, name, discipline, owner, zone, room,
          start_date, end_date, duration_days, status, dependencies, milestone, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          params.projectId,
          params.fileId || null,
          mapped.task_id || null,
          mapped.name,
          mapped.discipline || null,
          mapped.owner || null,
          mapped.zone || null,
          mapped.room || null,
          mapped.start_date,
          mapped.end_date,
          mapped.duration_days,
          mapped.status || null,
          dependencies,
          mapped.milestone || false,
          mapped.notes || null,
        ]
      );
      inserted += 1;
    }

    for (const warning of warnings) {
      await client.query(
        `INSERT INTO ingest_warnings (project_id, file_id, ingest_job_id, code, message)
         VALUES ($1, $2, $3, $4, $5)`,
        [params.projectId, params.fileId || null, jobId, warning.code, warning.message]
      );
    }

    await client.query(
      `UPDATE ingest_jobs SET status = $2, finished_at = now() WHERE id = $1`,
      [jobId, "completed"]
    );
    await client.query("COMMIT");
    return { jobId, inserted, warnings };
  } catch (err) {
    await client.query("ROLLBACK");
    await client.query(
      `UPDATE ingest_jobs SET status = $2, error = $3, finished_at = now() WHERE id = $1`,
      [jobId, "failed", (err as Error).message]
    );
    throw err;
  } finally {
    client.release();
  }
}
