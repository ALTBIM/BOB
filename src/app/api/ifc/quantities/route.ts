import { NextResponse } from "next/server";
import * as WebIFC from "web-ifc";
import path from "path";
import { getQuantitySummary } from "@/lib/ifc-index";

export const runtime = "nodejs";

const MAX_SIZE_MB = 200;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";
  const modelId = url.searchParams.get("modelId") || "";
  const groupBy = (url.searchParams.get("groupBy") || "type") as "type" | "storey" | "space";
  const filterType = url.searchParams.get("filterType") || undefined;
  const filterName = url.searchParams.get("sum") || undefined;
  const fieldsParam = url.searchParams.get("fields") || "AREA,LENGTH,VOLUME";
  const fields = fieldsParam
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean) as ("AREA" | "LENGTH" | "VOLUME" | "COUNT" | "WEIGHT")[];

  if (!projectId || !modelId) {
    return NextResponse.json({ error: "projectId og modelId er p\u00e5krevd" }, { status: 400 });
  }

  try {
    const rows = await getQuantitySummary({ projectId, modelId, groupBy, fields, filterType, filterName });
    return NextResponse.json({ ok: true, rows });
  } catch (err: any) {
    console.error("Quantities summary error", err);
    return NextResponse.json({ error: "Kunne ikke hente mengder", detail: String(err) }, { status: 500 });
  }
}
// Minimal type list to report counts
const TYPES = [
  "IFCPROJECT",
  "IFCSITE",
  "IFCBUILDING",
  "IFCBUILDINGSTOREY",
  "IFCSPACE",
  "IFCWALLSTANDARDCASE",
  "IFCWALL",
  "IFCSLAB",
  "IFCROOF",
  "IFCBEAM",
  "IFCCOLUMN",
  "IFCCOVERING",
  "IFCRAILING",
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

    // Map element expressID -> type name for quick lookup
    const elementTypeById = new Map<number, string>();
    const areas: Record<string, number> = {};
    const lengths: Record<string, number> = {};
    const volumes: Record<string, number> = {};
    TYPES.forEach((t) => {
      areas[t] = 0;
      lengths[t] = 0;
      volumes[t] = 0;
    });

    for (const t of TYPES) {
      const code = typeCodes[t];
      if (!code) continue;
      const ids = api.GetLineIDsWithType(modelID, code);
      if (ids) {
        for (let i = 0; i < ids.size(); i++) {
          const id = ids.get(i);
          elementTypeById.set(id, t);
        }
      }
    }

    const numVal = (v: any) => {
      if (v === undefined || v === null) return null;
      if (typeof v === "number") return v;
      if (typeof v === "object" && "value" in v) return Number((v as any).value);
      return Number(v) || null;
    };

    const relCode = typeCodes["IFCRELDEFINESBYPROPERTIES"];
    if (relCode) {
      const relIds = api.GetLineIDsWithType(modelID, relCode);
      if (relIds) {
        for (let i = 0; i < relIds.size(); i++) {
          const relId = relIds.get(i);
          const rel = api.GetLine(modelID, relId);
          const propDefId = (rel as any)?.RelatingPropertyDefinition?.value ?? (rel as any)?.RelatingPropertyDefinition;
          if (!propDefId) continue;
          const propDef = api.GetLine(modelID, propDefId);
          if (!propDef || (propDef as any)?.type !== typeCodes["IFCELEMENTQUANTITY"]) continue;

          const quantities = (propDef as any)?.Quantities || [];
          const quantityIds = Array.isArray(quantities)
            ? quantities.map((q: any) => q?.value ?? q).filter(Boolean)
            : [];

          const related = (rel as any)?.RelatedObjects || [];
          for (const objRef of related) {
            const objId = objRef?.value ?? objRef;
            const typeName = elementTypeById.get(objId);
            if (!typeName) continue;
            for (const qId of quantityIds) {
              const qLine = api.GetLine(modelID, qId);
              if (!qLine) continue;
              const areaVal = numVal((qLine as any).AreaValue);
              const lengthVal = numVal((qLine as any).LengthValue);
              const volVal = numVal((qLine as any).VolumeValue);
              if (areaVal) areas[typeName] = (areas[typeName] || 0) + areaVal;
              if (lengthVal) lengths[typeName] = (lengths[typeName] || 0) + lengthVal;
              if (volVal) volumes[typeName] = (volumes[typeName] || 0) + volVal;
            }
          }
        }
      }
    }

    api.CloseModel(modelID);

    return NextResponse.json({
      ok: true,
      counts,
      areas,
      lengths,
      volumes,
    });
  } catch (err: any) {
    console.error("Quantities error", err);
    return NextResponse.json({ error: "Klarte ikke hente mengder", detail: String(err) }, { status: 500 });
  }
}

