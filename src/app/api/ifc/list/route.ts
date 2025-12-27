import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { list } from "@vercel/blob";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_IFC_BUCKET || "ifc-models";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN || "";

const normalizeName = (name: string) => name.replace(/^\d{10,}-/, "");
const parseVersion = (name: string) => {
  const match = name.match(/__v(\d+)(?=\.|$)/);
  const version = match ? Number(match[1]) : 1;
  const clean = name.replace(/__v\d+(?=\.|$)/, "");
  return { clean, version };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || "";
  const includeArchived = searchParams.get("includeArchived") === "1";

  const files: Array<{
    path: string;
    name: string;
    size: number;
    publicUrl: string;
    uploadedAt?: string;
    provider: string;
    version?: number;
    archived?: boolean;
  }> = [];

  const supabase = getSupabaseServerClient();
  const dbPaths = new Set<string>();
  if (supabase) {
    // Persisted metadata if tables finnes
    try {
    const query = supabase.from("files").select("*").order("uploaded_at", { ascending: false }).limit(200);
    const { data: dbFiles, error: dbErr } = projectId ? await query.eq("project_id", projectId) : await query;

    if (!dbErr && dbFiles) {
      dbFiles.forEach((f: any) => {
        if (f?.path) dbPaths.add(f.path);
        if (!includeArchived && f.metadata?.archived) return;
        files.push({
          path: f.path,
          name: f.name,
          size: f.size || 0,
          uploadedAt: f.uploaded_at,
          publicUrl: f.storage_url,
          provider: f.source_provider || "supabase",
          version: Number(f.metadata?.version) || 1,
          archived: Boolean(f.metadata?.archived),
        });
      });
    }
    } catch (err) {
      console.warn("DB files list feilet (ignorerer)", err);
    }

    const supaPath = projectId ? `${projectId}` : "";
    const { data, error } = await supabase.storage.from(BUCKET).list(supaPath, { limit: 200 });
    if (!error && data) {
      data
        .filter((item) => !item.name.endsWith("/"))
        .forEach((item) => {
          const fullPath = supaPath ? `${supaPath}/${item.name}` : item.name;
          if (dbPaths.has(fullPath)) return;
          const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(fullPath);
          const parsed = parseVersion(item.name);
          files.push({
            path: fullPath,
            name: normalizeName(parsed.clean),
            size: item.metadata?.size ?? 0,
            uploadedAt: item.created_at,
            publicUrl: publicData.publicUrl,
            provider: "supabase",
            version: parsed.version,
            archived: false,
          });
        });
    }
  }

  if (BLOB_TOKEN) {
    try {
      const prefix = projectId ? `${projectId}/` : "";
      const { blobs } = await list({ prefix, token: BLOB_TOKEN });
      blobs.forEach((blob) => {
        const parsed = parseVersion(blob.pathname.split("/").pop() || blob.pathname);
        files.push({
          path: blob.pathname,
          name: normalizeName(parsed.clean),
          size: blob.size || 0,
          uploadedAt: blob.uploadedAt || undefined,
          publicUrl: blob.url,
          provider: "vercel-blob",
          version: parsed.version,
          archived: false,
        });
      });
    } catch (err) {
      console.error("Blob list feilet", err);
    }
  }

  // Deduplicate by path (prefer Supabase entry if both exist)
  const deduped = Array.from(
    files.reduce((map, f) => {
      if (!map.has(f.path)) map.set(f.path, f);
      return map;
    }, new Map<string, (typeof files)[number]>())
  ).map(([, value]) => value);

  return NextResponse.json({ files: deduped });
}
