import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_IFC_BUCKET || "ifc-models";
const MAX_SIZE_MB = 500;

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert (mangler URL/KEY)." }, { status: 500 });
  }

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const projectId = (form.get("projectId") as string) || "";

  if (!file || !projectId) {
    return NextResponse.json({ error: "Mangler file eller projectId" }, { status: 400 });
  }

  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json({ error: `Filen er for stor (maks ${MAX_SIZE_MB} MB)` }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "ifc";
  if (!["ifc", "ifczip"].includes(ext.toLowerCase())) {
    return NextResponse.json({ error: "Kun .ifc eller .ifczip er støttet" }, { status: 400 });
  }

  const path = `${projectId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });

  if (error) {
    console.error("Supabase upload error", error);
    return NextResponse.json({ error: "Opplasting feilet" }, { status: 500 });
  }

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ path, publicUrl: publicData.publicUrl });
}
