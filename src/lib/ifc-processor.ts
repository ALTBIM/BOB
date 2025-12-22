import * as WebIFC from "web-ifc";
import path from "path";
import { saveIfcIndex, type IfcObjectRow, type IfcPsetRow, type IfcQuantityRow } from "./ifc-index";

type ProcessResult = {
  objects: number;
  quantities: number;
  psets: number;
};

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

const getUnitText = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "Name" in value) return getTextValue((value as any).Name);
  if (typeof value === "object" && "UnitType" in value) return getTextValue((value as any).UnitType);
  return null;
};

const getQuantityType = (quantityLine: any): IfcQuantityRow["quantityType"] => {
  if (!quantityLine) return "OTHER";
  if ("AreaValue" in quantityLine) return "AREA";
  if ("LengthValue" in quantityLine) return "LENGTH";
  if ("VolumeValue" in quantityLine) return "VOLUME";
  if ("CountValue" in quantityLine) return "COUNT";
  if ("WeightValue" in quantityLine) return "WEIGHT";
  return "OTHER";
};

export async function processIfcBuffer(params: {
  buffer: Uint8Array;
  modelId: string;
  projectId: string;
}): Promise<ProcessResult> {
  const { buffer, modelId, projectId } = params;
  const api = new WebIFC.IfcAPI();
  const wasmDir = path.join(process.cwd(), "node_modules", "web-ifc", "wasm");
  api.SetWasmPath(wasmDir + path.sep);
  await api.Init();
  const model = api.OpenModel(buffer);

  const storeyNameById = new Map<number, string>();
  const spaceNameById = new Map<number, string>();
  const storeyByElement = new Map<number, string>();
  const spaceByElement = new Map<number, string>();

  const storeyIds = api.GetLineIDsWithType(model, (WebIFC as any).IFCBUILDINGSTOREY, true);
  if (storeyIds) {
    for (let i = 0; i < storeyIds.size(); i += 1) {
      const id = storeyIds.get(i);
      const line = api.GetLine(model, id);
      const name = getTextValue((line as any)?.Name);
      if (name) storeyNameById.set(id, name);
    }
  }

  const spaceIds = api.GetLineIDsWithType(model, (WebIFC as any).IFCSPACE, true);
  if (spaceIds) {
    for (let i = 0; i < spaceIds.size(); i += 1) {
      const id = spaceIds.get(i);
      const line = api.GetLine(model, id);
      const name = getTextValue((line as any)?.Name);
      if (name) spaceNameById.set(id, name);
    }
  }

  const relContained = api.GetLineIDsWithType(model, (WebIFC as any).IFCRELCONTAINEDINSPATIALSTRUCTURE, true);
  if (relContained) {
    for (let i = 0; i < relContained.size(); i += 1) {
      const relId = relContained.get(i);
      const relLine = api.GetLine(model, relId);
      const relatingStructure = getRefId((relLine as any)?.RelatingStructure);
      if (!relatingStructure) continue;
      const storeyName = storeyNameById.get(relatingStructure) || null;
      const spaceName = spaceNameById.get(relatingStructure) || null;
      const related = toArray((relLine as any)?.RelatedElements).map(getRefId).filter(Boolean) as number[];
      related.forEach((elementId) => {
        if (storeyName) storeyByElement.set(elementId, storeyName);
        if (spaceName) spaceByElement.set(elementId, spaceName);
      });
    }
  }

  const objects: IfcObjectRow[] = [];
  const elementIds = api.GetLineIDsWithType(model, (WebIFC as any).IFCELEMENT, true);
  if (elementIds) {
    for (let i = 0; i < elementIds.size(); i += 1) {
      const id = elementIds.get(i);
      const line = api.GetLine(model, id);
      const globalId = getTextValue((line as any)?.GlobalId);
      if (!globalId) continue;
      const ifcType = api.GetNameFromTypeCode(api.GetLineType(model, id));
      const name = getTextValue((line as any)?.Name) || getTextValue((line as any)?.ObjectType) || null;
      objects.push({
        modelId,
        projectId,
        globalId,
        expressId: id,
        ifcType,
        name,
        storey: storeyByElement.get(id) || null,
        space: spaceByElement.get(id) || null,
      });
    }
  }

  const psets: IfcPsetRow[] = [];
  const quantities: IfcQuantityRow[] = [];
  const relProps = api.GetLineIDsWithType(model, (WebIFC as any).IFCRELDEFINESBYPROPERTIES, true);
  if (relProps) {
    for (let i = 0; i < relProps.size(); i += 1) {
      const relId = relProps.get(i);
      const relLine = api.GetLine(model, relId);
      const propDefId = getRefId((relLine as any)?.RelatingPropertyDefinition);
      if (!propDefId) continue;
      const propDef = api.GetLine(model, propDefId);
      const propType = api.GetNameFromTypeCode(api.GetLineType(model, propDefId));
      const related = toArray((relLine as any)?.RelatedObjects).map(getRefId).filter(Boolean) as number[];
      if (related.length === 0) continue;

      if (propType === "IFCELEMENTQUANTITY") {
        const qtoName = getTextValue((propDef as any)?.Name) || null;
        const qList = toArray((propDef as any)?.Quantities).map(getRefId).filter(Boolean) as number[];
        qList.forEach((qId) => {
          const qLine = api.GetLine(model, qId);
          if (!qLine) return;
          const qName = getTextValue((qLine as any)?.Name) || "Quantity";
          const quantityType = getQuantityType(qLine);
          const value =
            getNumberValue((qLine as any)?.AreaValue) ??
            getNumberValue((qLine as any)?.LengthValue) ??
            getNumberValue((qLine as any)?.VolumeValue) ??
            getNumberValue((qLine as any)?.CountValue) ??
            getNumberValue((qLine as any)?.WeightValue);
          if (value === null) return;
          const unit = getUnitText((qLine as any)?.Unit);
          related.forEach((elementId) => {
            const elementLine = api.GetLine(model, elementId);
            const globalId = getTextValue((elementLine as any)?.GlobalId);
            if (!globalId) return;
            quantities.push({
              modelId,
              projectId,
              globalId,
              qtoSet: qtoName,
              name: qName,
              value,
              unit,
              source: "ifc_qto",
              method: "rel-defines",
              quantityType,
            });
          });
        });
      }

      if (propType === "IFCPROPERTYSET") {
        const psetName = getTextValue((propDef as any)?.Name);
        const props = toArray((propDef as any)?.HasProperties).map(getRefId).filter(Boolean) as number[];
        props.forEach((propId) => {
          const propLine = api.GetLine(model, propId);
          const propName = getTextValue((propLine as any)?.Name);
          const valueText = getTextValue((propLine as any)?.NominalValue);
          const unitText = getUnitText((propLine as any)?.Unit);
          related.forEach((elementId) => {
            const elementLine = api.GetLine(model, elementId);
            const globalId = getTextValue((elementLine as any)?.GlobalId);
            if (!globalId) return;
            psets.push({
              modelId,
              projectId,
              globalId,
              psetName,
              propName,
              value: valueText || null,
              unit: unitText,
            });

            if (psetName === "Pset_QuantityTakeOff") {
              const numeric = getNumberValue((propLine as any)?.NominalValue);
              if (numeric !== null) {
                const lower = propName.toLowerCase();
                let quantityType: IfcQuantityRow["quantityType"] = "OTHER";
                if (lower.includes("area")) quantityType = "AREA";
                if (lower.includes("length")) quantityType = "LENGTH";
                if (lower.includes("volume")) quantityType = "VOLUME";
                if (lower.includes("count")) quantityType = "COUNT";
                quantities.push({
                  modelId,
                  projectId,
                  globalId,
                  qtoSet: psetName,
                  name: propName,
                  value: numeric,
                  unit: unitText,
                  source: "pset_qto",
                  method: "pset-quantity",
                  quantityType,
                });
              }
            }
          });
        });
      }
    }
  }

  await saveIfcIndex(modelId, projectId, { objects, psets, quantities });

  api.CloseModel(model);

  return {
    objects: objects.length,
    quantities: quantities.length,
    psets: psets.length,
  };
}
