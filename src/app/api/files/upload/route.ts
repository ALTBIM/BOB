import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const FILE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_FILE_BUCKET ||
  process.env.NEXT_PUBLIC_SUPABASE_IFC_BUCKET ||
  "ifc-models";

const MAX_SIZE_MB = 500;

const detectCategory = (filename: string, mime: string) => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "ifc" || ext === "ifczip") return "ifc";
  if (["pdf"].includes(ext)) return "pdf";
  if (["doc", "docx", "rtf", "txt", "md"].includes(ext)) return "document";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return "image";
  if (["xls", "xlsx", "csv"].includes(ext)) return "spreadsheet";
  if (mime.includes("image/")) return "image";
  return "other";
};

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert" }, { status: 500 });
  }

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const projectId = (form.get("projectId") as string) || "";
  const description = (form.get("description") as string) || "";

  if (!file || !projectId) {
    return NextResponse.json({ error: "Mangler file eller projectId" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json({ error: `Filen er for stor (maks ${MAX_SIZE_MB} MB)` }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "dat";
  const path = `${projectId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const category = detectCategory(file.name, file.type || "");

  const { error: uploadError } = await supabase.storage.from(FILE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) {
    console.error("Supabase upload error", uploadError);
    return NextResponse.json({ error: "Opplasting feilet" }, { status: 500 });
  }

  const { data: publicData } = supabase.storage.from(FILE_BUCKET).getPublicUrl(path);

  // Persist metadata
  try {
    const { data: fileRow, error: fileError } = await supabase
      .from("files")
      .upsert(
        {
          project_id: projectId,
          name: file.name,
          path,
          type: file.type || "application/octet-stream",
          size: file.size,
          description,
          storage_url: publicData.publicUrl,
          source_provider: "supabase",
          uploaded_by: "system",
          uploaded_at: new Date().toISOString(),
          metadata: { category, ext },
        },
        { onConflict: "path" }
      )
      .select()
      .single();
    if (fileError) {
      console.warn("Kunne ikke lagre metadata i files-tabellen", fileError);
    }
    return NextResponse.json({
      path,
      publicUrl: publicData.publicUrl,
      provider: "supabase",
      fileId: fileRow?.id,
      category,
    });
  } catch (err) {
    console.warn("Metadata-lagring feilet", err);
    return NextResponse.json({
      path,
      publicUrl: publicData.publicUrl,
      provider: "supabase",
      category,
    });
  }
}
