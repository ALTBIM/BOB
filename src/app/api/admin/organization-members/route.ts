import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, requireOrgAdmin } from "@/lib/supabase-auth";

export const runtime = "nodejs";

type MemberRow = {
  user_id: string;
  org_role: string | null;
  created_at: string | null;
};

const resolveUserEmail = async (supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, userId: string) => {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) return "";
    return data?.user?.email || "";
  } catch {
    return "";
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId") || "";

  if (!orgId) return NextResponse.json({ error: "Mangler orgId." }, { status: 400 });

  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });

  const { user, error: authError } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });

  const access = await requireOrgAdmin(supabase, orgId, user.id);
  if (!access.ok) return NextResponse.json({ error: access.error || "Ingen tilgang." }, { status: 403 });

  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id, org_role, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as MemberRow[];
  const members = await Promise.all(
    rows.map(async (row) => ({
      userId: row.user_id,
      email: await resolveUserEmail(supabase, row.user_id),
      orgRole: row.org_role || "member",
      addedAt: row.created_at || undefined,
    }))
  );

  return NextResponse.json({ members });
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });

  const { user, error: authError } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    orgId?: string;
    email?: string;
    orgRole?: "member" | "org_admin";
  };

  const orgId = body.orgId || "";
  const email = (body.email || "").trim().toLowerCase();
  const orgRole = body.orgRole || "member";

  if (!orgId || !email) {
    return NextResponse.json({ error: "orgId og e-post er p\u00e5krevd." }, { status: 400 });
  }

  const access = await requireOrgAdmin(supabase, orgId, user.id);
  if (!access.ok) return NextResponse.json({ error: access.error || "Ingen tilgang." }, { status: 403 });

  const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Fant ingen bruker med denne e-posten." }, { status: 404 });
  }

  const { error: insertError } = await supabase.from("organization_members").insert({
    org_id: orgId,
    user_id: userData.user.id,
    org_role: orgRole,
  });

  if (insertError) {
    const status = insertError.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: insertError.message }, { status });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });

  const { user, error: authError } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    orgId?: string;
    userId?: string;
    orgRole?: "member" | "org_admin";
  };

  const orgId = body.orgId || "";
  const userId = body.userId || "";
  const orgRole = body.orgRole || "member";
  if (!orgId || !userId) return NextResponse.json({ error: "orgId og userId er p\u00e5krevd." }, { status: 400 });

  const access = await requireOrgAdmin(supabase, orgId, user.id);
  if (!access.ok) return NextResponse.json({ error: access.error || "Ingen tilgang." }, { status: 403 });

  const { error } = await supabase
    .from("organization_members")
    .update({ org_role: orgRole })
    .eq("org_id", orgId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });

  const { user, error: authError } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { orgId?: string; userId?: string };
  const orgId = body.orgId || "";
  const userId = body.userId || "";
  if (!orgId || !userId) return NextResponse.json({ error: "orgId og userId er p\u00e5krevd." }, { status: 400 });

  const access = await requireOrgAdmin(supabase, orgId, user.id);
  if (!access.ok) return NextResponse.json({ error: access.error || "Ingen tilgang." }, { status: 403 });

  const { error } = await supabase.from("organization_members").delete().eq("org_id", orgId).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
