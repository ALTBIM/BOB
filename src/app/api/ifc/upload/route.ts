import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { processIfcBuffer } from "@/lib/ifc-processor";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_IFC_BUCKET || "ifc-models";
const MAX_SIZE_MB = 500;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN || "";

const persistRecord = async (params: {
  projectId: string;
  path: string;
  storageUrl: string;
  file: File;
  provider: string;
}) => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { fileId: undefined, modelId: undefined };

  const { projectId, path, storageUrl, file, provider } = params;
  const uploadedAt = new Date().toISOString();
  const uploadedBy = "system";

  try {
    const filePayload = {
      project_id: projectId,
      name: file.name,
      path,
      type: file.type || "application/octet-stream",
      size: file.size,
      description: "IFC-fil",
      storage_url: storageUrl,
      source_provider: provider,
      uploaded_by: uploadedBy,
      uploaded_at: uploadedAt,
    };

    const { data: fileRow, error: fileError } = await supabase
      .from("files")
      .upsert(filePayload, { onConflict: "path" })
      .select()
      .single();
    if (fileError) throw fileError;

    const { data: modelRow, error: modelError } = await supabase
      .from("ifc_models")
      .upsert(
        {
          project_id: projectId,
          file_id: fileRow?.id,
          version: 1,
          status: "completed",
          storage_url: storageUrl,
          uploaded_at: uploadedAt,
          uploaded_by: uploadedBy,
          name: file.name,
          filename: file.name,
          size: file.size,
          description: "IFC modell opplastet via API",
        },
        { onConflict: "file_id" }
      )
      .select()
      .single();
    if (modelError) throw modelError;

    return { fileId: fileRow?.id, modelId: modelRow?.id };
  } catch (err) {
    console.warn("Persist IFC metadata feilet (ignorerer)", err);
    return { fileId: undefined, modelId: undefined };
  }
};

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

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${projectId}/${safeName}`;
  const buffer = new Uint8Array(await file.arrayBuffer());

  // Try Supabase first if configured
  if (supabase) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });

    if (!error) {
      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const persisted = await persistRecord({
        projectId,
        path,
        storageUrl: publicData.publicUrl,
        file,
        provider: "supabase",
      });
      const modelId = persisted.modelId || path;
      try {
        await processIfcBuffer({ buffer, modelId, projectId });
      } catch (err) {
        console.warn("IFC processing feilet (supabase)", err);
      }
      return NextResponse.json({
        path,
        publicUrl: publicData.publicUrl,
        provider: "supabase",
        fileId: persisted.fileId,
        modelId,
      });
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
        addRandomSuffix: false,
      });
      const persisted = await persistRecord({
        projectId,
        path: blob.pathname || path,
        storageUrl: blob.url,
        file,
        provider: "vercel-blob",
      });
      const modelId = persisted.modelId || blob.pathname || path;
      try {
        await processIfcBuffer({ buffer, modelId, projectId });
      } catch (err) {
        console.warn("IFC processing feilet (blob)", err);
      }
      return NextResponse.json({
        path: blob.pathname || path,
        publicUrl: blob.url,
        provider: "vercel-blob",
        fileId: persisted.fileId,
        modelId,
      });
    } catch (err) {
      console.error("Vercel Blob upload error", err);
      return NextResponse.json({ error: "Opplasting feilet (blob)" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Ingen lagringslosning er konfigurert" }, { status: 500 });
}
