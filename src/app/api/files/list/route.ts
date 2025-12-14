import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const FILE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_FILE_BUCKET ||
  process.env.NEXT_PUBLIC_SUPABASE_IFC_BUCKET ||
  "ifc-models";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || "";

  if (!projectId) {
    return NextResponse.json({ error: "Mangler projectId" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ files: [] });
  }

  const files: any[] = [];

  try {
    const query = supabase.from("files").select("*").order("uploaded_at", { ascending: false }).limit(200);
    const { data: dbFiles, error: dbErr } = await query.eq("project_id", projectId);
    if (!dbErr && dbFiles) {
      dbFiles.forEach((f: any) => {
        files.push({
          id: f.id,
          name: f.name,
          size: f.size || 0,
          path: f.path,
          publicUrl: f.storage_url,
          uploadedAt: f.uploaded_at,
          projectId: f.project_id,
          category: f.metadata?.category || "other",
          type: f.type,
          hasText: Boolean(f.metadata?.hasText),
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
          const { data: publicData } = supabase.storage.from(FILE_BUCKET).getPublicUrl(fullPath);
          if (!files.find((f) => f.path === fullPath)) {
            files.push({
              id: fullPath,
              name: item.name,
              size: item.metadata?.size ?? 0,
              path: fullPath,
              publicUrl: publicData.publicUrl,
              uploadedAt: item.created_at,
              projectId: projectId || "unknown",
              category: "unknown",
              type: "application/octet-stream",
            });
          }
        });
    }
  } catch (err) {
    console.warn("files list storage feilet", err);
  }

  return NextResponse.json({ files });
}
