import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, requireProjectMembership } from "@/lib/supabase-auth";

const IFC_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_IFC_BUCKET || "ifc-models";
const SIGNED_URL_TTL = 60 * 60;

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
    const { user, error: authError } = await getAuthUser(_req);
    if (!user) {
      return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
    }
    const membership = await requireProjectMembership(supabase, projectId, user.id);
    if (!membership.ok) {
      return NextResponse.json({ error: membership.error || "Ingen tilgang." }, { status: 403 });
    }

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

    const models = [];
    for (const f of data || []) {
      const ext = (f.name || f.filename || "").toLowerCase();
      const category = f.metadata?.category;
      if (!(category === "ifc" || ext.endsWith(".ifc") || ext.endsWith(".ifczip"))) continue;
      const { data: signed } = await supabase.storage.from(IFC_BUCKET).createSignedUrl(f.path, SIGNED_URL_TTL);
      models.push({
        id: f.id,
        name: f.name || f.filename || f.path,
        filename: f.filename || f.name,
        path: f.path,
        storageUrl: signed?.signedUrl || null,
        uploadedAt: f.uploaded_at,
        version: f.metadata?.version || 1,
        projectId,
      });
    }

    return NextResponse.json({ models });
  } catch (err) {
    console.error("models list error", err);
    return NextResponse.json({ models: [] });
  }
}
