import { getPgPool } from "@/lib/pg";

export type RetrievedSource = {
  id: string;
  projectId: string;
  title: string;
  reference: string;
  discipline: string;
  zone?: string;
  snippet: string;
  score: number;
  sourcePath?: string;
};

type RetrieveOptions = {
  limit?: number;
  includeGeneralFallback?: boolean;
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
const EMBED_DIM = Number(
  process.env.OPENAI_EMBED_DIM ||
    (OPENAI_EMBED_MODEL === "text-embedding-3-large" ? "3072" : "1536")
);

const toSqlVector = (embedding: number[]) => `[${embedding.join(",")}]`;

async function embedQuery(query: string) {
  if (!OPENAI_API_KEY) return null;
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBED_MODEL,
      input: query,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Embedding feilet: ${response.status} ${text}`);
  }
  const json = await response.json();
  const embedding = json?.data?.[0]?.embedding as number[] | undefined;
  return embedding || null;
}

const trimSnippet = (text: string, maxLength = 220): string => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
};

export async function retrieveContext(
  projectId: string,
  query: string,
  options: RetrieveOptions = {}
): Promise<{ sources: RetrievedSource[]; contextText: string }> {
  const limit = options.limit ?? 6;
  if (!projectId) {
    return { sources: [], contextText: "Ingen prosjekt er valgt." };
  }
  if (!query.trim()) {
    return { sources: [], contextText: "Ingen sp\u00f8rsm\u00e5l oppgitt." };
  }

  let embedding: number[] | null = null;
  try {
    embedding = await embedQuery(query);
  } catch (err) {
    console.warn("Embedding feilet", err);
  }
  if (!embedding) {
    return { sources: [], contextText: "Ingen prosjektkilder funnet." };
  }
  if (embedding.length !== EMBED_DIM) {
    console.warn(`Embedding dimensjon ${embedding.length} matcher ikke forventet ${EMBED_DIM}`);
    return { sources: [], contextText: "Ingen prosjektkilder funnet." };
  }

  const pool = await getPgPool();
  const vector = toSqlVector(embedding);
  const { rows } = await pool.query(
    `
      SELECT
        c.id,
        c.content,
        c.project_id,
        d.title,
        d.reference,
        d.discipline,
        d.source_path,
        (1 - (c.embedding <=> $1::vector)) AS score
      FROM document_chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE c.project_id = $2
      ORDER BY c.embedding <=> $1::vector
      LIMIT $3
    `,
    [vector, projectId, limit]
  );

  const sources: RetrievedSource[] = rows.map((row: any) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title || "Ukjent kilde",
    reference: row.reference || row.source_path || "Ukjent referanse",
    discipline: row.discipline || "generelt",
    snippet: trimSnippet(row.content || ""),
    score: Number(row.score ?? 0),
    sourcePath: row.source_path || undefined,
  }));

  const { rows: scheduleRows } = await pool.query(
    `
      SELECT task_id, name, discipline, zone, room, start_date, end_date, status, notes
      FROM project_schedule_tasks
      WHERE project_id = $1
      ORDER BY start_date NULLS LAST
      LIMIT 12
    `,
    [projectId]
  );

  const scheduleSnippet = scheduleRows
    .map((row: any) => {
      const start = row.start_date ? new Date(row.start_date).toISOString().slice(0, 10) : "";
      const end = row.end_date ? new Date(row.end_date).toISOString().slice(0, 10) : "";
      const window = start && end ? `${start} - ${end}` : start || end || "";
      const zone = row.zone || row.room ? ` (${[row.zone, row.room].filter(Boolean).join(" / ")})` : "";
      const status = row.status ? ` [${row.status}]` : "";
      return `- ${row.name}${zone}${status} ${window}`.trim();
    })
    .filter(Boolean)
    .join("\n");

  if (scheduleSnippet) {
    sources.push({
      id: "schedule",
      projectId,
      title: "Fremdriftsplan",
      reference: "project_schedule_tasks",
      discipline: "fremdrift",
      snippet: trimSnippet(scheduleSnippet, 240),
      score: 0.5,
    });
  }

  const contextText = sources.length
    ? sources
        .map(
          (source, index) =>
            `[Kilde ${index + 1}] ${source.title} (${source.reference}) \u2014 ${source.snippet}`
        )
        .join("\n")
    : "Ingen prosjektkilder funnet.";

  return { sources, contextText };
}

export async function listDocuments(projectId: string) {
  const pool = await getPgPool();
  const { rows } = await pool.query(
    `SELECT id, project_id, title, reference, discipline, source_path FROM documents WHERE project_id = $1`,
    [projectId]
  );
  return rows;
}

export async function getRagStatus() {
  const pool = await getPgPool();
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM documents");
  return {
    backend: "db",
    dbReady: true,
    docCount: rows?.[0]?.count ?? 0,
  };
}

