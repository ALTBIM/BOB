import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const getBearerToken = (request: Request) => {
  const header = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

export async function getAuthUser(request: Request): Promise<{ user: SupabaseUser | null; error?: string }> {
  const token = getBearerToken(request);
  if (!token) return { user: null, error: "Mangler Authorization-header." };
  const supabase = getSupabaseServerClient();
  if (!supabase) return { user: null, error: "Supabase ikke konfigurert." };
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return { user: null, error: error.message };
  return { user: data.user ?? null };
}

export async function requireProjectMembership(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  projectId: string,
  userId: string
) {
  if (!supabase) return { ok: false, error: "Supabase ikke konfigurert." };
  const { data, error } = await supabase
    .from("project_members")
    .select("id, role, company, permissions, access_level")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Ingen tilgang til valgt prosjekt." };
  return { ok: true, membership: data };
}

export async function requireProjectAccess(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  projectId: string,
  userId: string,
  level: "read" | "write" | "admin"
) {
  const membership = await requireProjectMembership(supabase, projectId, userId);
  if (!membership.ok) return membership;
  const access = membership.membership?.access_level as string | undefined;
  if (level === "read") return membership;
  if (level === "write" && (access === "write" || access === "admin")) return membership;
  if (level === "admin" && access === "admin") return membership;
  return { ok: false, error: "Ingen tilgang til valgt prosjekt." };
}
