export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, requireProjectAccess } from "@/lib/supabase-auth";

const FILE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_FILE_BUCKET ||
  "project-files";

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({} as any));
  const fileIds = Array.isArray(body?.fileIds) ? body.fileIds : [];
  const paths = Array.isArray(body?.paths) ? body.paths : [];
  const projectId = (body?.projectId as string) || "";

  if (fileIds.length === 0 && paths.length === 0) {
    return NextResponse.json({ error: "Ingen filer valgt" }, { status: 400 });
  }
  if (!projectId) {
    return NextResponse.json({ error: "Mangler projectId" }, { status: 400 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const membership = await requireProjectAccess(supabase, projectId, user.id, "write");
  if (!membership.ok) {
    return NextResponse.json({ error: membership.error || "Ingen tilgang." }, { status: 403 });
  }

  const deletePaths = new Set<string>();
  const deleteIds = new Set<string>();

  if (fileIds.length > 0) {
    const query = supabase.from("files").select("id, path, project_id").in("id", fileIds);
    const { data } = projectId ? await query.eq("project_id", projectId) : await query;
    data?.forEach((row: any) => {
      if (row?.id) deleteIds.add(row.id);
      if (row?.path) deletePaths.add(row.path);
    });
  }

  paths.forEach((p: string) => {
    if (p) deletePaths.add(p);
  });

  if (deletePaths.size > 0) {
    const { error } = await supabase.storage.from(FILE_BUCKET).remove(Array.from(deletePaths));
    if (error) {
      return NextResponse.json({ error: "Kunne ikke slette filer i lagring" }, { status: 500 });
    }
  }

  if (deleteIds.size > 0) {
    try {
      await supabase.from("file_texts").delete().in("file_id", Array.from(deleteIds));
    } catch (err) {
      console.warn("Sletting av file_texts feilet", err);
    }
    try {
      await supabase.from("file_requirements").delete().in("file_id", Array.from(deleteIds));
    } catch (err) {
      console.warn("Sletting av file_requirements feilet", err);
    }
    try {
      await supabase.from("ifc_models").delete().in("file_id", Array.from(deleteIds));
    } catch (err) {
      console.warn("Sletting av ifc_models feilet", err);
    }
    await supabase.from("files").delete().in("id", Array.from(deleteIds));
  }

  return NextResponse.json({
    deletedFiles: deleteIds.size,
    deletedPaths: deletePaths.size,
  });
}
