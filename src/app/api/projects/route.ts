import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, requireOrgAdmin } from "@/lib/supabase-auth";

export const runtime = "nodejs";

type Body = {
  name: string;
  description?: string;
  status?: string;
  client?: string;
  location?: string;
  type?: string;
  progress?: number;
  orgId?: string | null;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<Body>;
  const name = body.name?.trim() || "";

  if (!name) {
    return NextResponse.json({ error: "Prosjektnavn er p\u00e5krevd." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const payload = {
    name,
    description: body.description || null,
    status: body.status || "planning",
    client: body.client || null,
    location: body.location || null,
    type: body.type || "commercial",
    progress: Number(body.progress ?? 0),
    created_by: user.id,
    org_id: body.orgId || null,
  };

  if (payload.org_id) {
    const access = await requireOrgAdmin(supabase, payload.org_id, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error || "Ingen tilgang til organisasjon." }, { status: 403 });
    }
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert(payload)
    .select("*")
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: projectError?.message || "Kunne ikke opprette prosjekt." }, { status: 500 });
  }

  const permissions = [
    "read",
    "write",
    "delete",
    "manage_users",
    "manage_models",
    "generate_lists",
    "run_controls",
  ];

  const memberPayload = {
    project_id: project.id,
    user_id: user.id,
    role: "byggherre",
    access_level: "admin",
    permissions,
    created_at: new Date().toISOString(),
  };

  const { error: memberError } = await supabase.from("project_members").insert(memberPayload);
  if (memberError) {
    await supabase.from("projects").delete().eq("id", project.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ project, member: memberPayload });
}
