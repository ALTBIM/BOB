import { NextResponse } from "next/server";
import { processIfcBuffer } from "@/lib/ifc-processor";

export const runtime = "nodejs";

type Body = {
  projectId: string;
  modelId: string;
  fileUrl: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<Body>;
  const { projectId, modelId, fileUrl } = body;

  if (!projectId || !modelId || !fileUrl) {
    return NextResponse.json({ error: "projectId, modelId og fileUrl er p\u00e5krevd" }, { status: 400 });
  }

  try {
    const res = await fetch(fileUrl);
    if (!res.ok) {
      return NextResponse.json({ error: `Kunne ikke hente IFC (${res.status})` }, { status: 400 });
    }
    const buffer = new Uint8Array(await res.arrayBuffer());
    const result = await processIfcBuffer({ buffer, modelId, projectId });
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error("IFC processing feilet", err);
    return NextResponse.json({ error: "IFC processing feilet", detail: String(err) }, { status: 500 });
  }
}
