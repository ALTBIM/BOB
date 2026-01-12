import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, isAppAdmin, requireOrgAdmin } from "@/lib/supabase-auth";

export const runtime = "nodejs";

type OrgRow = {
  id: string;
  name: string;
  created_at: string | null;
  created_by: string | null;
};

export async function GET(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });

  const { user, error: authError } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });

  const isAdmin = await isAppAdmin(supabase, user.id);
  if (isAdmin) {
    const { data, error } = await supabase.from("organizations").select("*").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ organizations: data || [] });
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("org:organizations(id, name, created_at, created_by), org_role")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const organizations = (data || [])
    .map((row: any) => row.org)
    .filter(Boolean) as OrgRow[];

  return NextResponse.json({ organizations });
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });

  const { user, error: authError } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });

  const allowed = await isAppAdmin(supabase, user.id);
  if (!allowed) return NextResponse.json({ error: "Ingen tilgang." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Navn er p\u00e5krevd." }, { status: 400 });

  const { data, error } = await supabase
    .from("organizations")
    .insert({ name, created_by: user.id })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Kunne ikke opprette organisasjon." }, { status: 500 });
  }

  return NextResponse.json({ organization: data });
}

export async function PATCH(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });

  const { user, error: authError } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { orgId?: string; name?: string };
  const orgId = body.orgId || "";
  const name = (body.name || "").trim();
  if (!orgId || !name) return NextResponse.json({ error: "orgId og navn er p\u00e5krevd." }, { status: 400 });

  const access = await requireOrgAdmin(supabase, orgId, user.id);
  if (!access.ok) return NextResponse.json({ error: access.error || "Ingen tilgang." }, { status: 403 });

  const { error } = await supabase.from("organizations").update({ name }).eq("id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });

  const { user, error: authError } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });

  const allowed = await isAppAdmin(supabase, user.id);
  if (!allowed) return NextResponse.json({ error: "Ingen tilgang." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { orgId?: string };
  const orgId = body.orgId || "";
  if (!orgId) return NextResponse.json({ error: "orgId er p\u00e5krevd." }, { status: 400 });

  const { error } = await supabase.from("organizations").delete().eq("id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
