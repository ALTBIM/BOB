import { getPgPool } from "@/lib/pg";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
export const EMBED_DIM = Number(
  process.env.OPENAI_EMBED_DIM || (OPENAI_EMBED_MODEL === "text-embedding-3-large" ? "3072" : "1536")
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
    body: JSON.stringify({ model: OPENAI_EMBED_MODEL, input: query }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Embedding failed: ${response.status} ${text}`);
  }
  const json = await response.json();
  const embedding = json?.data?.[0]?.embedding as number[] | undefined;
  return embedding || null;
}

export type SourceRef = { page?: number | null; section?: string | null };
export type Chunk = {
  chunk_id: string;
  document_id: string;
  content: string;
  score: number;
  source_ref: SourceRef;
};
export type Source = {
  title: string;
  document_id: string;
  page?: number | null;
  snippet?: string;
  storage_path?: string | null;
};

export type RetrieveFilters = {
  documentIds?: string[];
  sourceTypes?: string[];
  dateRange?: { from?: string; to?: string };
};

export type RetrieveResult = {
  chunks: Chunk[];
  sources: Source[];
  retrievedChunkIds: string[];
};

export async function retrieveContextWithDeps(
  projectId: string,
  query: string,
  filters: RetrieveFilters = {},
  options: { topK?: number } = {},
  deps?: { embed?: (q: string) => Promise<number[] | null>; pool?: any }
): Promise<RetrieveResult> {
  const topKRequested = options.topK ?? 12;
  const topK = Math.max(8, Math.min(15, topKRequested)); // enforce 8..15

  if (!projectId) throw new Error("PROJECT_REQUIRED");
  if (!query || !query.trim()) return { chunks: [], sources: [], retrievedChunkIds: [] };

  const embedFn = deps?.embed ?? embedQuery;

  let embedding: number[] | null = null;
  try {
    embedding = await embedFn(query);
  } catch (err) {
    console.warn("Embedding failed", err);
  }

  if (!embedding) {
    // No embeddings available (e.g., missing key) -> return empty but shaped response
    return { chunks: [], sources: [], retrievedChunkIds: [] };
  }
  if (embedding.length !== EMBED_DIM) {
    console.warn(`Embedding dim ${embedding.length} !== expected ${EMBED_DIM}`);
    return { chunks: [], sources: [], retrievedChunkIds: [] };
  }

  const pool = deps?.pool ?? (await getPgPool());
  const vector = toSqlVector(embedding);

  // Build dynamic filters
  const whereClauses: string[] = ["c.project_id = $2"];
  const params: any[] = [vector, projectId];
  let paramIdx = 3;

  if (filters.documentIds && filters.documentIds.length > 0) {
    whereClauses.push(`d.id = ANY($${paramIdx}::uuid[])`);
    params.push(filters.documentIds);
    paramIdx++;
  }
  if (filters.sourceTypes && filters.sourceTypes.length > 0) {
    whereClauses.push(`d.source_type = ANY($${paramIdx}::text[])`);
    params.push(filters.sourceTypes);
    paramIdx++;
  }
  if (filters.dateRange?.from) {
    whereClauses.push(`d.created_at >= $${paramIdx}`);
    params.push(filters.dateRange.from);
    paramIdx++;
  }
  if (filters.dateRange?.to) {
    whereClauses.push(`d.created_at <= $${paramIdx}`);
    params.push(filters.dateRange.to);
    paramIdx++;
  }

  // We use row_number partition per document to cap max 3 per document (diversity)
  const querySql = `
    WITH ranked AS (
      SELECT
        c.id AS chunk_id,
        c.document_id,
        c.content,
        c.source_page,
        c.source_section,
        (c.embedding <=> $1::vector) AS distance,
        (1 - (c.embedding <=> $1::vector)) AS score,
        ROW_NUMBER() OVER (PARTITION BY c.document_id ORDER BY c.embedding <=> $1::vector) AS doc_rank
      FROM document_chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE ${whereClauses.join(" AND ")}
    )
    SELECT chunk_id, document_id, content, source_page, source_section, score
    FROM ranked
    WHERE doc_rank <= 3
    ORDER BY distance
    LIMIT $${paramIdx}
  `;

  params.push(topK);

  const { rows } = await pool.query(querySql, params);

  const chunks: Chunk[] = rows.map((r: any) => ({
    chunk_id: r.chunk_id,
    document_id: r.document_id,
    content: r.content || "",
    score: Number(r.score ?? 0),
    source_ref: { page: r.source_page ?? null, section: r.source_section ?? null },
  }));

  const retrievedChunkIds = chunks.map((c) => c.chunk_id);

  // Log retrieved chunk ids to server logs/telemetry immediately
  console.info("retrieval:retrieved_chunk_ids", { projectId, query: query.slice(0, 200), retrievedChunkIds });

  // Build sources list: pick one source per document from 'sources' table (latest)
  const documentIds = Array.from(new Set(chunks.map((c) => c.document_id)));
  const sources: Source[] = [];
  if (documentIds.length > 0) {
    const { rows: srcRows } = await pool.query(
      `
        SELECT DISTINCT ON (s.document_id) s.title, s.document_id, s.source_page as page, s.snippet, s.source_path
        FROM sources s
        WHERE s.project_id = $1 AND s.document_id = ANY($2::uuid[])
        ORDER BY s.document_id, s.created_at DESC
      `,
      [projectId, documentIds]
    );
    for (const r of srcRows) {
      sources.push({
        title: r.title || "Ukjent kilde",
        document_id: r.document_id,
        page: r.page ?? null,
        snippet: r.snippet ?? undefined,
        storage_path: r.source_path ?? null,
      });
    }
  }

  return { chunks, sources, retrievedChunkIds };
}

export async function retrieveContext(
  projectId: string,
  query: string,
  filters: RetrieveFilters = {},
  options: { topK?: number } = {}
) {
  return retrieveContextWithDeps(projectId, query, filters, options, undefined as any);
}
