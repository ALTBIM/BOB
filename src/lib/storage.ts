import { createClient } from "@supabase/supabase-js";

const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_IFC_BUCKET || "ifc-models";

const client =
  typeof window !== "undefined" && PUBLIC_URL && PUBLIC_KEY
    ? createClient(PUBLIC_URL, PUBLIC_KEY)
    : null;

// Client-side: prefer server API (uses service credentials or Vercel Blob token). Fall back to anon Supabase if configured.
export const uploadIfcFile = async (file: File, projectId: string) => {
  if (typeof window !== "undefined") {
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      const res = await fetch("/api/ifc/upload", { method: "POST", body: form, cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        return { path: data.path as string, publicUrl: data.publicUrl as string, provider: data.provider as string };
      }
      const err = await res.json().catch(() => ({}));
      console.warn("API upload feilet", err);
    } catch (err) {
      console.warn("API upload feilet", err);
    }
  }

  if (!client) {
    console.warn("Ingen lagring konfigurert (hverken API eller Supabase anon).");
    return null;
  }

  const path = `${projectId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const { error } = await client.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) {
    console.error("Supabase upload error", error);
    return null;
  }
  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl, provider: "supabase" };
};

export const listIfcFiles = async (projectId: string) => {
  // Use server API (handles Supabase service key or Vercel Blob)
  try {
    const url = projectId ? `/api/ifc/list?projectId=${encodeURIComponent(projectId)}` : `/api/ifc/list`;
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      return (data.files || []).map((item: any) => ({
        id: item.path,
        name: item.name,
        size: item.size || 0,
        path: item.path,
        publicUrl: item.publicUrl,
        uploadedAt: item.uploadedAt,
        provider: item.provider,
      }));
    }
  } catch (err) {
    console.warn("Kunne ikke hente filer via API", err);
  }

  // Fallback: anon Supabase if available
  if (!client) return [];
  const path = projectId ? `${projectId}` : "";
  const { data, error } = await client.storage.from(BUCKET).list(path, {
    limit: 100,
  });
  if (error || !data) return [];
  return data
    .filter((item) => !item.name.endsWith("/"))
    .map((item) => {
      const fullPath = `${path}/${item.name}`;
      const { data: publicData } = client.storage.from(BUCKET).getPublicUrl(fullPath);
      return {
        id: fullPath,
        name: item.name,
        size: item.metadata?.size ?? 0,
        path: fullPath,
        publicUrl: publicData.publicUrl,
        uploadedAt: item.created_at,
        provider: "supabase",
      };
    });
};
