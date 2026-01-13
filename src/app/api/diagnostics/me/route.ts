import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, isAppAdmin } from "@/lib/supabase-auth";

export const runtime = "nodejs";

const getSecret = (request: Request) => {
  const header = request.headers.get("x-diagnostics-secret") || "";
  const url = new URL(request.url);
  const query = url.searchParams.get("secret") || "";
  return header || query;
};

export async function GET(request: Request) {
  const secret = process.env.APP_DIAGNOSTICS_SECRET || process.env.DIAGNOSTICS_SECRET || "";
  if (!secret) {
    return NextResponse.json({ error: "Diagnostics er deaktivert." }, { status: 404 });
  }
  if (getSecret(request) !== secret) {
    return NextResponse.json({ error: "Ugyldig diagnostics-secret." }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const isPlatformAdmin = await isAppAdmin(supabase, user.id);
  const { data: membershipRows } = await supabase
    .from("project_members")
    .select("project_id, access_level")
    .eq("user_id", user.id);

  const membershipCount = membershipRows?.length || 0;

  let projects: { id: string; name: string; org_id?: string | null }[] = [];
  if (isPlatformAdmin) {
    const { data } = await supabase.from("projects").select("id, name, org_id").order("created_at", { ascending: false }).limit(5);
    projects = (data || []) as any[];
  } else {
    const { data } = await supabase
      .from("project_members")
      .select("project:projects(id, name, org_id)")
      .eq("user_id", user.id)
      .limit(5);
    projects = (data || []).map((row: any) => row.project).filter(Boolean);
  }

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    isPlatformAdmin,
    membershipCount,
    recentProjects: projects,
  });
}
