import { promises as fs } from "fs";
import path from "path";

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

async function ensureDocsFile() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.access(docsFile);
  } catch {
    await fs.writeFile(docsFile, "[]", "utf-8");
  }
}

async function loadDocs(): Promise<SourceDocument[]> {
  if (cachedDocs) return cachedDocs;
  await ensureDocsFile();
  try {
    const raw = await fs.readFile(docsFile, "utf-8");
    const parsed = JSON.parse(raw) as SourceDocument[];
    cachedDocs = parsed;
    return parsed;
  } catch (err) {
    console.error("Kunne ikke lese RAG-dokumenter", err);
    return [];
  }
}

async function persistDocs(docs: SourceDocument[]) {
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
