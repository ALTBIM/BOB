import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, isAppAdmin } from "@/lib/supabase-auth";

export const runtime = "nodejs";

type OrgRow = {
  id: string;
  name: string;
  created_at: string | null;
  created_by: string | null;
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

  const { data: orgMembershipRows, error: orgError } = await supabase
    .from("organization_members")
    .select("org_id, org_role, org:organizations(id, name, created_at, created_by)")
    .eq("user_id", user.id);

  if (orgError) {
    return NextResponse.json({ error: orgError.message }, { status: 500 });
  }

  const orgMemberships = (orgMembershipRows || []).map((row: any) => ({
    orgId: row.org_id,
    orgRole: row.org_role || "member",
    orgName: row.org?.name || undefined,
  }));

  let organizations: OrgRow[] = [];
  if (isPlatformAdmin) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, created_at, created_by")
      .order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    organizations = (data || []) as OrgRow[];
  } else {
    organizations = (orgMembershipRows || [])
      .map((row: any) => row.org)
      .filter(Boolean) as OrgRow[];
  }

  return NextResponse.json({
    isPlatformAdmin,
    orgMemberships,
    organizations: organizations.map((org) => ({
      id: org.id,
      name: org.name,
      createdAt: org.created_at || new Date().toISOString(),
      createdBy: org.created_by || undefined,
    })),
  });
}
