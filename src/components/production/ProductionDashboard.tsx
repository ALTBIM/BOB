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
import { parseIfcFile, IFCElementSummary } from "@/lib/ifc-parser";
import { IfcViewerPanel } from "./IfcViewerPanel";
import { listIfcFiles } from "@/lib/storage";
import { ProjectFiles } from "@/components/files/ProjectFiles";

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
  materialList?: string[];
  fileUrl?: string;
  storageUrl?: string;
  provider?: string;
  path?: string;
  elementSummary?: IFCElementSummary[];
}

type Quantities = {
  counts: Record<string, number>;
  areas: Record<string, number>;
  lengths: Record<string, number>;
  volumes: Record<string, number>;
};

export default function ProductionDashboard({ selectedProject }: ProductionDashboardProps) {
  const [selectedModel, setSelectedModel] = useState<string>("");
  const search = typeof window !== "undefined" ? window.location.search : "";
  const [activeTab, setActiveTab] = useState("quantities");
  const [quantities, setQuantities] = useState<Record<string, Quantities>>({});
  const [availableModels, setAvailableModels] = useState<BIMModel[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedList, setGeneratedList] = useState<QuantityList | null>(null);
  const [files, setFiles] = useState<ModelFile[]>([]);
  const [existingFiles, setExistingFiles] = useState<ModelFile[]>([]);
  const [supabaseFiles, setSupabaseFiles] = useState<ModelFile[]>([]);
  const [elementSummary, setElementSummary] = useState<IFCElementSummary[]>([]);
  const [metadataMaterials, setMetadataMaterials] = useState<string[]>([]);
  const [metadataStatus, setMetadataStatus] = useState<Record<string, "idle" | "loading" | "error">>({});
  const [isDrawingExporting, setIsDrawingExporting] = useState(false);
  const [banner, setBanner] = useState<{ type: "info" | "error"; text: string } | null>(null);
  const [supabaseDiagnostics, setSupabaseDiagnostics] = useState<{
    count: number;
    providers: string[];
    bucket: string;
    lastUpdated: string;
    message?: string;
  } | null>(null);
  const bucketName = process.env.NEXT_PUBLIC_SUPABASE_IFC_BUCKET || "ifc-models";

  useEffect(() => {
    if (selectedProject) {
      loadProjectModels();
    } else {
      setAvailableModels([]);
      setSelectedModel("");
    }
  }, [selectedProject]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(search);
    const tab = params.get("tab");
    if (tab && ["quantities", "drawings", "control", "files"].includes(tab)) {
      setActiveTab(tab);
      return;
    }
    setActiveTab("quantities");
  }, [search]);

  useEffect(() => {
    if (selectedProject && selectedModel) {
      // try metadata first, then local parsed data
      const localFile = existingFiles.find((f) => f.id === selectedModel && f.projectId === selectedProject);
      const materials =
        metadataMaterials.length > 0
          ? metadataMaterials
          : (localFile?.materialList && localFile.materialList.length > 0
              ? localFile.materialList
              : getAvailableMaterialsForModel(selectedProject, selectedModel)) || [];
      setAvailableMaterials(materials);
      setSelectedMaterials([]);
    } else {
      setAvailableMaterials([]);
      setSelectedMaterials([]);
    }
  }, [selectedProject, selectedModel, existingFiles, metadataMaterials]);

  useEffect(() => {
    const loadMetadata = async () => {
      if (!selectedProject || !selectedModel) {
        setElementSummary([]);
        setMetadataMaterials([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/ifc/metadata?projectId=${encodeURIComponent(selectedProject)}&modelId=${encodeURIComponent(
            selectedModel
          )}`
        );
        if (!res.ok) {
          setElementSummary([]);
          setMetadataMaterials([]);
          const file = existingFiles.find((f) => f.id === selectedModel);
          const fileUrl = file?.storageUrl || file?.fileUrl;
          if ((res.status === 404 || res.status === 400) && fileUrl && metadataStatus[selectedModel] !== "loading") {
            setMetadataStatus((prev) => ({ ...prev, [selectedModel]: "loading" }));
            try {
              const fileRes = await fetch(fileUrl);
              if (!fileRes.ok) throw new Error(`Kunne ikke hente IFC (${fileRes.status})`);
              const blob = await fileRes.blob();
              const fileName = file?.name || "model.ifc";
              const parsedFile = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
              const parsed = await parseIfcFile(parsedFile);
              await fetch("/api/ifc/metadata", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  projectId: selectedProject,
                  modelId: selectedModel,
                  name: fileName,
                  materials: parsed.materials || [],
                  objects: parsed.objectCount ?? 0,
                  zones: parsed.spaceCount ?? 0,
                  elementSummary: parsed.elementSummary || [],
                }),
              });
              setElementSummary(parsed.elementSummary || []);
              setMetadataMaterials(parsed.materials || []);
              setMetadataStatus((prev) => ({ ...prev, [selectedModel]: "idle" }));
            } catch (err) {
              console.warn("Kunne ikke hente IFC-data for metadata", err);
              setMetadataStatus((prev) => ({ ...prev, [selectedModel]: "error" }));
            }
          }
          return;
        }
        const data = await res.json();
        setElementSummary((data?.metadata?.elementSummary as IFCElementSummary[]) || []);
        setMetadataMaterials((data?.metadata?.materials as string[]) || []);
        setMetadataStatus((prev) => ({ ...prev, [selectedModel]: "idle" }));
      } catch (err) {
        console.warn("Kunne ikke hente IFC-metadata", err);
        setElementSummary([]);
        setMetadataMaterials([]);
      }
    };
    loadMetadata();
  }, [selectedProject, selectedModel, existingFiles, metadataStatus]);

  // Fetch real IFC quantities when model changes
  useEffect(() => {
    const fetchQuantities = async () => {
      if (!selectedProject || !selectedModel) return;
      const file = existingFiles.find((f) => f.id === selectedModel);
      if (!file?.storageUrl) return;
      try {
        const res = await fetch("/api/ifc/quantities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileUrl: file.storageUrl }),
        });
        if (!res.ok) {
          console.warn("Quantities fetch feilet", res.status);
          return;
        }
        const data = await res.json();
        if (data?.counts) {
          setQuantities((prev) => ({
            ...prev,
            [selectedModel]: {
              counts: data.counts || {},
              areas: data.areas || {},
              lengths: data.lengths || {},
              volumes: data.volumes || {},
            },
          }));
        }
      } catch (err) {
        console.warn("Quantities fetch feilet", err);
      }
    };
    fetchQuantities();
  }, [selectedProject, selectedModel, existingFiles]);

  const loadProjectModels = async () => {
    if (!selectedProject) return;

    try {
      const stored = await listIfcFiles(selectedProject);
      const storedFiles: ModelFile[] = stored.map((item) => ({
        id: item.path,
        name: item.name,
        size: item.size,
        type: "application/octet-stream",
        status: "completed",
        progress: 100,
        projectId: selectedProject,
        uploadedAt: item.uploadedAt || new Date().toISOString(),
        uploadedBy: "Supabase",
        fileUrl: item.publicUrl,
        storageUrl: item.publicUrl,
      }));
      setExistingFiles(storedFiles);
      setSupabaseFiles(storedFiles);
      setSupabaseDiagnostics({
        count: storedFiles.length,
        providers: Array.from(new Set(storedFiles.map((file) => file.provider || "supabase"))),
        bucket: bucketName,
        lastUpdated: new Date().toISOString(),
        message:
          storedFiles.length === 0
            ? "Ingen lagrede IFC-filer funnet. Last opp en modell for å aktivere viewer og mengdelister."
            : undefined,
      });

      const storageModels: BIMModel[] = stored.map((item) => ({
        id: item.path,
        name: item.name,
        filename: item.name,
        size: item.size,
        projectId: selectedProject,
        uploadedBy: "Supabase",
        uploadedAt: item.uploadedAt || new Date().toISOString(),
        status: "completed",
        version: 1,
        storageUrl: item.publicUrl,
      }));

      setAvailableModels(storageModels);

      if (storageModels.length > 0 && !selectedModel) {
        setSelectedModel(storageModels[0].id);
      }
    } catch (error) {
      console.error("Failed to load models:", error);
      setSupabaseDiagnostics({
        count: 0,
        providers: [],
        bucket: bucketName,
        lastUpdated: new Date().toISOString(),
        message: "Kunne ikke kommunisere med Supabase/Blob. Kontroller env-vars og nettverk.",
      });
    }
  };

  const processFiles = (fileList: File[]) => {
    if (!selectedProject) {
      setBanner({ type: "error", text: "Velg et prosjekt fra dropdown-menyen først." });
      return;
    }

    const validFiles = fileList.filter(
      (file) => file.name.toLowerCase().endsWith(".ifc") || file.name.toLowerCase().endsWith(".ifczip")
    );

    if (validFiles.length === 0) {
      setBanner({ type: "error", text: "Velg gyldige IFC-filer (.ifc eller .ifczip)." });
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
      fileUrl: URL.createObjectURL(file),
      storageUrl: URL.createObjectURL(file),
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
                    const materials = parsed.materials || [];
                    const completedFile: ModelFile = {
                      ...pf,
                      status: "completed",
                      progress: 100,
                      objects: parsed.objectCount ?? pf.objects ?? 0,
                      zones: parsed.spaceCount ?? pf.zones ?? 0,
                      materials: materials.length,
                      materialList: materials,
                      elementSummary: parsed.elementSummary || [],
                      storageUrl: pf.storageUrl || pf.fileUrl,
                    };
                    persistModelToStore(completedFile, materials);
                    // oppdater tilgjengelige materialer i UI
                    if (pf.projectId === selectedProject) {
                      setAvailableMaterials(materials);
                      setSelectedMaterials([]);
                    }
                    setExistingFiles((existing) => [...existing, { ...completedFile }]);
    setSupabaseFiles((existing) => {
      const already = existing.some((entry) => entry.path === completedFile.path || entry.id === completedFile.id);
      if (already) return existing;
      return [
        ...existing,
        {
          id: completedFile.id,
          name: completedFile.name,
          size: completedFile.size,
          type: completedFile.type,
          status: completedFile.status,
          progress: completedFile.progress,
          projectId: completedFile.projectId,
          uploadedAt: completedFile.uploadedAt,
          uploadedBy: completedFile.uploadedBy,
          fileUrl: completedFile.fileUrl,
          storageUrl: completedFile.storageUrl,
          provider: "supabase",
          path: completedFile.storageUrl || completedFile.fileUrl,
        },
      ];
    });
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
        storageUrl: file.storageUrl || file.fileUrl,
        description: "IFC-fil lastet opp i denne økten",
      });
      if (materials.length) {
        recordModelMaterials(file.projectId, created.id, materials);
      }
      // lagre metadata til server/fil for senere visning
      fetch("/api/ifc/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: file.projectId,
          modelId: created.id,
          name: created.name || created.filename,
          materials,
          objects: file.objects,
          zones: file.zones,
          elementSummary: file.elementSummary || [],
        }),
      }).catch((err) => console.error("Kunne ikke lagre IFC-metadata", err));
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

  const formatQuantityNumber = (value?: number) => {
    if (!value || Number.isNaN(value)) return "0";
    return Number(value).toLocaleString("no-NO", { maximumFractionDigits: 2 });
  };

  const getProjectFiles = () => {
    return existingFiles.filter((file) => (selectedProject ? file.projectId === selectedProject : true));
  };

  const metadataState = selectedModel ? metadataStatus[selectedModel] : undefined;

  const generateQuantityList = async (
    type: "quantities" | "drawings" | "control",
    materialsOverride?: string[]
  ) => {
    const materials = materialsOverride ?? selectedMaterials;
    if (!selectedModel) {
      setBanner({ type: "error", text: "Velg modell først." });
      return;
    }
    if (materials.length === 0) {
      setBanner({ type: "error", text: "Ingen materialer funnet i IFC. Last opp en fil med materialdata." });
      return;
    }


    setIsGenerating(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));

      const modelMeta =
        availableModels.find((m) => m.id === selectedModel) ||
        existingFiles.find((f) => f.id === selectedModel);
      const q = quantities[selectedModel]?.counts || {};
      const objects =
        modelMeta?.objects ??
        (q.IFCWALL ?? 0) +
          (q.IFCSLAB ?? 0) +
          (q.IFCBEAM ?? 0) +
          (q.IFCCOLUMN ?? 0) +
          (q.IFCDOOR ?? 0) +
          (q.IFCWINDOW ?? 0) +
          (q.IFCSPACE ?? 0);
      const hasRealData = Boolean(objects) || Object.keys(q).length > 0;
      const unit = "stk";
      const items: QuantityItem[] = [];
      let totalQuantity = 0;

      materials.forEach((materialType) => {
        const base = objects || 1;
        const qty = hasRealData ? Math.max(1, Math.round(base / Math.max(1, materials.length))) : 1;
        items.push({
          id: `item-${materialType}-${selectedModel}`,
          description: `${materialType} - Hele modellen`,
          quantity: qty,
          unit,
          zone: "Hele modellen",
          material: materialType,
          notes: hasRealData ? "Estimert fra IFC-data." : "Forenklet beregning (manglende IFC-data).",
        });
        totalQuantity += qty;
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
        simplified: !hasRealData,
      };

      setGeneratedList(list);
      if (materialsOverride) {
        setSelectedMaterials(materialsOverride);
      }
    } catch (error) {
      console.error("Failed to generate list:", error);
      setBanner({ type: "error", text: "Feil ved generering av liste." });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFullExtraction = () => {
    if (!selectedModel) {
      setBanner({ type: "error", text: "Velg modell først." });
      return;
    }
    if (availableMaterials.length === 0) {
      setBanner({ type: "error", text: "Ingen materialer funnet i IFC." });
      return;
    }
    generateQuantityList("quantities", availableMaterials);
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
        setBanner({ type: "info", text: `${format.toUpperCase()}-eksport kommer i neste versjon.` });
      }
    } catch (error) {
      console.error("Download failed:", error);
      setBanner({ type: "error", text: "Nedlasting feilet." });
    }
  };

  const generateDrawingSvg = () => {
    if (!selectedModel) {
      setBanner({ type: "error", text: "Velg modell først." });
      return;
    }
    const model = availableModels.find((m) => m.id === selectedModel);
    if (!model) {
      setBanner({ type: "error", text: "Fant ikke valgt modell." });
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

      const rectFill = "hsl(var(--muted))";
      const rectStroke = "hsl(var(--border))";
      const titleColor = "hsl(var(--foreground))";
      const subtitleColor = "hsl(var(--muted-foreground))";
      let rects = "";
      for (let i = 0; i < blocks; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 30 + col * blockW;
        const y = 80 + row * blockH;
        rects += `<rect x="${x}" y="${y}" width="${blockW - 10}" height="${blockH - 10}" fill="${rectFill}" stroke="${rectStroke}" stroke-width="1.5" rx="6"/>`;
        rects += `<text x="${x + 12}" y="${y + 20}" font-family="Arial" font-size="12" fill="${titleColor}">Sone ${row + 1}-${col + 1}</text>`;
      }

      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .title { font-family: Arial; font-size: 18px; font-weight: bold; fill: ${titleColor}; }
    .subtitle { font-family: Arial; font-size: 12px; fill: ${subtitleColor}; }
  </style>
  <rect width="100%" height="100%" fill="hsl(var(--background))"/>
  <text x="30" y="32" class="title">Arbeidstegning - ${model.name || model.filename}</text>
  <text x="30" y="52" class="subtitle">Objekter: ${model.objects ?? "ukjent"} • Rom/soner: ${model.zones ?? "ukjent"} • Materialer: ${model.materials ?? "ukjent"}</text>
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
      setBanner({ type: "error", text: "Kunne ikke generere tegning (SVG)." });
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
          <p className="text-slate-600">Velg et prosjekt fra dropdown-menyen øverst for å bruke produksjonsverktøyene</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            banner.type === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-muted text-foreground"
          }`}
        >
          {banner.text}
        </div>
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="quantities">Mengdelister</TabsTrigger>
          <TabsTrigger value="drawings">Tegningsproduksjon</TabsTrigger>
          <TabsTrigger value="control">IFC Kontroll</TabsTrigger>
          <TabsTrigger value="files">Dokumenter</TabsTrigger>
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
                      <CardDescription>Materialer fra IFC-filen (web-ifc, fallback til tekst ved feil)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {availableMaterials.length === 0 && (
                        <p className="text-sm text-slate-600">
  {metadataState === "loading"
    ? "Henter materialer fra lagret IFC-fil..."
    : metadataState === "error"
      ? "Klarte ikke hente materialer fra lagret fil. Pr\u00f8v \u00e5 laste opp p\u00e5 nytt."
      : "Ingen materialer ble funnet. Du kan pr\u00f8ve \"Fullt uttrekk\" (bruker fallback)."}
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

              {selectedModel && elementSummary.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Elementoversikt (IFC)</CardTitle>
                    <CardDescription>Bygningselementer med type, antall, areal, lengde og volum.</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
  <tr className="border-b">
    <th className="text-left p-2">Elementtype</th>
    <th className="text-left p-2">Type</th>
    <th className="text-left p-2">Areal (m2)</th>
    <th className="text-left p-2">Lengde (m)</th>
    <th className="text-left p-2">Volum (m3)</th>
    <th className="text-left p-2">Antall</th>
  </tr>
</thead>
                      <tbody>
                        {elementSummary.map((entry) => (
                          <tr key={`${entry.elementType}-${entry.typeName}`} className="border-b hover:bg-muted/40">
                            <td className="p-2">{entry.elementType}</td>
                            <td className="p-2">{entry.typeName}</td>
                            <td className="p-2 font-mono">{formatQuantityNumber(entry.netArea)}</td>
                            <td className="p-2 font-mono">{formatQuantityNumber(entry.length)}</td>
                            <td className="p-2 font-mono">{formatQuantityNumber(entry.volume)}</td>
                            <td className="p-2 font-mono">{entry.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {selectedModel && elementSummary.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Elementoversikt (IFC)</CardTitle>
                    <CardDescription>Ingen elementoversikt funnet for denne modellen.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600">
  {metadataState === "loading"
    ? "Henter metadata fra lagret IFC-fil..."
    : metadataState === "error"
      ? "Klarte ikke hente metadata fra lagret fil. Pr\u00f8v \u00e5 laste opp p\u00e5 nytt."
      : "Last opp modellen p\u00e5 nytt for \u00e5 lagre elementdata, eller kontroller at filen har Pset_WallCommon og IfcElementQuantity."}
</p>
                  </CardContent>
                </Card>
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
                      {generatedList.items.length} posisjoner • Total: {generatedList.totalQuantity} {generatedList.unit}
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
    <th className="text-left p-2">Type</th>
    <th className="text-left p-2">Antall</th>
    <th className="text-left p-2">Areal (m2)</th>
    <th className="text-left p-2">Lengde (m)</th>
    <th className="text-left p-2">Volum (m3)</th>
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
                Enkel SVG-generering basert på IFC-metadata (ikke full geometri). Brukes som midlertidig arbeidstegning.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {availableModels.length === 0 ? (
                <div className="text-center py-8">
                  <Image className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">Ingen modeller tilgjengelig. Last opp en IFC først.</p>
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
        <TabsContent value="files" className="space-y-6">
          {supabaseDiagnostics && (
            <Card>
              <CardHeader>
                <CardTitle>Lagrede IFC-filer (Supabase)</CardTitle>
                <CardDescription>
                  Bucket <span className="font-mono">{supabaseDiagnostics.bucket}</span> ·{" "}
                  {supabaseDiagnostics.providers.join(", ") || "Supabase"} ·{" "}
                  {supabaseDiagnostics.count} fil{supabaseDiagnostics.count === 1 ? "" : "er"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-slate-600">
                    Sist sjekket: {new Date(supabaseDiagnostics.lastUpdated).toLocaleTimeString("no-NO")}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => loadProjectModels()}>
                    Oppdater liste
                  </Button>
                </div>
                {supabaseDiagnostics.message && (
                  <p className="text-xs text-slate-500">{supabaseDiagnostics.message}</p>
                )}
                {supabaseFiles.length === 0 ? (
                  <p className="text-sm text-slate-600">Ingen IFC-filer funnet i lagringen ennå.</p>
                ) : (
                  <div className="space-y-2">
                    {supabaseFiles.slice(0, 5).map((file) => (
                      <div
                        key={file.path || file.id}
                        className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-xs text-slate-500">
                            {file.provider || "supabase"} · {file.uploadedAt ? formatDate(file.uploadedAt) : "nylig"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <a href={file.storageUrl || file.fileUrl || "#"} target="_blank" rel="noreferrer">
                        Åpne
                      </a>
                    </Button>
                          {file.storageUrl || file.fileUrl ? (
                            <Button variant="outline" size="sm" asChild>
                              <a href={file.storageUrl || file.fileUrl} target="_blank" rel="noreferrer">
                                Åpne
                              </a>
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-500">Ingen URL</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          <ProjectFiles selectedProject={selectedProject} />
        </TabsContent>
      </Tabs>
    </div>
  );
}









