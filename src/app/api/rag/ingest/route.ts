import { NextResponse } from "next/server";
import { ingestTextDocument } from "@/lib/ingest";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, requireProjectMembership } from "@/lib/supabase-auth";

export const runtime = "nodejs";

type IngestBody = {
  projectId: string;
  title: string;
  discipline: string;
  reference: string;
  zone?: string;
  text: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<IngestBody>;
  const { projectId, title, discipline, reference, text } = body;

  if (!projectId || !title || !discipline || !reference || !text) {
    return NextResponse.json(
      { error: "projectId, title, discipline, reference og text er p\u00e5krevd" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert" }, { status: 500 });
  }
  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }
  const membership = await requireProjectMembership(supabase, projectId, user.id);
  if (!membership.ok) {
    return NextResponse.json({ error: membership.error || "Ingen tilgang." }, { status: 403 });
  }

  try {
    const result = await ingestTextDocument({
      projectId,
      title,
      discipline,
      reference,
      sourceType: "manual",
      text,
      userId: user.id,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Kunne ikke lagre dokument" }, { status: 500 });
  }
}
