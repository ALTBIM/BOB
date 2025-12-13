"use client";

import { useState, useCallback } from "react";
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
  storageUrl?: string;
}

export default function ModelUpload({ selectedProject }: ModelUploadProps) {
  const [files, setFiles] = useState<ModelFile[]>([]);
  const [existingFiles, setExistingFiles] = useState<ModelFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

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
      storageUrl: URL.createObjectURL(file)
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    // Simulate file processing
    newFiles.forEach((file) => {
      simulateFileProcessing(file.id);
    });
  };

  const simulateFileProcessing = (fileId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;

      setFiles((prev) =>
        prev.map((file) => {
          if (file.id === fileId) {
            if (progress >= 100) {
              clearInterval(interval);
              // Simulate processing completion
              setTimeout(() => {
                setFiles((prev) =>
                  prev.map((f) => {
                    if (f.id === fileId) {
                      const completedFile = {
                        ...f,
                        status: "completed",
                        progress: 100,
                        objects: Math.floor(Math.random() * 5000) + 1000,
                        zones: Math.floor(Math.random() * 50) + 10,
                        materials: Math.floor(Math.random() * 200) + 50
                      };
                      const materialPool = ["betong", "stal", "tre", "aluminium", "glass", "gips", "isolasjon"];
                      const selected = materialPool.sort(() => 0.5 - Math.random()).slice(0, 4);
                      persistModelToStore(completedFile, selected);
                      setExistingFiles((existing) => [...existing, completedFile]);
                      return completedFile;
                    }
                    return f;
                  })
                );
              }, 2000);

              return {
                ...file,
                status: "processing",
                progress: 100
              };
            }
            return {
              ...file,
              progress: Math.min(progress, 100)
            };
          }
          return file;
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
        materials: file.materials,
        storageUrl: file.storageUrl,
        description: "IFC-fil lastet opp i denne okten"
      });
      recordModelMaterials(file.projectId, created.id, materials);
    } catch (error) {
      console.error("Kunne ikke lagre modell i database", error);
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
                {getProjectFiles().map((file) => (
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
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" disabled title="Nedlasting av IFC kommer senere">
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
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
                ))}

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
      </Tabs>
    </div>
  );
}
