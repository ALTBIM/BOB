import { v4 as uuidv4 } from "uuid";
import xlsx from "xlsx";
import { getPgPool } from "@/lib/pg";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
const EMBED_DIM = Number(
  process.env.OPENAI_EMBED_DIM ||
    (OPENAI_EMBED_MODEL === "text-embedding-3-large" ? "3072" : "1536")
);

const chunkTextByTokens = (text: string, targetTokens = 1000, overlapTokens = 175) => {
  // Best-effort token approximation using words as proxy
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ").filter(Boolean);
  const chunks: string[] = [];
  const target = Math.max(900, Math.min(1200, targetTokens));
  const overlap = Math.max(150, Math.min(200, overlapTokens));
  // treat tokens ~= words (best effort)
  let i = 0;
  while (i < words.length) {
    const end = Math.min(words.length, i + target);
    const slice = words.slice(i, end).join(" ");
    chunks.push(slice);
    if (end >= words.length) break;
    i = end - overlap; // overlap in words
    if (i < 0) i = 0;
  }
  return chunks;
};

// Helper to chunk with page awareness
const chunkPages = (pages: Array<{ text: string; page?: number | null; section?: string | null }>) => {
  const out: Array<{ content: string; source_page?: number | null; source_section?: string | null }> = [];
  for (const p of pages) {
    const pageChunks = chunkTextByTokens(p.text);
    for (let i = 0; i < pageChunks.length; i += 1) {
      out.push({ content: pageChunks[i], source_page: p.page ?? null, source_section: p.section ?? null });
    }
  }
  return out;
};

const toSqlVector = (embedding: number[]) => `[${embedding.join(",")}]`;

const embedTexts = async (texts: string[]) => {
  if (!OPENAI_API_KEY) throw new Error("MISSING_OPENAI_KEY");
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
    throw new Error(`Embedding failed: ${response.status} ${text}`);
  }
  const json = await response.json();
  const embeddings = (json?.data || []).map((d: any) => d.embedding as number[]);
  // fail-fast if any embedding has wrong dim
  const bad = embeddings.find((e) => !e || e.length !== EMBED_DIM);
  if (bad) {
    throw new Error(`Embedding dim mismatch: found ${bad?.length ?? 0}, expected ${EMBED_DIM}`);
  }
  return embeddings;
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

export async function ingestTextDocument(params: IngestTextParams & { pages?: Array<{ text: string; page?: number | null; section?: string | null }> }) {
  const pool = await getPgPool();
  const client = await pool.connect();
  const jobId = (params as any).jobId || uuidv4();
  const documentId = uuidv4();
  const warnings: Array<{ code: string; message: string; severity?: string; meta?: any }> = [];

  // If pages provided, chunk per page, else chunk whole text
  let rawChunks: Array<{ content: string; source_page?: number | null; source_section?: string | null }> = [];
  if (params.pages && params.pages.length > 0) {
    rawChunks = chunkPages(params.pages);
  } else {
    const pageLike = [{ text: params.text, page: null as number | null }];
    rawChunks = chunkPages(pageLike);
  }

  let embeddings: number[][] | null = null;
  try {
    embeddings = await embedTexts(rawChunks.map((c) => c.content));
  } catch (err: any) {
    // Fail fast on embedding issues
    warnings.push({ code: "embedding_failed", message: err?.message || "Embedding failed", severity: "error" });
    // Persist job as failed and record warning
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO ingest_jobs (id, project_id, file_id, job_type, status, started_at, created_by)
         VALUES ($1, $2, $3, $4, $5, now(), $6)`,
        [jobId, params.projectId, params.fileId || null, params.sourceType || null, "failed", params.userId]
      );
      await client.query(
        `INSERT INTO ingest_warnings (project_id, file_id, ingest_job_id, severity, code, message, meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [params.projectId, params.fileId || null, jobId, "error", "embedding_failed", err?.message || "", null]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
    throw err;
  }

  try {
    await client.query("BEGIN");

    // Create job as running (we create queued earlier in higher-level caller if desired)
    await client.query(
      `INSERT INTO ingest_jobs (id, project_id, file_id, job_type, status, started_at, created_by)
       VALUES ($1, $2, $3, $4, $5, now(), $6)`,
      [jobId, params.projectId, params.fileId || null, params.sourceType || null, "running", params.userId]
    );

    await client.query(
      `INSERT INTO documents (id, project_id, file_id, title, discipline, reference, storage_path, source_type, created_by)
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

    for (let i = 0; i < rawChunks.length; i += 1) {
      const content = rawChunks[i].content;
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
          rawChunks[i].source_page ?? null,
          rawChunks[i].source_section ?? null,
        ]
      );

      await client.query(
        `INSERT INTO sources (project_id, document_id, chunk_id, title, reference, discipline, snippet, source_path, source_page)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          params.projectId,
          documentId,
          chunkId,
          params.title,
          params.reference || null,
          params.discipline || null,
          content.slice(0, 240),
          params.sourcePath || null,
          rawChunks[i].source_page ?? null,
        ]
      );
    }

    for (const warning of warnings) {
      await client.query(
        `INSERT INTO ingest_warnings (project_id, file_id, ingest_job_id, severity, code, message, meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [params.projectId, params.fileId || null, jobId, warning.severity || "warn", warning.code, warning.message, warning.meta || null]
      );
    }

    await client.query(
      `UPDATE ingest_jobs SET status = $2, finished_at = now() WHERE id = $1`,
      [jobId, "done"]
    );

    await client.query("COMMIT");
    return { jobId, documentId, chunks: rawChunks.length, warnings };
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
      [jobId, "done"]
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
