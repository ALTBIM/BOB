import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_IFC_BUCKET || "ifc-models";

const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

export const uploadIfcFile = async (file: File, projectId: string) => {
  if (!supabase) {
    console.warn("Supabase ikke konfigurert (mangler URL/KEY). Hopper over opplasting.");
    return null;
  }

  const ext = file.name.split(".").pop() || "ifc";
  const path = `${projectId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });

  if (error) {
    console.error("Supabase upload error", error);
    return null;
  }

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, publicUrl: publicData.publicUrl };
};
