import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_IFC_BUCKET || "ifc-models";
const MAX_SIZE_MB = 500;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN || "";

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();

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
    return NextResponse.json({ error: "Kun .ifc eller .ifczip er stottet" }, { status: 400 });
  }

  const path = `${projectId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

  // Try Supabase first if configured
  if (supabase) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

    if (!error) {
      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return NextResponse.json({ path, publicUrl: publicData.publicUrl, provider: "supabase" });
    }

    console.error("Supabase upload error", error);
  }

  // Fallback to Vercel Blob if configured
  if (BLOB_TOKEN) {
    try {
      const blob = await put(path, file, {
        access: "public",
        token: BLOB_TOKEN,
        contentType: file.type || "application/octet-stream",
      });
      return NextResponse.json({ path: blob.pathname || path, publicUrl: blob.url, provider: "vercel-blob" });
    } catch (err) {
      console.error("Vercel Blob upload error", err);
      return NextResponse.json({ error: "Opplasting feilet (blob)" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Ingen lagringslosning er konfigurert" }, { status: 500 });
}
