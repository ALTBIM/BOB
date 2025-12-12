import { promises as fs } from "fs";
import path from "path";
import { Pool } from "pg";

export type SourceDocument = {
  id: string;
  projectId: string;
  title: string;
  discipline: string;
  zone?: string;
  reference: string;
  text: string;
};

export type RetrievedSource = {
  id: string;
  projectId: string;
  title: string;
  reference: string;
  discipline: string;
  zone?: string;
  snippet: string;
  score: number;
};

type RetrieveOptions = {
  limit?: number;
  includeGeneralFallback?: boolean;
};

const dataDir = path.join(process.cwd(), "data");
const docsFile = path.join(dataDir, "rag-docs.json");

let cachedDocs: SourceDocument[] | null = null;
let dbPool: Pool | null = null;
let dbReady = false;
let lastBackend: "db" | "file" = "file";

async function ensureDocsFile() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.access(docsFile);
  } catch {
    await fs.writeFile(docsFile, "[]", "utf-8");
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
      CREATE TABLE IF NOT EXISTS rag_documents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        discipline TEXT NOT NULL,
        zone TEXT,
        reference TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    dbReady = true;
    lastBackend = "db";
    return dbPool;
  } catch (err) {
    console.error("Kunne ikke koble til DATABASE_URL, bruker fil-lagring", err);
    dbPool = null;
    lastBackend = "file";
    return null;
  }
}

async function loadDocs(): Promise<SourceDocument[]> {
  const db = await getDb();
  if (db) {
    try {
      const res = await db.query<{
        id: string;
        project_id: string;
        title: string;
        discipline: string;
        zone: string | null;
        reference: string;
        text: string;
      }>("SELECT id, project_id, title, discipline, zone, reference, text FROM rag_documents");
      return res.rows.map((r) => ({
        id: r.id,
        projectId: r.project_id,
        title: r.title,
        discipline: r.discipline,
        zone: r.zone || undefined,
        reference: r.reference,
        text: r.text,
      }));
    } catch (err) {
      console.error("Kunne ikke lese RAG-dokumenter fra DB, faller tilbake til fil", err);
      lastBackend = "file";
    }
  }

  if (cachedDocs) return cachedDocs;
  await ensureDocsFile();
  try {
    const raw = await fs.readFile(docsFile, "utf-8");
    const parsed = JSON.parse(raw) as SourceDocument[];
    cachedDocs = parsed;
    return parsed;
  } catch (err) {
    console.error("Kunne ikke lese RAG-dokumenter fra fil", err);
    return [];
  }
}

async function persistDocs(docs: SourceDocument[]) {
  const db = await getDb();
  if (db) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      for (const doc of docs) {
        await client.query(
          `
            INSERT INTO rag_documents (id, project_id, title, discipline, zone, reference, text)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
              project_id = excluded.project_id,
              title = excluded.title,
              discipline = excluded.discipline,
              zone = excluded.zone,
              reference = excluded.reference,
              text = excluded.text;
          `,
          [doc.id, doc.projectId, doc.title, doc.discipline, doc.zone || null, doc.reference, doc.text]
        );
      }
      await client.query("COMMIT");
      return;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Kunne ikke lagre RAG-dokumenter til DB, faller tilbake til fil", err);
    } finally {
      client.release();
    }
  }

  cachedDocs = docs;
  await ensureDocsFile();
  await fs.writeFile(docsFile, JSON.stringify(docs, null, 2), "utf-8");
}

export async function upsertDocument(doc: SourceDocument) {
  const docs = await loadDocs();
  const existingIndex = docs.findIndex((d) => d.id === doc.id);
  if (existingIndex >= 0) {
    docs[existingIndex] = doc;
  } else {
    docs.push(doc);
  }
  await persistDocs(docs);
}

export async function listDocuments(projectId?: string) {
  const docs = await loadDocs();
  return projectId ? docs.filter((d) => d.projectId === projectId) : docs;
}

function scoreText(text: string, query: string): number {
  const haystack = text.toLowerCase();
  const tokens = query.toLowerCase().split(/[^a-z0-9æøå]+/i).filter(Boolean);
  if (!tokens.length) return 0;

  let score = 0;
  tokens.forEach((token) => {
    if (haystack.includes(token)) {
      score += 2;
    }
  });

  // Favor shorter, focused texts
  score += Math.max(0, 3 - Math.floor(text.length / 200));

  return score;
}

function trimSnippet(text: string, maxLength = 220): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

export async function retrieveContext(
  projectId: string,
  query: string,
  options: RetrieveOptions = {}
): Promise<{ sources: RetrievedSource[]; contextText: string }> {
  const limit = options.limit ?? 4;
  const docs = await loadDocs();
  const projectPool = docs.filter((doc) => doc.projectId === projectId);
  const generalPool = docs.filter((doc) => doc.projectId === "general");

  const pool = projectPool.length
    ? projectPool
    : options.includeGeneralFallback
    ? generalPool
    : [];

  const scored = pool
    .map((doc) => ({
      doc,
      score: scoreText(`${doc.title} ${doc.text}`, query),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const sources: RetrievedSource[] = scored.map(({ doc, score }) => ({
    id: doc.id,
    projectId: doc.projectId,
    title: doc.title,
    reference: doc.reference,
    discipline: doc.discipline,
    zone: doc.zone,
    snippet: trimSnippet(doc.text),
    score,
  }));

  const contextText = sources.length
    ? sources
        .map(
          (source, index) =>
            `[Kilde ${index + 1}] ${source.title} (${source.reference}) — ${source.snippet}`
        )
        .join("\n")
    : "Ingen prosjektkilder funnet.";

  return { sources, contextText };
}

export async function getRagStatus() {
  const docs = await loadDocs();
  const backend = lastBackend;
  const count = docs.length;
  return {
    backend,
    docCount: count,
    dbReady: backend === "db",
  };
}
