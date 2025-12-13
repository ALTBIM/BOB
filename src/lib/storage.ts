import { createClient } from "@supabase/supabase-js";

const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_IFC_BUCKET || "ifc-models";

const client =
  typeof window !== "undefined" && PUBLIC_URL && PUBLIC_KEY
    ? createClient(PUBLIC_URL, PUBLIC_KEY)
    : null;

// Client-side: try calling our API route (server-side service key). Fallback to anon upload if API not configured.
export const uploadIfcFile = async (file: File, projectId: string) => {
  // Prefer server route (uses service key) if running in browser and route is available
  if (typeof window !== "undefined") {
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      const res = await fetch("/api/ifc/upload", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        return { path: data.path as string, publicUrl: data.publicUrl as string };
      }
    } catch (err) {
      console.warn("API upload failed, falling back to anon upload", err);
    }
  }

  if (!client) {
    console.warn("Supabase (anon) ikke konfigurert. Hopper over opplasting.");
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
  return { path, publicUrl: data.publicUrl };
};
