import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, requireProjectAccess } from "@/lib/supabase-auth";

export const runtime = "nodejs";

type TeamRow = {
  id: string;
  name: string;
  created_at: string | null;
};

type TeamMemberRow = {
  team_id: string;
  user_id: string;
  role_in_team: string | null;
  created_at: string | null;
};

const resolveUserEmails = async (
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  userIds: string[]
) => {
  const emailById = new Map<string, string>();
  await Promise.all(
    userIds.map(async (id) => {
      try {
        const { data, error } = await supabase.auth.admin.getUserById(id);
        if (error) return;
        if (data?.user?.email) {
          emailById.set(id, data.user.email);
        }
      } catch {
        // ignore
      }
    })
  );
  return emailById;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || "";

  if (!projectId) {
    return NextResponse.json({ error: "Mangler projectId." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const access = await requireProjectAccess(supabase, projectId, user.id, "admin");
  if (!access.ok) {
    return NextResponse.json({ error: access.error || "Ingen tilgang." }, { status: 403 });
  }

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (teamsError) {
    return NextResponse.json({ error: teamsError.message }, { status: 500 });
  }

  const teamRows = (teams || []) as TeamRow[];
  if (teamRows.length === 0) {
    return NextResponse.json({ teams: [] });
  }

  const teamIds = teamRows.map((t) => t.id);
  const { data: members, error: membersError } = await supabase
    .from("team_members")
    .select("team_id, user_id, role_in_team, created_at")
    .in("team_id", teamIds);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  const memberRows = (members || []) as TeamMemberRow[];
  const uniqueUsers = Array.from(new Set(memberRows.map((m) => m.user_id)));
  const emailById = await resolveUserEmails(supabase, uniqueUsers);

  const membersByTeam = new Map<string, TeamMemberRow[]>();
  for (const row of memberRows) {
    const list = membersByTeam.get(row.team_id) || [];
    list.push(row);
    membersByTeam.set(row.team_id, list);
  }

  const payload = teamRows.map((team) => ({
    id: team.id,
    name: team.name,
    createdAt: team.created_at || undefined,
    members: (membersByTeam.get(team.id) || []).map((m) => ({
      userId: m.user_id,
      email: emailById.get(m.user_id) || "",
      roleInTeam: m.role_in_team || undefined,
      addedAt: m.created_at || undefined,
    })),
  }));

  return NextResponse.json({ teams: payload });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { projectId?: string; name?: string };
  const projectId = body.projectId || "";
  const name = (body.name || "").trim();

  if (!projectId || !name) {
    return NextResponse.json({ error: "projectId og navn er påkrevd." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const access = await requireProjectAccess(supabase, projectId, user.id, "admin");
  if (!access.ok) {
    return NextResponse.json({ error: access.error || "Ingen tilgang." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("teams")
    .insert({ project_id: projectId, name, created_by: user.id })
    .select("id, name, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ team: data });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { projectId?: string; teamId?: string; name?: string };
  const projectId = body.projectId || "";
  const teamId = body.teamId || "";
  const name = (body.name || "").trim();

  if (!projectId || !teamId || !name) {
    return NextResponse.json({ error: "projectId, teamId og navn er påkrevd." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const access = await requireProjectAccess(supabase, projectId, user.id, "admin");
  if (!access.ok) {
    return NextResponse.json({ error: access.error || "Ingen tilgang." }, { status: 403 });
  }

  const { error } = await supabase.from("teams").update({ name }).eq("id", teamId).eq("project_id", projectId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { projectId?: string; teamId?: string };
  const projectId = body.projectId || "";
  const teamId = body.teamId || "";

  if (!projectId || !teamId) {
    return NextResponse.json({ error: "projectId og teamId er påkrevd." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const access = await requireProjectAccess(supabase, projectId, user.id, "admin");
  if (!access.ok) {
    return NextResponse.json({ error: access.error || "Ingen tilgang." }, { status: 403 });
  }

  const { error } = await supabase.from("teams").delete().eq("id", teamId).eq("project_id", projectId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
