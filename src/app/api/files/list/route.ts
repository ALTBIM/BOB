import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, requireProjectMembership } from "@/lib/supabase-auth";

const FILE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_FILE_BUCKET || "project-files";
const SIGNED_URL_TTL = 60 * 60;

const parseVersion = (name: string) => {
  const match = name.match(/__v(\d+)(?=\.|$)/);
  const version = match ? Number(match[1]) : 1;
  const clean = name.replace(/__v\d+(?=\.|$)/, "");
  return { clean, version };
};

const detectCategoryFromName = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.endsWith(".ifc") || lower.endsWith(".ifczip")) return "ifc";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".doc") || lower.endsWith(".docx") || lower.endsWith(".rtf") || lower.endsWith(".txt") || lower.endsWith(".md")) {
    return "document";
  }
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx") || lower.endsWith(".csv")) return "spreadsheet";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".gif") || lower.endsWith(".webp") || lower.endsWith(".heic")) {
    return "image";
  }
  return "other";
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || "";
  const includeArchived = searchParams.get("includeArchived") === "1";

  if (!projectId) {
    return NextResponse.json({ error: "Mangler projectId" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ files: [] });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const membership = await requireProjectMembership(supabase, projectId, user.id);
  if (!membership.ok) {
    return NextResponse.json({ error: membership.error || "Ingen tilgang." }, { status: 403 });
  }

  const files: any[] = [];
  const dbPaths = new Set<string>();

  try {
    const query = supabase.from("files").select("*").order("uploaded_at", { ascending: false }).limit(200);
    const { data: dbFiles, error: dbErr } = await query.eq("project_id", projectId);
    if (!dbErr && dbFiles) {
      for (const f of dbFiles) {
        if (f?.path) dbPaths.add(f.path);
        if (!includeArchived && f.metadata?.archived) continue;
        const fallbackCategory = detectCategoryFromName(String(f.name || ""));
        let signedUrl: string | null = null;
        if (f?.path) {
          const { data: signed } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(f.path, SIGNED_URL_TTL);
          signedUrl = signed?.signedUrl || null;
        }
        files.push({
          id: f.id,
          name: f.name,
          size: f.size || 0,
          path: f.path,
          publicUrl: signedUrl,
          uploadedAt: f.uploaded_at,
          projectId: f.project_id,
          category: f.metadata?.category || fallbackCategory,
          type: f.type,
          hasText: Boolean(f.metadata?.hasText),
          version: Number(f.metadata?.version) || 1,
          archived: Boolean(f.metadata?.archived),
        });
      }
    }
  } catch (err) {
    console.warn("files list db feilet", err);
  }

  try {
    const path = projectId ? `${projectId}` : "";
    const { data, error } = await supabase.storage.from(FILE_BUCKET).list(path, { limit: 200 });
    if (!error && data) {
      for (const item of data.filter((i) => !i.name.endsWith("/"))) {
        const fullPath = path ? `${path}/${item.name}` : item.name;
        if (dbPaths.has(fullPath)) continue;
        const parsed = parseVersion(item.name);
        const fallbackCategory = detectCategoryFromName(parsed.clean);
        if (!files.find((f) => f.path === fullPath)) {
          files.push({
            id: fullPath,
            name: parsed.clean,
            size: item.metadata?.size ?? 0,
            path: fullPath,
            publicUrl: null,
            uploadedAt: item.created_at,
            projectId: projectId || "unknown",
            category: fallbackCategory,
            type: "application/octet-stream",
            version: parsed.version,
            archived: false,
          });
        }
      }
    }

    const signable = files.filter((f) => !f.publicUrl && f.path);
    for (const f of signable) {
      const { data: signed } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(f.path, SIGNED_URL_TTL);
      f.publicUrl = signed?.signedUrl || null;
    }
  } catch (err) {
    console.warn("files list storage feilet", err);
  }

  return NextResponse.json({ files });
}
