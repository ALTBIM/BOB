import { NextResponse } from "next/server";
import { saveIfcMetadata } from "@/lib/ifc-store";

export const runtime = "nodejs";

type Body = {
  projectId: string;
  modelId: string;
  name?: string;
  materials?: string[];
  objects?: number;
  zones?: number;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<Body>;
  const { projectId, modelId } = body;

  if (!projectId || !modelId) {
    return NextResponse.json({ error: "projectId og modelId er påkrevd" }, { status: 400 });
  }

  try {
    await saveIfcMetadata({
      modelId,
      projectId,
      name: body.name,
      materials: body.materials ?? [],
      objects: body.objects,
      zones: body.zones,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Kunne ikke lagre IFC-metadata" }, { status: 500 });
  }
}
