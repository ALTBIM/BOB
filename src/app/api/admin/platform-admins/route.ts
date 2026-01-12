import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, isAppAdmin } from "@/lib/supabase-auth";

export const runtime = "nodejs";

type AdminRow = {
  user_id: string;
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
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });

  const { user, error: authError } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });

  const allowed = await isAppAdmin(supabase, user.id);
  if (!allowed) return NextResponse.json({ error: "Ingen tilgang." }, { status: 403 });

  const { data, error } = await supabase.from("app_admins").select("user_id, created_at").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as AdminRow[];
  const admins = await Promise.all(
    rows.map(async (row) => ({
      userId: row.user_id,
      email: await resolveUserEmail(supabase, row.user_id),
      createdAt: row.created_at || undefined,
    }))
  );

  return NextResponse.json({ admins });
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });

  const { user, error: authError } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });

  const allowed = await isAppAdmin(supabase, user.id);
  if (!allowed) return NextResponse.json({ error: "Ingen tilgang." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = (body.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "E-post er p\u00e5krevd." }, { status: 400 });

  const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Fant ingen bruker med denne e-posten." }, { status: 404 });
  }

  const { error: insertError } = await supabase.from("app_admins").insert({ user_id: userData.user.id });
  if (insertError) {
    const status = insertError.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: insertError.message }, { status });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });

  const { user, error: authError } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });

  const allowed = await isAppAdmin(supabase, user.id);
  if (!allowed) return NextResponse.json({ error: "Ingen tilgang." }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { userId?: string };
  const userId = body.userId || "";
  if (!userId) return NextResponse.json({ error: "userId er p\u00e5krevd." }, { status: 400 });

  const { error } = await supabase.from("app_admins").delete().eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
