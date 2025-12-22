"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Building2,
  Calendar,
  Eye,
  Trash2,
  Download,
  User
} from "lucide-react";
import { db } from "@/lib/database";
import { recordModelMaterials } from "@/lib/material-store";
import { parseIfcFile, IFCElementSummary } from "@/lib/ifc-parser";
import { uploadIfcFile, listAllFiles, uploadGenericFile } from "@/lib/storage";

interface ModelUploadProps {
  selectedProject: string | null;
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
  fileId?: string;
  modelId?: string;
  provider?: string;
  category?: string;
  fileUrl?: string;
  storageUrl?: string;
  rawFile?: File;
  elementSummary?: IFCElementSummary[];
}

export default function ModelUpload({ selectedProject }: ModelUploadProps) {
  const [files, setFiles] = useState<ModelFile[]>([]);
  const [existingFiles, setExistingFiles] = useState<ModelFile[]>([]);
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (!selectedProject) {
      setExistingFiles([]);
      return;
    }

    const loadExisting = async () => {
      try {
        // Hent alle filer (ikke bare IFC) for å bruke denne fanen som en enkel dokumentoversikt inntil dedikert side finnes
        const allFiles = await listAllFiles(selectedProject);
        const mapped: ModelFile[] = allFiles.map((item) => ({
          id: item.id || item.path,
          name: item.name,
          size: item.size || 0,
          type: item.type || "application/octet-stream",
          status: "completed",
          progress: 100,
          projectId: selectedProject,
          uploadedAt: item.uploadedAt || new Date().toISOString(),
          uploadedBy: item.uploadedBy || "Lagring",
          provider: item.provider,
          category: item.category,
          storageUrl: item.publicUrl,
          fileUrl: item.publicUrl,
          fileId: item.fileId,
        }));

        const merged = new Map<string, ModelFile>();
        mapped.forEach((f) => {
          if (f.storageUrl) merged.set(f.id, f);
        });
        setExistingFiles(Array.from(merged.values()));
      } catch (err) {
        console.error("Klarte ikke laste eksisterende filer", err);
      }
    };

    loadExisting();
  }, [selectedProject]);

  const processFiles = (fileList: File[]) => {
    if (!selectedProject) {
      alert("Velg et prosjekt fra dropdown-menyen først");
      return;
    }

    const validFiles = fileList.filter(
      (file) => file.name.toLowerCase().endsWith(".ifc") || file.name.toLowerCase().endsWith(".ifczip")
    );

    if (validFiles.length === 0) {
      alert("Velg gyldige IFC-filer (.ifc eller .ifczip)");
      return;
    }

    const newFiles: ModelFile[] = validFiles.map((file) => {
      const objectUrl = URL.createObjectURL(file);
      return {
        id: `file-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        status: "uploading",
        progress: 0,
        projectId: selectedProject,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "Andreas Hansen",
        provider: "local",
        storageUrl: objectUrl,
        fileUrl: objectUrl,
        rawFile: file
      };
    });

    setFiles((prev) => [...prev, ...newFiles]);

    newFiles.forEach((file) => {
      void processIfcFile(file);
    });
  };

  const processIfcFile = async (file: ModelFile) => {
    if (!file.rawFile) {
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: "error", error: "Fant ikke IFC-fil" } : f))
      );
      return;
    }

    setFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, status: "processing", progress: 20 } : f))
    );

    try {
      const parsed = await parseIfcFile(file.rawFile);
      const materials = parsed.materials || [];
      const updated: ModelFile = {
        ...file,
        status: "completed",
        progress: 100,
        objects: parsed.objectCount ?? 0,
        zones: parsed.spaceCount ?? 0,
        materials: materials.length,
        materialList: materials,
        elementSummary: parsed.elementSummary || [],
      };

      setFiles((prev) => prev.map((f) => (f.id === file.id ? updated : f)));
      setExistingFiles((prev) => {
        const exists = prev.find((f) => f.id === file.id);
        if (exists) {
          return prev.map((f) => (f.id === file.id ? updated : f));
        }
        return [...prev, updated];
      });

      await persistModelToStore(updated, materials);
      fetch("/api/ifc/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: updated.projectId,
          modelId: updated.modelId || updated.id,
          name: updated.name,
          materials,
          objects: updated.objects,
          zones: updated.zones,
          elementSummary: updated.elementSummary || [],
        }),
      }).catch((err) => console.error("Kunne ikke lagre IFC-metadata", err));
    } catch (error) {
      console.error("Kunne ikke lese IFC", error);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, status: "error", error: "IFC-lesing feilet", progress: 0 } : f
        )
      );
    }
  };

  const persistModelToStore = async (file: ModelFile, materials: string[]) => {
    try {
      let storageUrl = file.storageUrl;
      if (file.rawFile) {
        const uploaded = await uploadIfcFile(file.rawFile, file.projectId);
        storageUrl = uploaded?.publicUrl || storageUrl;
        if (uploaded?.fileId || uploaded?.modelId || uploaded?.provider) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? {
                    ...f,
                    fileId: uploaded.fileId || f.fileId,
                    modelId: uploaded.modelId || f.modelId,
                    provider: uploaded.provider || f.provider,
                  }
                : f
            )
          );
        }
      }
      if (!storageUrl) {
        throw new Error("Fikk ingen lagrings-URL fra opplasting");
      }
      if (storageUrl) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  storageUrl,
                  fileUrl: f.fileUrl || storageUrl,
                  fileId: f.fileId || file.fileId,
                  modelId: f.modelId || file.modelId,
                  provider: f.provider || file.provider,
                }
              : f
          )
        );
        setExistingFiles((prev) => {
          const exists = prev.find((f) => f.id === file.id);
          if (!exists) {
            return [
              ...prev,
              {
                ...file,
                storageUrl,
                fileUrl: file.fileUrl || storageUrl,
                fileId: file.fileId,
                modelId: file.modelId,
                provider: file.provider,
              },
            ];
          }
          return prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  storageUrl,
                  fileUrl: f.fileUrl || storageUrl,
                  fileId: f.fileId || file.fileId,
                  modelId: f.modelId || file.modelId,
                  provider: f.provider || file.provider,
                }
              : f
          );
        });
      }
      const created = await db.createBIMModel({
        name: file.name,
        filename: file.name,
        size: file.size,
        projectId: file.projectId,
        uploadedBy: file.uploadedBy,
        status: file.status,
        objects: file.objects,
        zones: file.zones,
        materials: file.materials,
        storageUrl,
        description: "IFC-fil lastet opp i denne økten"
      });
      recordModelMaterials(file.projectId, created.id, materials);
    } catch (error) {
      console.error("Kunne ikke lagre modell i database", error);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, status: "error", error: "Opplasting feilet", progress: 0 } : f
        )
      );
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      processFiles(droppedFiles);
    },
    [selectedProject]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      processFiles(selectedFiles);
    }
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== fileId));
  };

  const handleGenericFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedProject) {
      alert("Velg et prosjekt først");
      return;
    }
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    setIsUploadingDocs(true);
    try {
      for (const f of selected) {
        const res = await uploadGenericFile(f, selectedProject);
        if (res?.publicUrl) {
          const newFile: ModelFile = {
            id: res.fileId || res.path,
            name: f.name,
            size: f.size,
            type: f.type || "application/octet-stream",
            status: "completed",
            progress: 100,
            projectId: selectedProject,
            uploadedAt: new Date().toISOString(),
            uploadedBy: "Du",
            storageUrl: res.publicUrl,
            fileUrl: res.publicUrl,
            fileId: res.fileId,
            category: res.category || "other",
          };
          setExistingFiles((prev) => [...prev, newFile]);
        }
      }
    } catch (err) {
      console.error("Opplasting feilet", err);
      alert("Opplasting feilet. Se konsoll for detaljer.");
    } finally {
      setIsUploadingDocs(false);
      e.target.value = "";
    }
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
      minute: "2-digit"
    });
  };

  const getProjectFiles = () => {
    return existingFiles.filter((file) => (selectedProject ? file.projectId === selectedProject : true));
  };

  if (!selectedProject) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="font-medium text-slate-900 mb-2">Ingen prosjekt valgt</h3>
          <p className="text-slate-600">Velg et prosjekt fra dropdown-menyen for å laste opp BIM-modeller</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList>
          <TabsTrigger value="upload">Last opp modeller</TabsTrigger>
          <TabsTrigger value="browse">Se filer</TabsTrigger>
          <TabsTrigger value="docs">Dokumenter</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Last opp IFC-modeller</CardTitle>
              <CardDescription>Last opp IFC-filer (IFC2x3, IFC4) for å trekke ut objekter, soner og materialer</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-slate-400"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <h3 className="text-lg font-medium mb-2">Dra IFC-filer hit eller klikk for å velge</h3>
                <p className="text-slate-500 mb-4">Støtter .ifc og .ifczip filer opp til 500MB</p>
                <input type="file" multiple accept=".ifc,.ifczip" onChange={handleFileSelect} className="hidden" id="file-upload" />
                <Button asChild>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    Velg filer
                  </label>
                </Button>
              </div>
            </CardContent>
          </Card>

          {files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Opplastingsfremdrift</CardTitle>
                <CardDescription>Prosesserer {files.length} fil(er)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {files.map((file) => (
                  <div key={file.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span className="font-medium">{file.name}</span>
                        <span className="text-sm text-slate-500">({formatFileSize(file.size)})</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {file.status === "completed" && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {file.status === "error" && <AlertCircle className="w-4 h-4 text-red-500" />}
                        <Button variant="ghost" size="sm" onClick={() => removeFile(file.id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {file.status !== "completed" && file.status !== "error" && (
                      <div className="space-y-2">
                        <Progress value={file.progress} className="h-2" />
                        <p className="text-sm text-slate-500">
                          {file.status === "uploading" ? "Laster opp..." : "Prosesserer IFC..."} {Math.round(file.progress)}%
                        </p>
                      </div>
                    )}

                    {file.status === "completed" && (
                      <>
                        <div className="grid grid-cols-3 gap-4 mt-2">
                          <div className="text-center">
                            <div className="text-lg font-semibold">{file.objects}</div>
                            <div className="text-xs text-slate-500">Objekter</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold">{file.zones}</div>
                            <div className="text-xs text-slate-500">Soner</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold">{file.materials}</div>
                            <div className="text-xs text-slate-500">Materialer</div>
                          </div>
                        </div>
                        {file.elementSummary && file.elementSummary.length > 0 && (
                          <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-xs">
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
                                {file.elementSummary.map((entry) => (
                                  <tr key={`${entry.elementType}-${entry.typeName}`} className="border-b">
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
                          </div>
                        )}
                      </>
                    )}

                    {file.status === "error" && (
                      <Alert className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{file.error}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="browse" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Prosjektfiler</CardTitle>
              <CardDescription>Opplastede IFC-modeller for dette prosjektet</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getProjectFiles()
                  .filter((file) => file.storageUrl)
                  .map((file) => {
                    const downloadUrl = file.storageUrl || file.fileUrl;
                    const viewerUrl = downloadUrl
                      ? `/app/viewer?projectId=${encodeURIComponent(selectedProject || "")}&url=${encodeURIComponent(downloadUrl)}`
                      : undefined;
                    return (
                      <div key={file.id} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="font-medium">{file.name}</h4>
                              <div className="flex items-center space-x-4 text-sm text-slate-500">
                                <span>{formatFileSize(file.size)}</span>
                                <span className="flex items-center">
                                  <User className="w-3 h-3 mr-1" />
                                  {file.uploadedBy}
                                </span>
                                <span className="flex items-center">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {formatDate(file.uploadedAt)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Badge variant={file.status === "completed" ? "default" : "secondary"}>
                              {file.status === "completed" ? "Ferdig" : file.status}
                            </Badge>
                            {viewerUrl && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={viewerUrl}  title="Åpne i xeokit-viewer">
                                  <Eye className="w-4 h-4 mr-1" />
                                  Vis
                                </a>
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" asChild disabled={!downloadUrl}>
                              <a
                                href={downloadUrl}
                                download={file.name}
                                rel="noreferrer"
                                title={downloadUrl ? "Last ned IFC" : "Ingen fil-URL"}
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                          </div>
                        </div>

                        {file.status === "completed" && (
                          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                            <div className="text-center">
                              <div className="text-lg font-semibold text-blue-600">{file.objects}</div>
                              <div className="text-xs text-slate-500">Objekter</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-semibold text-green-600">{file.zones}</div>
                              <div className="text-xs text-slate-500">Soner</div>
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-semibold text-orange-600">{file.materials}</div>
                              <div className="text-xs text-slate-500">Materialer</div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                {getProjectFiles().length === 0 && (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h4 className="font-medium mb-2">Ingen modeller lastet opp</h4>
                    <p className="text-slate-500 mb-4">Ingen modeller er lastet opp ennå for dette prosjektet.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dokumenter</CardTitle>
              <CardDescription>Last opp og se prosjektfiler (IFC, PDF, DOCX, bilder m.m.)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <input type="file" multiple onChange={handleGenericFileSelect} />
                {isUploadingDocs && <span className="text-sm text-slate-500">Laster opp...</span>}
              </div>
              <div className="space-y-4">
                {existingFiles.length === 0 && (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h4 className="font-medium mb-2">Ingen filer</h4>
                    <p className="text-slate-500 mb-4">Last opp dokumenter, tegninger, krav eller IFC-filer.</p>
                  </div>
                )}
                {existingFiles.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {existingFiles
                      .filter((f) => f.storageUrl)
                      .map((file) => (
                        <div key={file.id} className="border rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <div className="flex items-center space-x-2">
                              <FileText className="w-4 h-4 text-slate-500" />
                              <span className="font-medium">{file.name}</span>
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatFileSize(file.size)} · {file.category || "ukjent"}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary">{file.category || "fil"}</Badge>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={file.storageUrl} >
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}







