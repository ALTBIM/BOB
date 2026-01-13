/* Minimal smoke test for POST /api/ingest/document

Usage:
  NODE_ENV=development node scripts/ingest-smoke-test.js
Set env:
  BASE_URL (default http://localhost:3000)
  PROJECT_ID
  FILE_ID
  AUTH_TOKEN (Supabase JWT of a user with write access)
*/

const fetch = require("node-fetch");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const PROJECT_ID = process.env.PROJECT_ID;
const FILE_ID = process.env.FILE_ID;
const AUTH = process.env.AUTH_TOKEN;

if (!PROJECT_ID || !FILE_ID || !AUTH) {
  console.error("Set PROJECT_ID, FILE_ID and AUTH_TOKEN env vars before running.");
  process.exit(1);
}

(async () => {
  try {
    const res = await fetch(`${BASE}/api/ingest/document`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AUTH}`,
      },
      body: JSON.stringify({ projectId: PROJECT_ID, fileId: FILE_ID }),
    });
    const json = await res.json();
    console.log("status", res.status, json);
    if (res.ok) {
      console.log("Ingest triggered. Verify database rows: documents, ingest_jobs, document_chunks > 0, sources populated and retrieval finds chunks.");
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
