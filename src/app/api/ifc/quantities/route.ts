import { NextResponse } from "next/server";
import * as WebIFC from "web-ifc";
import path from "path";

export const runtime = "nodejs";

const MAX_SIZE_MB = 200;

// Minimal type list to report counts
const TYPES = [
  "IFCPROJECT",
  "IFCSITE",
  "IFCBUILDING",
  "IFCBUILDINGSTOREY",
  "IFCSPACE",
  "IFCWALL",
  "IFCSLAB",
  "IFCBEAM",
  "IFCCOLUMN",
  "IFCDOOR",
  "IFCWINDOW",
  "IFCFURNISHINGELEMENT",
];

const typeCodes: Record<string, number> = {};
for (const k of Object.keys(WebIFC)) {
  if (k.startsWith("IFC")) {
    // @ts-ignore
    typeCodes[k] = (WebIFC as any)[k];
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileUrl } = body as { fileUrl?: string };
    if (!fileUrl) {
      return NextResponse.json({ error: "Mangler fileUrl" }, { status: 400 });
    }

    const res = await fetch(fileUrl);
    if (!res.ok) {
      return NextResponse.json({ error: `Kunne ikke hente IFC (status ${res.status})` }, { status: 400 });
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `IFC er for stor (> ${MAX_SIZE_MB} MB)` }, { status: 400 });
    }

    const api = new WebIFC.IfcAPI();
    const wasmDir = path.join(process.cwd(), "node_modules", "web-ifc", "wasm");
    api.SetWasmPath(wasmDir + path.sep);
    await api.Init();

    const modelID = api.OpenModel(new Uint8Array(buf));

    const counts: Record<string, number> = {};
    for (const t of TYPES) {
      const code = typeCodes[t];
      if (!code) continue;
      try {
        const ids = api.GetLineIDsWithType(modelID, code);
        counts[t] = ids?.size() ?? 0;
      } catch (err) {
        counts[t] = 0;
      }
    }

    api.CloseModel(modelID);

    return NextResponse.json({
      ok: true,
      counts,
    });
  } catch (err: any) {
    console.error("Quantities error", err);
    return NextResponse.json({ error: "Klarte ikke hente mengder", detail: String(err) }, { status: 500 });
  }
}
