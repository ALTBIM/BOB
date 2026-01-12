import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser } from "@/lib/supabase-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });

  const secret = process.env.APP_ADMIN_BOOTSTRAP_SECRET || "";
  if (!secret) {
    return NextResponse.json({ error: "Mangler APP_ADMIN_BOOTSTRAP_SECRET." }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { secret?: string; email?: string };
  if (!body.secret || body.secret !== secret) {
    return NextResponse.json({ error: "Ugyldig bootstrap-secret." }, { status: 403 });
  }

  let targetUserId = user.id;
  if (body.email) {
    const email = body.email.trim().toLowerCase();
    const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Fant ingen bruker med denne e-posten." }, { status: 404 });
    }
    targetUserId = userData.user.id;
  }

  const { error } = await supabase.from("app_admins").insert({ user_id: targetUserId });
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: targetUserId });
}
