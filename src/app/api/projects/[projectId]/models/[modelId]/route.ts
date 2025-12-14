import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(
  _req: Request,
  context: { params: { projectId: string; modelId: string } }
) {
  const projectId = context.params.projectId;
  const modelId = context.params.modelId;
  if (!projectId || !modelId) {
    return NextResponse.json({ error: "Mangler projectId eller modelId" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert" }, { status: 500 });
  }

  try {
    const { data, error } = await supabase
      .from("files")
      .select("id,name,filename,path,storage_url,uploaded_at,metadata,project_id")
      .eq("project_id", projectId)
      .or(`id.eq.${modelId},path.eq.${modelId}`)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Fant ikke modell" }, { status: 404 });
    }

    const result = {
      id: data.id,
      name: data.name || data.filename || data.path,
      filename: data.filename || data.name,
      path: data.path,
      storageUrl: data.storage_url,
      uploadedAt: data.uploaded_at,
      version: data.metadata?.version || 1,
      projectId: data.project_id,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("model fetch error", err);
    return NextResponse.json({ error: "Kunne ikke hente modell" }, { status: 500 });
  }
}
