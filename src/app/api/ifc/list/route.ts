import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { list } from "@vercel/blob";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_IFC_BUCKET || "ifc-models";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN || "";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || "";

  const files: Array<{
    path: string;
    name: string;
    size: number;
    publicUrl: string;
    uploadedAt?: string;
    provider: string;
  }> = [];

  const supabase = getSupabaseServerClient();
  if (supabase) {
    const supaPath = projectId ? `${projectId}` : "";
    const { data, error } = await supabase.storage.from(BUCKET).list(supaPath, { limit: 200 });
    if (!error && data) {
      data
        .filter((item) => !item.name.endsWith("/"))
        .forEach((item) => {
          const fullPath = supaPath ? `${supaPath}/${item.name}` : item.name;
          const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(fullPath);
          files.push({
            path: fullPath,
            name: item.name,
            size: item.metadata?.size ?? 0,
            uploadedAt: item.created_at,
            publicUrl: publicData.publicUrl,
            provider: "supabase",
          });
        });
    }
  }

  if (BLOB_TOKEN) {
    try {
      const prefix = projectId ? `${projectId}/` : "";
      const { blobs } = await list({ prefix, token: BLOB_TOKEN });
      blobs.forEach((blob) => {
        files.push({
          path: blob.pathname,
          name: blob.pathname.split("/").pop() || blob.pathname,
          size: blob.size || 0,
          uploadedAt: blob.uploadedAt || undefined,
          publicUrl: blob.url,
          provider: "vercel-blob",
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
