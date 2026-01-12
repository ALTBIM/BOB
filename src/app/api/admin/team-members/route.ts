import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, requireProjectAccess } from "@/lib/supabase-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    teamId?: string;
    email?: string;
    userId?: string;
  };

  const teamId = body.teamId || "";
  const email = (body.email || "").trim().toLowerCase();
  const userId = body.userId || "";

  if (!teamId || (!email && !userId)) {
    return NextResponse.json({ error: "teamId og e-post eller userId er p\u00e5krevd." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, project_id")
    .eq("id", teamId)
    .maybeSingle();

  if (teamError || !team) {
    return NextResponse.json({ error: teamError?.message || "Fant ikke team." }, { status: 404 });
  }

  const access = await requireProjectAccess(supabase, team.project_id, user.id, "admin");
  if (!access.ok) {
    return NextResponse.json({ error: access.error || "Ingen tilgang." }, { status: 403 });
  }

  let resolvedUserId = userId;
  if (!resolvedUserId && email) {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Fant ingen bruker med denne e-posten." }, { status: 404 });
    }
    resolvedUserId = userData.user.id;
  }

  const { data: member } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", team.project_id)
    .eq("user_id", resolvedUserId)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Bruker er ikke medlem av prosjektet." }, { status: 400 });
  }

  const { error: insertError } = await supabase.from("team_members").insert({
    team_id: team.id,
    user_id: resolvedUserId,
  });

  if (insertError) {
    const status = insertError.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: insertError.message }, { status });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { teamId?: string; userId?: string };
  const teamId = body.teamId || "";
  const userId = body.userId || "";

  if (!teamId || !userId) {
    return NextResponse.json({ error: "teamId og userId er p\u00e5krevd." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, project_id")
    .eq("id", teamId)
    .maybeSingle();

  if (teamError || !team) {
    return NextResponse.json({ error: teamError?.message || "Fant ikke team." }, { status: 404 });
  }

  const access = await requireProjectAccess(supabase, team.project_id, user.id, "admin");
  if (!access.ok) {
    return NextResponse.json({ error: access.error || "Ingen tilgang." }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", team.id)
    .eq("user_id", userId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
