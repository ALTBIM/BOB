import { NextResponse } from "next/server";
import { getIfcMetadata, saveIfcMetadata } from "@/lib/ifc-store";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, requireProjectAccess, requireProjectMembership } from "@/lib/supabase-auth";

export const runtime = "nodejs";

type Body = {
  projectId: string;
  modelId: string;
  name?: string;
  materials?: string[];
  objects?: number;
  zones?: number;
  elementSummary?: {
    elementType: string;
    typeName: string;
    count: number;
    netArea: number;
    length: number;
    volume: number;
  }[];
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";
  const modelId = url.searchParams.get("modelId") || "";
  if (!projectId || !modelId) {
    return NextResponse.json({ error: "projectId og modelId er p\u00e5krevd" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert" }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const membership = await requireProjectMembership(supabase, projectId, user.id);
  if (!membership.ok) {
    return NextResponse.json({ error: membership.error || "Ingen tilgang." }, { status: 403 });
  }

  try {
    const meta = await getIfcMetadata(projectId, modelId);
    if (!meta) {
      return NextResponse.json({ error: "Fant ikke metadata" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, metadata: meta });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Kunne ikke hente IFC-metadata" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<Body>;
  const { projectId, modelId } = body;

  if (!projectId || !modelId) {
    return NextResponse.json({ error: "projectId og modelId er p\u00e5krevd" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert" }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const membership = await requireProjectAccess(supabase, projectId, user.id, "write");
  if (!membership.ok) {
    return NextResponse.json({ error: membership.error || "Ingen tilgang." }, { status: 403 });
  }

  try {
    await saveIfcMetadata({
      modelId,
      projectId,
      name: body.name,
      materials: body.materials ?? [],
      objects: body.objects,
      zones: body.zones,
      elementSummary: body.elementSummary ?? [],
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Kunne ikke lagre IFC-metadata" }, { status: 500 });
  }
}
