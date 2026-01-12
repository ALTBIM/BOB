import { NextResponse } from "next/server";
import { getRagStatus, listDocuments } from "@/lib/rag";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, requireProjectMembership } from "@/lib/supabase-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";

  if (!projectId) {
    return NextResponse.json({ ok: false, error: "projectId mangler" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase ikke konfigurert" }, { status: 500 });
    }
    const { user, error: authError } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ ok: false, error: authError || "Ikke autentisert." }, { status: 401 });
    }
    const membership = await requireProjectMembership(supabase, projectId, user.id);
    if (!membership.ok) {
      return NextResponse.json({ ok: false, error: membership.error || "Ingen tilgang." }, { status: 403 });
    }

    const status = await getRagStatus();
    const docs = await listDocuments(projectId);
    return NextResponse.json({
      ok: true,
      backend: status.backend,
      dbReady: status.dbReady,
      docCount: docs.length,
      projectId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Health check feilet" },
      { status: 500 }
    );
  }
}
