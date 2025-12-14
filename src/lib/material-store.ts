type MaterialMap = Record<string, string[]>;

const materialsByModel: MaterialMap = {
  "project-1:model-1": ["betong", "stål", "tre", "gips"],
  "project-1:model-2": ["stål", "betong", "glass"],
  "project-2:model-3": ["betong", "aluminium", "glass", "gips"],
  "project-3:model-4": ["tre", "betong", "gips"],
};

export const recordModelMaterials = (projectId: string, modelId: string, materials: string[]) => {
  const key = `${projectId}:${modelId}`;
  const unique = Array.from(new Set(materials.map((m) => m.toLowerCase())));
  materialsByModel[key] = unique;
};

export const getAvailableMaterialsForModel = (projectId: string, modelId: string): string[] => {
  const key = `${projectId}:${modelId}`;
  return materialsByModel[key] ? [...materialsByModel[key]] : [];
};
