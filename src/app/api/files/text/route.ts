export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, requireProjectMembership } from "@/lib/supabase-auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "Mangler fileId" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert" }, { status: 500 });
  }

  try {
    const { user, error: authError } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
    }

    const { data: fileRow } = await supabase.from("files").select("project_id").eq("id", fileId).maybeSingle();
    if (!fileRow?.project_id) {
      return NextResponse.json({ error: "Fant ikke fil" }, { status: 404 });
    }

    const membership = await requireProjectMembership(supabase, fileRow.project_id, user.id);
    if (!membership.ok) {
      return NextResponse.json({ error: membership.error || "Ingen tilgang." }, { status: 403 });
    }

    const { data: textRow, error: textErr } = await supabase
      .from("file_texts")
      .select("*")
      .eq("file_id", fileId)
      .maybeSingle();

    const { data: reqRows, error: reqErr } = await supabase
      .from("file_requirements")
      .select("id,text,source_page,source_path,created_at")
      .eq("file_id", fileId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (textErr && reqErr) {
      return NextResponse.json({ error: "Fant ikke tekst/krav" }, { status: 404 });
    }

    const content =
      textRow?.content?.length > 60000 ? textRow.content.slice(0, 60000) + "\n\n... (forkortet)" : textRow?.content;

    return NextResponse.json({
      content,
      contentType: textRow?.content_type,
      wordCount: textRow?.word_count,
      pageCount: textRow?.page_count,
      requirements: reqRows || [],
    });
  } catch (err) {
    console.error("file text fetch feilet", err);
    return NextResponse.json({ error: "Kunne ikke hente tekst/krav" }, { status: 500 });
  }
}
