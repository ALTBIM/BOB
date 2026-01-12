import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, requireProjectMembership } from "@/lib/supabase-auth";
import { list } from "@vercel/blob";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_IFC_BUCKET || "ifc-models";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN || "";
const SIGNED_URL_TTL = 60 * 60;

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

  if (!projectId) {
    return NextResponse.json({ error: "Mangler projectId" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ files: [] });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const membership = await requireProjectMembership(supabase, projectId, user.id);
  if (!membership.ok) {
    return NextResponse.json({ error: membership.error || "Ingen tilgang." }, { status: 403 });
  }

  const files: Array<{
    path: string;
    name: string;
    size: number;
    publicUrl: string | null;
    uploadedAt?: string;
    provider: string;
    version?: number;
    archived?: boolean;
  }> = [];

  const dbPaths = new Set<string>();
  try {
    const query = supabase.from("files").select("*").order("uploaded_at", { ascending: false }).limit(200);
    const { data: dbFiles, error: dbErr } = await query.eq("project_id", projectId);

    if (!dbErr && dbFiles) {
      for (const f of dbFiles) {
        if (f?.path) dbPaths.add(f.path);
        if (!includeArchived && f.metadata?.archived) continue;
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(f.path, SIGNED_URL_TTL);
        files.push({
          path: f.path,
          name: f.name,
          size: f.size || 0,
          uploadedAt: f.uploaded_at,
          publicUrl: signed?.signedUrl || null,
          provider: f.source_provider || "supabase",
          version: Number(f.metadata?.version) || 1,
          archived: Boolean(f.metadata?.archived),
        });
      }
    }
  } catch (err) {
    console.warn("DB files list feilet (ignorerer)", err);
  }

  try {
    const supaPath = projectId ? `${projectId}` : "";
    const { data, error } = await supabase.storage.from(BUCKET).list(supaPath, { limit: 200 });
    if (!error && data) {
      for (const item of data.filter((i) => !i.name.endsWith("/"))) {
        const fullPath = supaPath ? `${supaPath}/${item.name}` : item.name;
        if (dbPaths.has(fullPath)) continue;
        const parsed = parseVersion(item.name);
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(fullPath, SIGNED_URL_TTL);
        files.push({
          path: fullPath,
          name: normalizeName(parsed.clean),
          size: item.metadata?.size ?? 0,
          uploadedAt: item.created_at,
          publicUrl: signed?.signedUrl || null,
          provider: "supabase",
          version: parsed.version,
          archived: false,
        });
      }
    }
  } catch (err) {
    console.warn("Supabase storage list feilet", err);
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

  const deduped = Array.from(
    files.reduce((map, f) => {
      if (!map.has(f.path)) map.set(f.path, f);
      return map;
    }, new Map<string, (typeof files)[number]>())
  ).map(([, value]) => value);

  return NextResponse.json({ files: deduped });
}
