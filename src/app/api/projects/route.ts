import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, isAppAdmin, requireOrgAdmin } from "@/lib/supabase-auth";

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

type ProjectRow = Record<string, unknown>;

type ProjectEnvelope = {
  project: ProjectRow;
  membership?: {
    role: string;
    access_level: "read" | "write" | "admin";
    permissions: string[];
    created_at?: string;
  };
};

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const isPlatformAdmin = await isAppAdmin(supabase, user.id);
  if (isPlatformAdmin) {
    const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const projects = (data || []).map((row) => ({
      project: row,
      membership: { role: "plattform_admin", access_level: "admin", permissions: [] },
    }));
    return NextResponse.json({ projects, isPlatformAdmin: true });
  }

  const { data: orgMemberships } = await supabase
    .from("organization_members")
    .select("org_id, org_role")
    .eq("user_id", user.id);
  const orgAdminOrgIds = (orgMemberships || [])
    .filter((m: any) => m.org_role === "org_admin")
    .map((m: any) => m.org_id as string);

  const orgProjectsQuery = orgAdminOrgIds.length
    ? supabase.from("projects").select("*").in("org_id", orgAdminOrgIds)
    : Promise.resolve({ data: [], error: null } as any);

  const [{ data: memberRows, error: memberError }, { data: orgProjects, error: orgError }] = await Promise.all([
    supabase
      .from("project_members")
      .select("role, access_level, permissions, created_at, project:projects(*)")
      .eq("user_id", user.id),
    orgProjectsQuery,
  ]);

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }
  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 });
  }

  const byId = new Map<string, ProjectEnvelope>();
  (memberRows || []).forEach((row: any) => {
    if (!row.project) return;
    byId.set(row.project.id, {
      project: row.project,
      membership: {
        role: row.role || "byggherre",
        access_level: row.access_level || "read",
        permissions: row.permissions || [],
        created_at: row.created_at,
      },
    });
  });

  (orgProjects || []).forEach((row: any) => {
    if (!byId.has(row.id)) {
      byId.set(row.id, {
        project: row,
        membership: { role: "org_admin", access_level: "admin", permissions: [] },
      });
    }
  });

  const projects = Array.from(byId.values());
  return NextResponse.json({ projects, isPlatformAdmin: false });
}

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

  const orgId = body.orgId || null;
  if (orgId) {
    const access = await requireOrgAdmin(supabase, orgId, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error || "Ingen tilgang til organisasjon." }, { status: 403 });
    }
  }

  const { data, error } = await supabase.rpc("create_project_with_member", {
    p_name: name,
    p_description: body.description || null,
    p_created_by: user.id,
    p_org_id: orgId,
    p_status: body.status || null,
    p_client: body.client || null,
    p_location: body.location || null,
    p_type: body.type || null,
    p_progress: typeof body.progress === "number" ? body.progress : 0,
  });

  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: error?.message || "Kunne ikke opprette prosjekt." }, { status: 500 });
  }

  const row = data[0] as { project?: ProjectRow; member?: ProjectRow };
  return NextResponse.json({ project: row.project || null, member: row.member || null });
}
