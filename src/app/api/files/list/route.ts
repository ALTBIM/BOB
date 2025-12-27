import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const FILE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_FILE_BUCKET ||
  process.env.NEXT_PUBLIC_SUPABASE_IFC_BUCKET ||
  "ifc-models";
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

  const files: any[] = [];
  const dbPaths = new Set<string>();

  try {
    const query = supabase.from("files").select("*").order("uploaded_at", { ascending: false }).limit(200);
    const { data: dbFiles, error: dbErr } = await query.eq("project_id", projectId);
    if (!dbErr && dbFiles) {
      dbFiles.forEach((f: any) => {
        if (f?.path) dbPaths.add(f.path);
        if (!includeArchived && f.metadata?.archived) return;
        const fallbackCategory = detectCategoryFromName(String(f.name || ""));
        files.push({
          id: f.id,
          name: f.name,
          size: f.size || 0,
          path: f.path,
          publicUrl: f.storage_url,
          uploadedAt: f.uploaded_at,
          projectId: f.project_id,
          category: f.metadata?.category || fallbackCategory,
          type: f.type,
          hasText: Boolean(f.metadata?.hasText),
          version: Number(f.metadata?.version) || 1,
          archived: Boolean(f.metadata?.archived),
        });
      });
    }
  } catch (err) {
    console.warn("files list db feilet", err);
  }

  // Storage fallback (in case db rows mangler)
  try {
    const path = projectId ? `${projectId}` : "";
    const { data, error } = await supabase.storage.from(FILE_BUCKET).list(path, { limit: 200 });
    if (!error && data) {
      data
        .filter((item) => !item.name.endsWith("/"))
        .forEach((item) => {
          const fullPath = path ? `${path}/${item.name}` : item.name;
          if (dbPaths.has(fullPath)) return;
          const { data: publicData } = supabase.storage.from(FILE_BUCKET).getPublicUrl(fullPath);
          const parsed = parseVersion(item.name);
          if (!files.find((f) => f.path === fullPath)) {
            const fallbackCategory = detectCategoryFromName(parsed.clean);
            files.push({
              id: fullPath,
              name: parsed.clean,
              size: item.metadata?.size ?? 0,
              path: fullPath,
              publicUrl: publicData.publicUrl,
              uploadedAt: item.created_at,
              projectId: projectId || "unknown",
              category: fallbackCategory,
              type: "application/octet-stream",
              version: parsed.version,
              archived: false,
            });
          }
        });
    }
  } catch (err) {
    console.warn("files list storage feilet", err);
  }

  return NextResponse.json({ files });
}
