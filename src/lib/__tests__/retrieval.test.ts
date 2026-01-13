import assert from "assert";
import { retrieveContextWithDeps, EMBED_DIM } from "../retrieval";

// Mock pool that records queries
function createMockPool() {
  const calls: any[] = [];
  const pool = {
    async query(sql: string, params: any[]) {
      calls.push({ sql, params });
      // Detect which query is being called by SQL content
      if (sql.includes("WITH ranked AS")) {
        // Return some fake chunk rows (simulate final selected rows)
        return {
          rows: [
            { chunk_id: "c1", document_id: "d1", content: "A1", source_page: 1, source_section: null, score: 0.95 },
            { chunk_id: "c2", document_id: "d1", content: "A2", source_page: 2, source_section: null, score: 0.9 },
            { chunk_id: "c3", document_id: "d2", content: "B1", source_page: 1, source_section: null, score: 0.85 },
          ],
        };
      }
      if (sql.includes("FROM sources s")) {
        return {
          rows: [
            { title: "Doc 1", document_id: "d1", page: 1, snippet: "Snippet A", source_path: "project-files/a.pdf" },
            { title: "Doc 2", document_id: "d2", page: 1, snippet: "Snippet B", source_path: "project-files/b.pdf" },
          ],
        };
      }
      return { rows: [] };
    },
    __calls: calls,
  };
  return pool;
}

(async () => {
  const pool = createMockPool();
  const embedMock = async (q: string) => new Array(EMBED_DIM).fill(0);

  // Test: default topK (12), but clamp behavior when passing small topK
  const res = await retrieveContextWithDeps("proj-1", "hello world", {}, { topK: 4 }, { embed: embedMock, pool });
  // Verify returned chunks and sources
  assert.strictEqual(res.chunks.length, 3, "Should return 3 chunk rows from mock");
  assert.strictEqual(res.sources.length, 2, "Should return 2 sources from mock");
  assert.deepStrictEqual(res.retrievedChunkIds, ["c1", "c2", "c3"]);

  // Verify SQL params contain clamped topK=8 (since 4 requested)
  const firstCall = pool.__calls[0];
  const lastParam = firstCall.params[firstCall.params.length - 1];
  assert.strictEqual(lastParam, 8, "topK should be clamped to minimum 8");

  // Verify that filters result in SQL containing appropriate clauses
  pool.__calls.length = 0;
  await retrieveContextWithDeps("proj-1", "q", { documentIds: ["d1", "d3"], sourceTypes: ["document"] }, {}, { embed: embedMock, pool });
  const sqlWithFilters = pool.__calls[0].sql as string;
  assert(sqlWithFilters.includes("d.id = ANY"), "SQL should include d.id = ANY when documentIds filter provided");
  assert(sqlWithFilters.includes("d.source_type = ANY"), "SQL should include d.source_type = ANY when sourceTypes filter provided");

  console.log("All retrieval tests passed.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});