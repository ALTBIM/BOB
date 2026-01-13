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
    created_by: user.id,
  };

  const orgId = body.orgId || null;
  if (orgId) {
    const access = await requireOrgAdmin(supabase, orgId, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error || "Ingen tilgang til organisasjon." }, { status: 403 });
    }
  }

  const insertProject = async (includeOrg: boolean) => {
    const bodyPayload = includeOrg && orgId ? { ...payload, org_id: orgId } : payload;
    return supabase.from("projects").insert(bodyPayload).select("*").single();
  };

  let { data: project, error: projectError } = await insertProject(true);
  if (projectError?.code === "PGRST204" && projectError.message?.includes("org_id")) {
    ({ data: project, error: projectError } = await insertProject(false));
  }

  if (projectError || !project) {
    return NextResponse.json({ error: projectError?.message || "Kunne ikke opprette prosjekt." }, { status: 500 });
  }

  const permissions = ["read", "write", "delete", "manage_users", "manage_models", "generate_lists", "run_controls"];

  const memberPayload = {
    project_id: project.id,
    user_id: user.id,
    role: "byggherre",
    access_level: "admin",
    permissions,
    created_at: new Date().toISOString(),
  };

  const insertMember = async () => {
    const { error } = await supabase.from("project_members").insert(memberPayload);
    if (!error) return null;
    if (error.code === "PGRST204") {
      const minimalPayload = {
        project_id: project.id,
        user_id: user.id,
        role: "byggherre",
      };
      const { error: minimalError } = await supabase.from("project_members").insert(minimalPayload);
      return minimalError || null;
    }
    return error;
  };

  const memberError = await insertMember();
  if (memberError) {
    await supabase.from("projects").delete().eq("id", project.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ project, member: memberPayload });
}
