import { getSupabaseBrowserClient } from "@/lib/supabase-client";

const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const IFC_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_IFC_BUCKET || "ifc-models";
const FILE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_FILE_BUCKET || "project-files";

const getAnonClient = () => {
  const supabase = getSupabaseBrowserClient();
  if (supabase) return supabase;
  if (typeof window === "undefined") return null;
  if (!PUBLIC_URL || !PUBLIC_KEY) return null;
  return getSupabaseBrowserClient();
};

const getAccessToken = async () => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

const withAuthHeaders = async (headers: Record<string, string> = {}) => {
  const token = await getAccessToken();
  if (!token) return headers;
  return { ...headers, Authorization: `Bearer ${token}` };
};

// Client-side: prefer server API (uses service credentials or Vercel Blob token). Fall back to anon Supabase if configured.
export const uploadIfcFile = async (file: File, projectId: string) => {
  if (typeof window !== "undefined") {
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      const res = await fetch("/api/ifc/upload", {
        method: "POST",
        body: form,
        cache: "no-store",
        headers: await withAuthHeaders(),
      });
      if (!res.ok) {
        const text = await res.text();
        console.warn("API upload feilet", res.status, text);
        return null;
      }
      const data = await res.json();
      return {
        path: data.path as string,
        publicUrl: data.publicUrl as string,
        provider: data.provider as string,
        fileId: data.fileId as string | undefined,
        modelId: data.modelId as string | undefined,
        version: data.version as number | undefined,
      };
    } catch (err) {
      console.warn("API upload feilet", err);
    }
  }

  const client = getAnonClient();
  if (!client) {
    console.warn("Ingen lagring konfigurert (hverken API eller Supabase anon).");
    return null;
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${projectId}/${safeName}`;
  const { error } = await client.storage.from(IFC_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });
  if (error) {
    console.error("Supabase upload error", error);
    return null;
  }
  const { data } = client.storage.from(IFC_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl, provider: "supabase", fileId: undefined, modelId: undefined };
};

export const listIfcFiles = async (projectId: string, includeArchived = false) => {
  // Use server API (handles Supabase service key or Vercel Blob)
  try {
    const url = projectId
      ? `/api/ifc/list?projectId=${encodeURIComponent(projectId)}&includeArchived=${includeArchived ? "1" : "0"}`
      : `/api/ifc/list?includeArchived=${includeArchived ? "1" : "0"}`;
      const res = await fetch(url, { method: "GET", cache: "no-store", headers: await withAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      return (data.files || []).map((item: any) => ({
        id: item.id || item.path,
        name: item.name?.replace(/^\d{10,}-/, "") || item.name,
        size: item.size || 0,
        path: item.path,
        publicUrl: item.publicUrl,
        uploadedAt: item.uploadedAt,
        provider: item.provider,
        fileId: item.id,
        version: item.version,
        archived: item.archived,
      }));
    }
  } catch (err) {
    console.warn("Kunne ikke hente filer via API", err);
  }

  // Fallback: anon Supabase if available
  const client = getAnonClient();
  if (!client) return [];
  const path = projectId ? `${projectId}` : "";
  const { data, error } = await client.storage.from(IFC_BUCKET).list(path, {
    limit: 100,
  });
  if (error || !data) return [];
  return data
    .filter((item) => !item.name.endsWith("/"))
    .map((item) => {
      const fullPath = `${path}/${item.name}`;
      const { data: publicData } = client.storage.from(IFC_BUCKET).getPublicUrl(fullPath);
      return {
        id: fullPath,
        name: item.name.replace(/^\d{10,}-/, ""),
        size: item.metadata?.size ?? 0,
        path: fullPath,
        publicUrl: publicData.publicUrl,
        uploadedAt: item.created_at,
        provider: "supabase",
        fileId: undefined,
        version: 1,
        archived: false,
      };
    });
};

export const uploadGenericFile = async (file: File, projectId: string, description?: string) => {
  if (typeof window !== "undefined") {
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      if (description) form.append("description", description);
      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: form,
        cache: "no-store",
        headers: await withAuthHeaders(),
      });
      if (!res.ok) {
        const text = await res.text();
        console.warn("API generic upload feilet", res.status, text);
        return null;
      }
      const data = await res.json();
      return {
        path: data.path as string,
        publicUrl: data.publicUrl as string,
        provider: data.provider as string,
        fileId: data.fileId as string | undefined,
        category: data.category as string | undefined,
        hasText: data.hasText as boolean | undefined,
        version: data.version as number | undefined,
      };
    } catch (err) {
      console.warn("API generic upload feilet", err);
    }
  }

  const client = getAnonClient();
  if (!client) {
    console.warn("Ingen lagring konfigurert (hverken API eller Supabase anon).");
    return null;
  }

  const path = `${projectId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const { error } = await client.storage.from(FILE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) {
    console.error("Supabase upload error", error);
    return null;
  }
  const { data } = client.storage.from(FILE_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl, provider: "supabase", fileId: undefined, category: undefined };
};

export const listAllFiles = async (projectId: string, includeArchived = false) => {
  // Server API handles Supabase service key; falls back to anon storage
  try {
    const url = projectId
      ? `/api/files/list?projectId=${encodeURIComponent(projectId)}&includeArchived=${includeArchived ? "1" : "0"}`
      : `/api/files/list?includeArchived=${includeArchived ? "1" : "0"}`;
      const res = await fetch(url, { method: "GET", cache: "no-store", headers: await withAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      return (data.files || []).map((item: any) => ({
        id: item.id || item.path,
        name: item.name,
        size: item.size || 0,
        path: item.path,
        publicUrl: item.publicUrl,
        uploadedAt: item.uploadedAt,
        provider: item.provider,
        fileId: item.id,
        type: item.type,
        category: item.category,
        projectId: item.projectId,
        uploadedBy: item.uploadedBy,
        hasText: item.hasText,
        version: item.version,
        archived: item.archived,
      }));
    }
  } catch (err) {
    console.warn("Kunne ikke hente filer via API", err);
  }

  const client = getAnonClient();
  if (!client) return [];
  const path = projectId ? `${projectId}` : "";
  const { data, error } = await client.storage.from(FILE_BUCKET).list(path, { limit: 100 });
  if (error || !data) return [];
  return data
    .filter((item) => !item.name.endsWith("/"))
    .map((item) => {
      const fullPath = `${path}/${item.name}`;
      const { data: publicData } = client.storage.from(FILE_BUCKET).getPublicUrl(fullPath);
      return {
        id: fullPath,
        name: item.name,
        size: item.metadata?.size ?? 0,
        path: fullPath,
        publicUrl: publicData.publicUrl,
        uploadedAt: item.created_at,
        provider: "supabase",
        fileId: undefined,
        type: "application/octet-stream",
        category: "unknown",
        projectId,
        version: 1,
        archived: false,
      };
    });
};
