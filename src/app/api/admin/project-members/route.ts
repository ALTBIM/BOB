import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, requireProjectAccess } from "@/lib/supabase-auth";

export const runtime = "nodejs";

type MemberRow = {
  user_id: string;
  role: string | null;
  access_level: string | null;
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
  const projectId = searchParams.get("projectId") || "";

  if (!projectId) {
    return NextResponse.json({ error: "Mangler projectId." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const access = await requireProjectAccess(supabase, projectId, user.id, "admin");
  if (!access.ok) {
    return NextResponse.json({ error: access.error || "Ingen tilgang." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("project_members")
    .select("user_id, role, access_level, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []) as MemberRow[];
  const members = await Promise.all(
    rows.map(async (row) => ({
      userId: row.user_id,
      email: await resolveUserEmail(supabase, row.user_id),
      role: row.role || "byggherre",
      accessLevel: (row.access_level as "read" | "write" | "admin") || "read",
      addedAt: row.created_at || undefined,
    }))
  );

  return NextResponse.json({ members });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    email?: string;
    role?: string;
    accessLevel?: "read" | "write" | "admin";
  };

  const projectId = body.projectId || "";
  const email = (body.email || "").trim().toLowerCase();
  const role = body.role || "byggherre";
  const accessLevel = body.accessLevel || "read";

  if (!projectId || !email) {
    return NextResponse.json({ error: "projectId og e-post er p\u00e5krevd." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const access = await requireProjectAccess(supabase, projectId, user.id, "admin");
  if (!access.ok) {
    return NextResponse.json({ error: access.error || "Ingen tilgang." }, { status: 403 });
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Fant ingen bruker med denne e-posten." }, { status: 404 });
  }

  const { error: insertError } = await supabase.from("project_members").insert({
    project_id: projectId,
    user_id: userData.user.id,
    role,
    access_level: accessLevel,
  });

  if (insertError) {
    const status = insertError.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: insertError.message }, { status });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    userId?: string;
    role?: string;
    accessLevel?: "read" | "write" | "admin";
  };

  const projectId = body.projectId || "";
  const userId = body.userId || "";
  const role = body.role || "byggherre";
  const accessLevel = body.accessLevel || "read";

  if (!projectId || !userId) {
    return NextResponse.json({ error: "projectId og userId er p\u00e5krevd." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const access = await requireProjectAccess(supabase, projectId, user.id, "admin");
  if (!access.ok) {
    return NextResponse.json({ error: access.error || "Ingen tilgang." }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from("project_members")
    .update({ role, access_level: accessLevel })
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { projectId?: string; userId?: string };
  const projectId = body.projectId || "";
  const userId = body.userId || "";

  if (!projectId || !userId) {
    return NextResponse.json({ error: "projectId og userId er p\u00e5krevd." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const access = await requireProjectAccess(supabase, projectId, user.id, "admin");
  if (!access.ok) {
    return NextResponse.json({ error: access.error || "Ingen tilgang." }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
