import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, isAppAdmin } from "@/lib/supabase-auth";
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

  const isAdmin = await isAppAdmin(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Kun platform admin kan bruke diagnose." }, { status: 403 });
  }

  const url = new URL(request.url);
  const activeProjectId = url.searchParams.get("activeProjectId") || null;

  const pool = await getPgPool();
  let orgCount = 0;
  let orgAdminOf: string[] = [];
  try {
    const { rows } = await pool.query("select count(*)::int as c from organizations");
    orgCount = rows?.[0]?.c ?? 0;
    const orgAdmin = await pool.query(
      "select org_id from organization_members where user_id = $1 and org_role = 'org_admin'",
      [user.id]
    );
    orgAdminOf = orgAdmin.rows?.map((r: any) => r.org_id) ?? [];
  } catch {
    // organizations tables kan mangle; sett 0
    orgCount = 0;
    orgAdminOf = [];
  }

  let projectMemberships: { project_id: string; role: string | null; access_level: string | null }[] = [];
  try {
    const { rows } = await pool.query(
      "select project_id, role, access_level from project_members where user_id = $1",
      [user.id]
    );
    projectMemberships = rows || [];
  } catch {
    projectMemberships = [];
  }

  return NextResponse.json({
    user_id: user.id,
    email: user.email,
    is_platform_admin: true,
    org_count: orgCount,
    org_admin_of: orgAdminOf,
    project_memberships: projectMemberships,
    activeProjectId,
  });
}
