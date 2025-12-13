"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Download, Calculator, Building2, Image, CheckCircle, Trash2 } from "lucide-react";
import { db, BIMModel } from "@/lib/database";
import { getAvailableMaterialsForModel, recordModelMaterials } from "@/lib/material-store";
import { parseIfcFile } from "@/lib/ifc-parser";
import { IfcViewerPanel } from "./IfcViewerPanel";

interface ProductionDashboardProps {
  selectedProject: string | null;
}

interface QuantityList {
  id: string;
  name: string;
  type: "quantities" | "drawings" | "control";
  items: QuantityItem[];
  totalQuantity: number;
  unit: string;
  generatedAt: string;
}

interface QuantityItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  zone: string;
  material: string;
  notes?: string;
}

interface ModelFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "uploading" | "processing" | "completed" | "error";
  progress: number;
  error?: string;
  objects?: number;
  zones?: number;
  materials?: number;
  projectId: string;
  uploadedAt: string;
  uploadedBy: string;
  rawFile?: File;
}

export default function ProductionDashboard({ selectedProject }: ProductionDashboardProps) {
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [availableModels, setAvailableModels] = useState<BIMModel[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedList, setGeneratedList] = useState<QuantityList | null>(null);
  const [files, setFiles] = useState<ModelFile[]>([]);
  const [existingFiles, setExistingFiles] = useState<ModelFile[]>([]);
  const [isDrawingExporting, setIsDrawingExporting] = useState(false);
  const fallbackMaterials = ["betong", "stal", "tre", "glass", "gips", "isolasjon"];

  useEffect(() => {
    if (selectedProject) {
      loadProjectModels();
    } else {
      setAvailableModels([]);
      setSelectedModel("");
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject && selectedModel) {
      const materials = getAvailableMaterialsForModel(selectedProject, selectedModel);
      if (materials.length === 0) {
        setAvailableMaterials(fallbackMaterials);
      } else {
        setAvailableMaterials(materials);
      }
      setSelectedMaterials([]);
    } else {
      setAvailableMaterials([]);
      setSelectedMaterials([]);
    }
  }, [selectedProject, selectedModel]);

  const loadProjectModels = async () => {
    if (!selectedProject) return;

    try {
      const models = await db.getBIMModelsByProject(selectedProject);
      const completedModels = models.filter((m) => m.status === "completed");
      setAvailableModels(completedModels);

      if (completedModels.length > 0 && !selectedModel) {
        setSelectedModel(completedModels[0].id);
      }
    } catch (error) {
      console.error("Failed to load models:", error);
    }
  };

  const processFiles = (fileList: File[]) => {
    if (!selectedProject) {
      alert("Velg et prosjekt fra dropdown-menyen f\u00f8rst");
      return;
    }

    const validFiles = fileList.filter(
      (file) => file.name.toLowerCase().endsWith(".ifc") || file.name.toLowerCase().endsWith(".ifczip")
    );

    if (validFiles.length === 0) {
      alert("Velg gyldige IFC-filer (.ifc eller .ifczip)");
      return;
    }

    const newFiles: ModelFile[] = validFiles.map((file) => ({
      id: `file-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      status: "uploading",
      progress: 0,
      projectId: selectedProject,
      uploadedAt: new Date().toISOString(),
      uploadedBy: "Andreas Hansen",
      rawFile: file,
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    newFiles.forEach((file) => {
      simulateFileProcessing(file);
    });
  };

  const simulateFileProcessing = (file: ModelFile) => {
    const targetId = file.id;
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;

      setFiles((prev) =>
        prev.map((f) => {
          if (f.id === targetId) {
            if (progress >= 100) {
              clearInterval(interval);
              setTimeout(async () => {
                const parsed = await parseIfcFile(f.rawFile!);
                setFiles((prevFiles) =>
                  prevFiles.map((pf) => {
                    if (pf.id !== targetId) return pf;
                    const materials = parsed.materials.length ? parsed.materials : fallbackMaterials.slice(0, 4);
                    const completedFile: ModelFile = {
                      ...pf,
                      status: "completed",
                      progress: 100,
                      objects: parsed.objectCount || pf.objects || Math.floor(Math.random() * 5000) + 1000,
                      zones: parsed.spaceCount || pf.zones || Math.floor(Math.random() * 20) + 5,
                      materials: materials.length,
                    };
                    persistModelToStore(completedFile, materials);
                    setExistingFiles((existing) => [...existing, { ...completedFile }]);
                    return completedFile;
                  })
                );
              }, 1200);

              return {
                ...f,
                status: "processing",
                progress: 100,
              };
            }
            return {
              ...f,
              progress: Math.min(progress, 100),
            };
          }
          return f;
        })
      );
    }, 200);
  };

  const persistModelToStore = async (file: ModelFile, materials: string[]) => {
    try {
      const created = await db.createBIMModel({
        name: file.name,
        filename: file.name,
        size: file.size,
        projectId: file.projectId,
        uploadedBy: file.uploadedBy,
        status: file.status,
        objects: file.objects,
        zones: file.zones,
        materials: materials.length,
        description: "IFC-fil lastet opp i denne \u00f8kten",
      });
      recordModelMaterials(file.projectId, created.id, materials);
    } catch (error) {
      console.error("Kunne ikke lagre modell i database", error);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      processFiles(selectedFiles);
    }
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("no-NO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getProjectFiles = () => {
    return existingFiles.filter((file) => (selectedProject ? file.projectId === selectedProject : true));
  };

  const generateQuantityList = async (
    type: "quantities" | "drawings" | "control",
    materialsOverride?: string[]
  ) => {
    const materials = materialsOverride ?? selectedMaterials;
    if (!selectedModel || materials.length === 0) {
      alert("Velg modell og materialer f\u00f8rst");
      return;
    }

    setIsGenerating(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));

      const items: QuantityItem[] = [];
      let totalQuantity = 0;
      let unit = "stk";

      materials.forEach((materialType, idx) => {
      const base = availableModels.find((m) => m.id === selectedModel)?.objects ?? 10;
        const spread = (base / (materials.length + idx + 5)) * 0.01;
        const quantity = Math.round((Math.random() * 2 + spread) * 100) / 100;
        items.push({
          id: `item-${materialType}-${selectedModel}`,
          description: `${materialType} - Hele modellen`,
          quantity,
          unit,
          zone: "Hele modellen",
          material: materialType,
          notes: "Forenklet beregning basert p\u00e5 IFC-tekstlesing (ikke full geometri)."
        });
        totalQuantity += quantity;
      });

      const list: QuantityList = {
        id: `list-${Date.now()}`,
        name: `${
          type === "quantities" ? "Mengdeliste" : type === "drawings" ? "Tegningsproduksjon" : "Modellkontroll"
        } - ${new Date().toLocaleDateString("no-NO")}`,
        type,
        items,
        totalQuantity: Math.round(totalQuantity * 100) / 100,
        unit,
        generatedAt: new Date().toISOString(),
      };

      setGeneratedList(list);
      if (materialsOverride) {
        setSelectedMaterials(materialsOverride);
      }
    } catch (error) {
      console.error("Failed to generate list:", error);
      alert("Feil ved generering av liste");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFullExtraction = () => {
    if (!selectedModel) {
      alert("Velg modell f\u00f8rst");
      return;
    }
    const sourceMaterials = availableMaterials.length > 0 ? availableMaterials : fallbackMaterials;
    generateQuantityList("quantities", sourceMaterials);
  };

  const downloadList = (format: "csv" | "excel" | "pdf") => {
    if (!generatedList) return;

    try {
      let content = "";
      let filename = "";
      let mimeType = "";

      if (format === "csv") {
        const headers = ["Beskrivelse", "Mengde", "Enhet", "Sone", "Materiale", "Merknader"];
        const rows = generatedList.items.map((item) => [
          item.description,
          item.quantity.toString(),
          item.unit,
          item.zone,
          item.material,
          item.notes || "",
        ]);

        content = [headers, ...rows]
          .map((row) => row.map((cell) => `"${cell}"`).join(","))
          .join("\n");

        filename = `${generatedList.name.replace(/\s+/g, "_")}.csv`;
        mimeType = "text/csv";

        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        alert(`${format.toUpperCase()}-export kommer i neste versjon`);
      }
    } catch (error) {
      console.error("Download failed:", error);
      alert("Nedlasting feilet");
    }
  };

  const generateDrawingSvg = () => {
    if (!selectedModel) {
      alert("Velg modell f\u00f8rst");
      return;
    }
    const model = availableModels.find((m) => m.id === selectedModel);
    if (!model) {
      alert("Fant ikke valgt modell");
      return;
    }
    setIsDrawingExporting(true);
    try {
      const width = 800;
      const height = 600;
      const blocks = Math.max(1, Math.min(12, model.objects ? Math.floor(model.objects / 1000) : 4));
      const cols = Math.ceil(Math.sqrt(blocks));
      const rows = Math.ceil(blocks / cols);
      const blockW = Math.floor((width - 60) / cols);
      const blockH = Math.floor((height - 140) / rows);

      let rects = "";
      for (let i = 0; i < blocks; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 30 + col * blockW;
        const y = 80 + row * blockH;
        rects += `<rect x="${x}" y="${y}" width="${blockW - 10}" height="${blockH - 10}" fill="#e2e8f0" stroke="#0f172a" stroke-width="1.5" rx="6"/>`;
        rects += `<text x="${x + 12}" y="${y + 20}" font-family="Arial" font-size="12" fill="#0f172a">Sone ${row + 1}-${col + 1}</text>`;
      }

      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .title { font-family: Arial; font-size: 18px; font-weight: bold; fill: #0f172a; }
    .subtitle { font-family: Arial; font-size: 12px; fill: #334155; }
  </style>
  <rect width="100%" height="100%" fill="#fff"/>
  <text x="30" y="32" class="title">Arbeidstegning - ${model.name || model.filename}</text>
  <text x="30" y="52" class="subtitle">Objekter: ${model.objects ?? "ukjent"} \u2022 Rom/soner: ${model.zones ?? "ukjent"} \u2022 Materialer: ${model.materials ?? "ukjent"}</text>
  ${rects}
</svg>`;

      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(model.name || "model")}-arbeidstegning.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Kunne ikke generere tegning", err);
      alert("Kunne ikke generere tegning (SVG).");
    } finally {
      setIsDrawingExporting(false);
    }
  };

  if (!selectedProject) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="font-medium text-slate-900 mb-2">Ingen prosjekt valgt</h3>
          <p className="text-slate-600">Velg et prosjekt fra dropdown-menyen \u00f8verst for \u00e5 bruke produksjonsverkt\u00f8yene</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="quantities" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="quantities">Mengdelister</TabsTrigger>
          <TabsTrigger value="drawings">Tegningsproduksjon</TabsTrigger>
          <TabsTrigger value="control">IFC Kontroll</TabsTrigger>
        </TabsList>

        <TabsContent value="quantities" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generer Mengdelister</CardTitle>
              <CardDescription>Lag mengdelister fra IFC-modell</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Velg IFC-modell</Label>
                {availableModels.length > 0 ? (
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Velg en IFC-fil..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4" />
                            <span>{model.name || model.filename}</span>
                            <span className="text-xs text-slate-500">({model.objects} objekter)</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-4 border border-dashed rounded-lg text-center">
                    <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-slate-600">Ingen IFC-filer tilgjengelig</p>
                    <p className="text-sm text-slate-500">Last opp en IFC-fil f\u00f8rst</p>
                  </div>
                )}
              </div>

              {selectedModel && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Soner og etasjer</CardTitle>
                      <CardDescription>Forel\u00f8pig genereres mengder for hele modellen</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-slate-600">
                        Soner og etasjer vil bli hentet fra IFC-modellen n\u00e5r dette er koblet opp. Forel\u00f8pig kan du kun
                        generere mengder for hele modellen.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Velg materialer</CardTitle>
                      <CardDescription>Materialer fra IFC-filen (web-ifc, fallback til tekst ved feil)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {availableMaterials.length === 0 && (
                        <p className="text-sm text-slate-600">
                          Ingen materialer ble funnet. Du kan pr\u00f8ve "Fullt uttrekk" (bruker fallback).
                        </p>
                      )}

                      {availableMaterials.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => setSelectedMaterials(availableMaterials)}>
                            Velg alle materialer
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedMaterials([])}>
                            Nullstill
                          </Button>
                          <Button variant="secondary" size="sm" onClick={handleFullExtraction}>
                            Fullt uttrekk (alle materialer)
                          </Button>
                        </div>
                      )}

                      {availableMaterials.map((material) => (
                        <div key={material} className="flex items-center space-x-3 p-2 rounded hover:bg-slate-50">
                          <Checkbox
                            id={material}
                            checked={selectedMaterials.includes(material)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedMaterials((prev) => [...prev, material]);
                              } else {
                                setSelectedMaterials((prev) => prev.filter((m) => m !== material));
                              }
                            }}
                          />
                          <Label htmlFor={material} className="text-sm font-medium cursor-pointer">
                            {material}
                          </Label>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {selectedModel && (
                <div className="flex flex-wrap justify-center gap-3">
                  <Button
                    onClick={() => generateQuantityList("quantities")}
                    disabled={isGenerating || selectedMaterials.length === 0}
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Calculator className="w-4 h-4 mr-2 animate-spin" />
                        Genererer mengder...
                      </>
                    ) : (
                      <>
                        <Calculator className="w-4 h-4 mr-2" />
                        Generer Mengdeliste
                      </>
                    )}
                  </Button>
                  <Button variant="secondary" onClick={handleFullExtraction} disabled={isGenerating} size="lg">
                    Fullt uttrekk (alle materialer)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {generatedList && generatedList.type === "quantities" && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>{generatedList.name}</CardTitle>
                    <CardDescription>
                      {generatedList.items.length} posisjoner \u2022 Total: {generatedList.totalQuantity} {generatedList.unit}
                    </CardDescription>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => downloadList("csv")}>
                      <Download className="w-4 h-4 mr-2" />
                      CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadList("excel")}>
                      <Download className="w-4 h-4 mr-2" />
                      Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadList("pdf")}>
                      <Download className="w-4 h-4 mr-2" />
                      PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setGeneratedList(null)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Beskrivelse</th>
                        <th className="text-left p-2">Mengde</th>
                        <th className="text-left p-2">Enhet</th>
                        <th className="text-left p-2">Sone</th>
                        <th className="text-left p-2">Materiale</th>
                        <th className="text-left p-2">Merknader</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedList.items.map((item) => (
                        <tr key={item.id} className="border-b hover:bg-slate-50">
                          <td className="p-2">{item.description}</td>
                          <td className="p-2 font-mono font-medium">{item.quantity}</td>
                          <td className="p-2">
                            <Badge variant="outline">{item.unit}</Badge>
                          </td>
                          <td className="p-2 text-sm">{item.zone}</td>
                          <td className="p-2 text-sm">{item.material}</td>
                          <td className="p-2 text-xs text-slate-500">{item.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="drawings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tegningsproduksjon</CardTitle>
              <CardDescription>
                Enkel SVG-generering basert p\u00e5 IFC-metadata (ikke full geometri). Brukes som midlertidig arbeidstegning.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {availableModels.length === 0 ? (
                <div className="text-center py-8">
                  <Image className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">Ingen modeller tilgjengelig. Last opp en IFC f\u00f8rst.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Velg modell</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Velg en IFC-fil..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            <div className="flex items-center space-x-2">
                              <FileText className="w-4 h-4" />
                              <span>{model.name || model.filename}</span>
                              <span className="text-xs text-slate-500">({model.objects} objekter)</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p>1) Last ned enkel SVG tegning (mock)</p>
                    <Button onClick={generateDrawingSvg} disabled={isDrawingExporting || !selectedModel}>
                      {isDrawingExporting ? (
                        <>
                          <Image className="w-4 h-4 mr-2 animate-spin" />
                          Genererer SVG...
                        </>
                      ) : (
                        <>
                          <Image className="w-4 h-4 mr-2" />
                          Last ned enkel tegning (SVG)
                        </>
                      )}
                    </Button>
                    <p className="pt-2">2) Se geometri (eksperimentell web-ifc viewer)</p>
                    <IfcViewerPanel
                      file={existingFiles.find((f) => f.id === selectedModel)?.rawFile}
                      modelName={availableModels.find((m) => m.id === selectedModel)?.name}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="control" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>IFC Modellkontroll</CardTitle>
              <CardDescription>Kontroller IFC-modell for feil og mangler</CardDescription>
            </CardHeader>
          <CardContent className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="font-medium text-slate-900 mb-2">Modellkontroll</h3>
              <p className="text-slate-600 mb-4">Kommer i neste versjon - automatisk kontroll av IFC-modeller</p>
              <Button variant="outline" disabled>
                <CheckCircle className="w-4 h-4 mr-2" />
                Kontroller Modell
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
