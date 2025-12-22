export type IFCElementSummary = {
  elementType: string;
  typeName: string;
  count: number;
  netArea: number;
  length: number;
  volume: number;
};

export type IFCParsedData = {
  materials: string[];
  objectCount: number;
  spaceCount: number;
  warnings: string[];
  elementSummary: IFCElementSummary[];
};

const WASM_CDN = "https://cdn.jsdelivr.net/npm/web-ifc@0.0.74/wasm/";

const ELEMENT_REGEX = /^#\d+=IFC(WALLSTANDARDCASE|WALL|SLAB|ROOF|BEAM|COLUMN|DOOR|WINDOW|COVERING|FURNISHINGELEMENT|BUILDINGELEMENTPROXY)\b/gm;
const SPACE_REGEX = /^#\d+=IFCSPACE\b/gm;

const toArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const getRefId = (value: any): number | null => {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "value" in value) return Number((value as any).value);
  return Number(value) || null;
};

const getTextValue = (value: any): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "value" in value) return String((value as any).value || "");
  return String(value);
};

const getNumberValue = (value: any): number | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "value" in value) return Number((value as any).value);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const rankQuantityName = (name: string, kind: "area" | "length" | "volume"): number => {
  const key = name.replace(/\s+/g, "").toLowerCase();
  if (!key) return 0;
  if (kind === "area") {
    if (key.includes("netarea")) return 3;
    if (key.includes("grossarea")) return 2;
    if (key.includes("area")) return 1;
  }
  if (kind === "length") {
    if (key.includes("netlength")) return 3;
    if (key.includes("grosslength")) return 2;
    if (key.includes("length")) return 1;
  }
  if (kind === "volume") {
    if (key.includes("netvolume")) return 3;
    if (key.includes("grossvolume")) return 2;
    if (key.includes("volume")) return 1;
  }
  return 0;
};

async function textFallback(file: File): Promise<IFCParsedData> {
  const text = await file.text();
  const materialMatches: string[] = [];
  const regexes = [
    /IFCMATERIAL\(['"]?([^'"\)]+)['"]?\)/gi,
    /IFCMATERIALLAYER\(['"]?([^'"\)]+)['"]?\)/gi,
    /IFCMATERIALLIST\(([^\)]+)\)/gi,
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
  const objectCount = (text.match(ELEMENT_REGEX) || []).length;
  const spaceCount = (text.match(SPACE_REGEX) || []).length;

  return {
    materials: uniqueMaterials,
    objectCount,
    spaceCount,
    warnings: ["Fallback: tekstparsing"],
    elementSummary: [],
  };
}

export async function parseIfcFile(file: File): Promise<IFCParsedData> {
  if (typeof window === "undefined") {
    return {
      materials: [],
      objectCount: 0,
      spaceCount: 0,
      warnings: ["Kan ikke parse IFC p\u00e5 server"],
      elementSummary: [],
    };
  }

  try {
    const ifc = await import("web-ifc");
    const api = new ifc.IFCAPI();
    api.SetWasmPath(WASM_CDN);
    await api.Init();

    const buffer = new Uint8Array(await file.arrayBuffer());
    const modelId = api.OpenModel(buffer);

    const collectIds = (type: number, includeInherited = true): number[] => {
      const ids: number[] = [];
      const vec = api.GetLineIDsWithType(modelId, type, includeInherited);
      if (!vec) return ids;
      for (let i = 0; i < vec.size(); i += 1) {
        ids.push(vec.get(i));
      }
      return ids;
    };

    const materialMap = new Map<string, string>();
    const addMaterialName = (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!materialMap.has(key)) materialMap.set(key, trimmed);
    };

    const collectMaterialRef = (materialRef: any) => {
      const materialId = getRefId(materialRef);
      if (!materialId) return;
      const materialLine: any = api.GetLine(modelId, materialId);
      if (!materialLine) return;
      const typeName = api.GetNameFromTypeCode(api.GetLineType(modelId, materialId));

      switch (typeName) {
        case "IFCMATERIAL": {
          addMaterialName(getTextValue(materialLine?.Name));
          break;
        }
        case "IFCMATERIALLAYER": {
          collectMaterialRef(materialLine?.Material);
          addMaterialName(getTextValue(materialLine?.Name));
          break;
        }
        case "IFCMATERIALLAYERSET": {
          toArray(materialLine?.MaterialLayers).forEach((layer) => collectMaterialRef(layer));
          break;
        }
        case "IFCMATERIALLAYERSETUSAGE": {
          collectMaterialRef(materialLine?.ForLayerSet);
          break;
        }
        case "IFCMATERIALCONSTITUENTSET": {
          toArray(materialLine?.MaterialConstituents).forEach((constituent) => collectMaterialRef(constituent));
          break;
        }
        case "IFCMATERIALCONSTITUENT": {
          collectMaterialRef(materialLine?.Material);
          addMaterialName(getTextValue(materialLine?.Name));
          break;
        }
        case "IFCMATERIALLIST": {
          toArray(materialLine?.Materials).forEach((mat) => collectMaterialRef(mat));
          break;
        }
        case "IFCMATERIALPROFILESET": {
          toArray(materialLine?.MaterialProfiles).forEach((profile) => collectMaterialRef(profile));
          break;
        }
        case "IFCMATERIALPROFILESETUSAGE": {
          collectMaterialRef(materialLine?.ForProfileSet);
          break;
        }
        case "IFCMATERIALPROFILE": {
          collectMaterialRef(materialLine?.Material);
          addMaterialName(getTextValue(materialLine?.Name));
          break;
        }
        default: {
          addMaterialName(getTextValue(materialLine?.Name));
          break;
        }
      }
    };

    const relMatCode = (ifc as any).IFCRELASSOCIATESMATERIAL;
    if (relMatCode) {
      const relMatIds = collectIds(relMatCode, false);
      relMatIds.forEach((relId) => {
        try {
          const relLine: any = api.GetLine(modelId, relId);
          collectMaterialRef(relLine?.RelatingMaterial);
        } catch {
          // ignore relation errors
        }
      });
    }

    if (materialMap.size === 0) {
      const materialTypes = [
        (ifc as any).IFCMATERIAL,
        (ifc as any).IFCMATERIALLAYER,
        (ifc as any).IFCMATERIALLIST,
      ];

      materialTypes.forEach((type) => {
        if (!type) return;
        try {
          const ids = collectIds(type, true);
          ids.forEach((id) => {
            const line: any = api.GetLine(modelId, id);
            addMaterialName(getTextValue(line?.Name));
          });
        } catch {
          // ignore per-type errors
        }
      });
    }

    const elementTypeCode = (ifc as any).IFCELEMENT;
    const objectIds: number[] = elementTypeCode ? collectIds(elementTypeCode, true) : [];
    const spaceIds: number[] = collectIds((ifc as any).IFCSPACE, true);

    const elementTypeById = new Map<number, string>();
    objectIds.forEach((id) => {
      try {
        const typeCode = api.GetLineType(modelId, id);
        const name = api.GetNameFromTypeCode(typeCode);
        if (name) elementTypeById.set(id, name);
      } catch {
        // ignore
      }
    });

    const elementTypeNameById = new Map<number, string>();
    const relTypeCode = (ifc as any).IFCRELDEFINESBYTYPE;
    if (relTypeCode) {
      const relTypeIds = collectIds(relTypeCode, false);
      relTypeIds.forEach((relId) => {
        try {
          const rel = api.GetLine(modelId, relId);
          const relTypeRef = (rel as any)?.RelatingType;
          const typeId = getRefId(relTypeRef);
          if (!typeId) return;
          const typeLine = api.GetLine(modelId, typeId);
          const typeName = getTextValue((typeLine as any)?.Name) || getTextValue((typeLine as any)?.ObjectType);
          if (!typeName) return;
          const related = toArray((rel as any)?.RelatedObjects);
          related.forEach((ref) => {
            const elId = getRefId(ref);
            if (elId) elementTypeNameById.set(elId, typeName);
          });
        } catch {
          // ignore
        }
      });
    }

    const quantitiesByElement = new Map<
      number,
      { area: number; length: number; volume: number; areaRank: number; lengthRank: number; volumeRank: number }
    >();
    const relPropsCode = (ifc as any).IFCRELDEFINESBYPROPERTIES;
    if (relPropsCode) {
      const relPropIds = collectIds(relPropsCode, false);
      relPropIds.forEach((relId) => {
        try {
          const rel = api.GetLine(modelId, relId);
          const propDefRef = (rel as any)?.RelatingPropertyDefinition;
          const propDefId = getRefId(propDefRef);
          if (!propDefId) return;
          const propTypeName = api.GetNameFromTypeCode(api.GetLineType(modelId, propDefId));
          if (propTypeName !== "IFCELEMENTQUANTITY") return;
          const propDef = api.GetLine(modelId, propDefId);
          const quantities = toArray((propDef as any)?.Quantities).map(getRefId).filter(Boolean) as number[];
          if (quantities.length === 0) return;
          const related = toArray((rel as any)?.RelatedObjects).map(getRefId).filter(Boolean) as number[];
          related.forEach((elementId) => {
            const entry =
              quantitiesByElement.get(elementId) || {
                area: 0,
                length: 0,
                volume: 0,
                areaRank: 0,
                lengthRank: 0,
                volumeRank: 0,
              };
            quantities.forEach((qId) => {
              const qLine = api.GetLine(modelId, qId);
              if (!qLine) return;
              const qName = getTextValue((qLine as any)?.Name);

              const areaVal = getNumberValue((qLine as any)?.AreaValue);
              if (areaVal !== null) {
                const rank = rankQuantityName(qName, "area");
                if (rank > entry.areaRank) {
                  entry.area = areaVal;
                  entry.areaRank = rank;
                } else if (rank === entry.areaRank && rank > 0) {
                  entry.area += areaVal;
                }
              }

              const lengthVal = getNumberValue((qLine as any)?.LengthValue);
              if (lengthVal !== null) {
                const rank = rankQuantityName(qName, "length");
                if (rank > entry.lengthRank) {
                  entry.length = lengthVal;
                  entry.lengthRank = rank;
                } else if (rank === entry.lengthRank && rank > 0) {
                  entry.length += lengthVal;
                }
              }

              const volumeVal = getNumberValue((qLine as any)?.VolumeValue);
              if (volumeVal !== null) {
                const rank = rankQuantityName(qName, "volume");
                if (rank > entry.volumeRank) {
                  entry.volume = volumeVal;
                  entry.volumeRank = rank;
                } else if (rank === entry.volumeRank && rank > 0) {
                  entry.volume += volumeVal;
                }
              }
            });
            quantitiesByElement.set(elementId, entry);
          });
        } catch {
          // ignore relation errors
        }
      });
    }

    const summaryMap = new Map<string, IFCElementSummary>();
    objectIds.forEach((elementId) => {
      const elementType = elementTypeById.get(elementId) || "IFCELEMENT";
      const elementLine = api.GetLine(modelId, elementId);
      const typeName =
        elementTypeNameById.get(elementId) ||
        getTextValue((elementLine as any)?.ObjectType) ||
        getTextValue((elementLine as any)?.Name) ||
        "Ukjent type";
      const key = `${elementType}::${typeName}`;
      const entry = summaryMap.get(key) || {
        elementType,
        typeName,
        count: 0,
        netArea: 0,
        length: 0,
        volume: 0,
      };
      entry.count += 1;
      const q = quantitiesByElement.get(elementId);
      if (q) {
        entry.netArea += q.area;
        entry.length += q.length;
        entry.volume += q.volume;
      }
      summaryMap.set(key, entry);
    });

    const elementSummary = Array.from(summaryMap.values()).sort((a, b) => b.count - a.count);

    api.CloseModel(modelId);

    const uniqueMaterials = Array.from(materialMap.values()).filter(Boolean);
    return {
      materials: uniqueMaterials,
      objectCount: objectIds.length,
      spaceCount: spaceIds.length,
      warnings: uniqueMaterials.length === 0 ? ["Ingen materialer funnet, sjekk IFC-innhold"] : [],
      elementSummary,
    };
  } catch (err) {
    console.error("web-ifc parsing failed, falling back to text", err);
    return textFallback(file);
  }
}
