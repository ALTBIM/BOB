import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(
  _req: Request,
  context: { params: { projectId: string } }
) {
  const projectId = context.params.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "Mangler projectId" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ models: [] });
  }

  try {
    const { data, error } = await supabase
      .from("files")
      .select("id,name,filename,path,storage_url,uploaded_at,metadata")
      .eq("project_id", projectId)
      .order("uploaded_at", { ascending: false })
      .limit(200);

    if (error) {
      console.warn("files query error", error);
      return NextResponse.json({ models: [] });
    }

    const models =
      data
        ?.filter((f: any) => {
          const ext = (f.name || f.filename || "").toLowerCase();
          const category = f.metadata?.category;
          return category === "ifc" || ext.endsWith(".ifc") || ext.endsWith(".ifczip");
        })
        .map((f: any) => ({
          id: f.id,
          name: f.name || f.filename || f.path,
          filename: f.filename || f.name,
          path: f.path,
          storageUrl: f.storage_url,
          uploadedAt: f.uploaded_at,
          version: f.metadata?.version || 1,
          projectId,
        })) || [];

    return NextResponse.json({ models });
  } catch (err) {
    console.error("models list error", err);
    return NextResponse.json({ models: [] });
  }
}
