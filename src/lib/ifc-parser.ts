export type IFCParsedData = {
  materials: string[];
  objectCount: number;
  spaceCount: number;
  warnings: string[];
};

const WASM_CDN = "https://cdn.jsdelivr.net/npm/web-ifc@0.0.74/wasm/";

async function textFallback(file: File): Promise<IFCParsedData> {
  const text = await file.text();
  const materialMatches: string[] = [];
  const regexes = [
    /IFCMATERIAL\(['"]?([^'")]+)['"]?\)/gi,
    /IFCMATERIALLAYER\(['"]?([^'")]+)['"]?\)/gi,
    /IFCMATERIALLIST\(([^)]+)\)/gi,
  ];

  regexes.forEach((re) => {
    let m: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(text))) {
      const raw = m[1] ?? "";
      raw
        .split(/['",]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((token) => materialMatches.push(token.toLowerCase()));
    }
  });

  const uniqueMaterials = Array.from(new Set(materialMatches)).filter(Boolean);
  const objectCount = (text.match(/^#/gm) || []).length;
  return { materials: uniqueMaterials, objectCount, spaceCount: 0, warnings: ["Fallback: tekstparsing"] };
}

export async function parseIfcFile(file: File): Promise<IFCParsedData> {
  if (typeof window === "undefined") {
    return { materials: [], objectCount: 0, spaceCount: 0, warnings: ["Kan ikke parse IFC på server"] };
  }

  try {
    const ifc = await import("web-ifc");
    const api = new ifc.IFCAPI();
    // Sett wasm-path til CDN (kan byttes til lokal hosting senere)
    api.SetWasmPath(WASM_CDN);
    await api.Init();

    const buffer = new Uint8Array(await file.arrayBuffer());
    const modelId = api.OpenModel(buffer);

    const materials: string[] = [];
    const materialTypes = [
      (ifc as any).IFCMATERIAL,
      (ifc as any).IFCMATERIALLAYER,
      (ifc as any).IFCMATERIALLIST,
    ];

    materialTypes.forEach((type) => {
      try {
        const ids: number[] = api.GetAllItemsOfType(modelId, type, true) || [];
        ids.forEach((id) => {
          const line: any = api.GetLine(modelId, id);
          const name = line?.Name?.value || line?.Name || "";
          if (typeof name === "string" && name.trim()) {
            materials.push(name.toLowerCase());
          }
        });
      } catch {
        // ignore per-type errors
      }
    });

    const objectIds: number[] = api.GetAllItemsOfType(modelId, (ifc as any).IFCPRODUCT, true) || [];
    const spaceIds: number[] = api.GetAllItemsOfType(modelId, (ifc as any).IFCSPACE, true) || [];

    api.CloseModel(modelId);

    const uniqueMaterials = Array.from(new Set(materials)).filter(Boolean);
    return {
      materials: uniqueMaterials,
      objectCount: objectIds.length,
      spaceCount: spaceIds.length,
      warnings: uniqueMaterials.length === 0 ? ["Ingen materialer funnet, sjekk IFC-innhold"] : [],
    };
  } catch (err) {
    console.error("web-ifc parsing failed, falling back to text", err);
    return textFallback(file);
  }
}
