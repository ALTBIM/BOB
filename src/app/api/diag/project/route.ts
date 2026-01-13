import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, isAppAdmin, requireProjectAccess } from "@/lib/supabase-auth";
import { getPgPool } from "@/lib/pg";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId mangler" }, { status: 400 });
  }

  const isPlatformAdmin = await isAppAdmin(supabase, user.id);
  const membership = await requireProjectAccess(supabase, projectId, user.id, "read");
  if (!membership.ok && !isPlatformAdmin) {
    return NextResponse.json({ can_access: false, error: membership.error || "Ingen tilgang." }, { status: 403 });
  }

  const pool = await getPgPool();
  const counts = {
    files_count: 0,
    documents_count: 0,
    chunks_count: 0,
    sources_count: 0,
    chat_threads_count: 0,
    chat_messages_count: 0,
    ingest_jobs: [] as { id: string; status: string; created_at: string | null }[],
  };

  try {
    const files = await pool.query("select count(*)::int as c from files where project_id = $1", [projectId]);
    counts.files_count = files.rows?.[0]?.c ?? 0;
  } catch {}
  try {
    const docs = await pool.query("select count(*)::int as c from documents where project_id = $1", [projectId]);
    counts.documents_count = docs.rows?.[0]?.c ?? 0;
  } catch {}
  try {
    const chunks = await pool.query("select count(*)::int as c from document_chunks where project_id = $1", [projectId]);
    counts.chunks_count = chunks.rows?.[0]?.c ?? 0;
  } catch {}
  try {
    const srcs = await pool.query("select count(*)::int as c from sources where project_id = $1", [projectId]);
    counts.sources_count = srcs.rows?.[0]?.c ?? 0;
  } catch {}
  try {
    const threads = await pool.query("select count(*)::int as c from chat_threads where project_id = $1", [projectId]);
    counts.chat_threads_count = threads.rows?.[0]?.c ?? 0;
  } catch {}
  try {
    const msgs = await pool.query("select count(*)::int as c from chat_messages_v2 where project_id = $1", [projectId]);
    counts.chat_messages_count = msgs.rows?.[0]?.c ?? 0;
  } catch {}
  try {
    const jobs = await pool.query(
      "select id, status, created_at from ingest_jobs where project_id = $1 order by created_at desc limit 5",
      [projectId]
    );
    counts.ingest_jobs = jobs.rows?.map((r: any) => ({
      id: String(r.id),
      status: String(r.status),
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
    }));
  } catch {}

  return NextResponse.json({
    can_access: true,
    access_level: membership.membership?.access_level || (isPlatformAdmin ? "admin" : null),
    counts,
  });
}
