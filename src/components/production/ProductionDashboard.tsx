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
import { getAvailableMaterialsForModel } from "@/lib/material-store";

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

export default function ProductionDashboard({ selectedProject }: ProductionDashboardProps) {
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [availableModels, setAvailableModels] = useState<BIMModel[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedList, setGeneratedList] = useState<QuantityList | null>(null);
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
        // Midlertidig fallback til mock-materialer når IFC-parsing ikke finnes
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

  const generateQuantityList = async (
    type: "quantities" | "drawings" | "control",
    materialsOverride?: string[]
  ) => {
    const materials = materialsOverride ?? selectedMaterials;
    if (!selectedModel || materials.length === 0) {
      alert("Velg modell og materialer først");
      return;
    }

    setIsGenerating(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));

      const items: QuantityItem[] = [];
      let totalQuantity = 0;
      let unit = "stk";

      materials.forEach((materialType, idx) => {
        // Mock-beregning: bruk objekttall som grovt grunnlag hvis tilgjengelig
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
          notes: "Forenklet beregning basert på tilgjengelige materialer (mock, ingen ekte IFC-parsing enda)",
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
      alert("Velg modell først");
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

  if (!selectedProject) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="font-medium text-slate-900 mb-2">Ingen prosjekt valgt</h3>
          <p className="text-slate-600">Velg et prosjekt fra dropdown-menyen øverst for å bruke produksjonsverktøyene</p>
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
                    <p className="text-sm text-slate-500">Last opp en IFC-fil først</p>
                  </div>
                )}
              </div>

              {selectedModel && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Soner og etasjer</CardTitle>
                      <CardDescription>Foreløpig genereres mengder for hele modellen</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-slate-600">
                        Soner og etasjer vil bli hentet fra IFC-modellen når dette er koblet opp. Foreløpig kan du kun
                        generere mengder for hele modellen.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Velg materialer</CardTitle>
                      <CardDescription>Materialer fra valgt IFC-modell (mock til vi parser IFC)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {availableMaterials.length === 0 && (
                        <p className="text-sm text-slate-600">
                          Ingen materialer er tilgjengelige ennå for denne modellen. Bruk “Fullt uttrekk” for mock-data.
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
                  <Button
                    variant="secondary"
                    onClick={handleFullExtraction}
                    disabled={isGenerating}
                    size="lg"
                  >
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
                      {generatedList.items.length} posisjoner • Total: {generatedList.totalQuantity}{" "}
                      {generatedList.unit}
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
              <CardDescription>Generer arbeidstegninger med posisjonsnumre</CardDescription>
            </CardHeader>
            <CardContent className="text-center py-12">
              <Image className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="font-medium text-slate-900 mb-2">Tegningsproduksjon</h3>
              <p className="text-slate-600 mb-4">Kommer i neste versjon - generer arbeidstegninger med posisjonsnumre</p>
              <Button variant="outline" disabled>
                <Image className="w-4 h-4 mr-2" />
                Generer Tegninger
              </Button>
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
