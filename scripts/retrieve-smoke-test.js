/* Usage:
  Set env vars and run:
    NODE_ENV=development node scripts/retrieve-smoke-test.js

  Required env vars:
    DATABASE_URL - Postgres connection string (or set SUPABASE_SERVICE_ROLE and SUPABASE_URL)
    PROJECT_ID - project id to test
    QUERY - query string to run (e.g. "What does the fire classification require?")
    OPENAI_API_KEY - to compute query embedding
    TOPK (optional) - top-k to request (default 12)

  The script will compute an embedding via OpenAI, query the DB with the same SQL as retrieval, and print counts and per-document hit counts (to verify diversity).
*/

const fetch = require('node-fetch');
const { Pool } = require('pg');

async function embedQuery(query) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY missing');
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small', input: query }),
  });
  if (!res.ok) throw new Error(`Embedding failed ${res.status}`);
  const json = await res.json();
  return json.data[0].embedding;
}

function toSqlVector(embedding) {
  return `[${embedding.join(',')}]`;
}

(async () => {
  const PROJECT_ID = process.env.PROJECT_ID;
  const QUERY = process.env.QUERY || 'What requirements for fire classification?';
  const TOPK = Math.max(8, Math.min(15, Number(process.env.TOPK || 12)));
  if (!PROJECT_ID) { console.error('Set PROJECT_ID'); process.exit(1); }
  try {
    console.log('Embedding query...');
    const embedding = await embedQuery(QUERY);
    const vector = toSqlVector(embedding);

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query('SELECT 1');

    const sql = `WITH ranked AS (
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
      WHERE c.project_id = $2
    )
    SELECT chunk_id, document_id, content, source_page, source_section, score
    FROM ranked
    WHERE doc_rank <= 3
    ORDER BY distance
    LIMIT $3`;

    const { rows } = await pool.query(sql, [vector, PROJECT_ID, TOPK]);
    console.log('Retrieved chunks:', rows.length);
    const byDoc = {};
    for (const r of rows) {
      byDoc[r.document_id] = (byDoc[r.document_id] || 0) + 1;
    }
    console.log('Per-document counts:', byDoc);

    // Quick sanity checks
    if (rows.length >= 8 && rows.length <= 15) console.log('TopK range OK'); else console.warn('TopK outside 8-15 range');
    const maxPerDoc = Math.max(...Object.values(byDoc).concat([0]));
    if (maxPerDoc <= 3) console.log('Diversity OK (<=3 per document)'); else console.warn('Diversity violated (>3)');

    await pool.end();
  } catch (err) {
    console.error('Error during retrieval smoke test:', err);
    process.exit(1);
  }
})();