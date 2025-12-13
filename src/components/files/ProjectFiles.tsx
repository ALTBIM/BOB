"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Image, FileType, FilePlus, Folder, Download } from "lucide-react";
import { listAllFiles, uploadGenericFile } from "@/lib/storage";

interface ProjectFilesProps {
  selectedProject: string | null;
}

type Category = "ifc" | "pdf" | "document" | "image" | "spreadsheet" | "other" | "unknown";

interface FileItem {
  id: string;
  name: string;
  size: number;
  path: string;
  publicUrl: string;
  uploadedAt: string;
  provider?: string;
  type?: string;
  category?: Category;
  projectId?: string;
}

const categoryLabels: Record<Category, string> = {
  ifc: "IFC",
  pdf: "PDF",
  document: "Dokument",
  image: "Bilde",
  spreadsheet: "Regneark",
  other: "Annet",
  unknown: "Ukjent",
};

const categoryIcons: Record<Category, JSX.Element> = {
  ifc: <FileType className="w-4 h-4" />,
  pdf: <FileText className="w-4 h-4" />,
  document: <FileText className="w-4 h-4" />,
  image: <Image className="w-4 h-4" />,
  spreadsheet: <FileType className="w-4 h-4" />,
  other: <FilePlus className="w-4 h-4" />,
  unknown: <FileText className="w-4 h-4" />,
};

export function ProjectFiles({ selectedProject }: ProjectFilesProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");

  useEffect(() => {
    if (!selectedProject) {
      setFiles([]);
      return;
    }
    const load = async () => {
      const data = await listAllFiles(selectedProject);
      setFiles(data as FileItem[]);
    };
    load();
  }, [selectedProject]);

  const filtered = activeCategory === "all" ? files : files.filter((f) => f.category === activeCategory);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedProject) return;
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    try {
      const selected = Array.from(e.target.files);
      for (const f of selected) {
        const res = await uploadGenericFile(f, selectedProject);
        if (res?.publicUrl) {
          setFiles((prev) => [
            {
              id: res.fileId || res.path,
              name: f.name,
              size: f.size,
              path: res.path,
              publicUrl: res.publicUrl,
              uploadedAt: new Date().toISOString(),
              category: (res.category as Category) || "other",
              type: f.type,
              projectId: selectedProject,
            },
            ...prev,
          ]);
        }
      }
    } catch (err) {
      console.error("Upload feilet", err);
      alert("Opplasting feilet");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  if (!selectedProject) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Folder className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="font-medium text-slate-900 mb-2">Ingen prosjekt valgt</h3>
          <p className="text-slate-600">Velg et prosjekt for å se og laste opp filer</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dokumenter</CardTitle>
        <CardDescription>Prosjektfiler (IFC, PDF, DOCX, bilder m.m.)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-3">
          <input type="file" multiple onChange={onUpload} />
          {isUploading && <span className="text-sm text-slate-500">Laster opp...</span>}
        </div>

        <Tabs value={activeCategory} onValueChange={(val) => setActiveCategory(val as Category | "all")}>
          <TabsList>
            <TabsTrigger value="all">Alle</TabsTrigger>
            <TabsTrigger value="ifc">IFC</TabsTrigger>
            <TabsTrigger value="pdf">PDF</TabsTrigger>
            <TabsTrigger value="document">Dokument</TabsTrigger>
            <TabsTrigger value="image">Bilde</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-3">
            <FileGrid files={filtered} />
          </TabsContent>
          <TabsContent value="ifc" className="space-y-3">
            <FileGrid files={filtered} />
          </TabsContent>
          <TabsContent value="pdf" className="space-y-3">
            <FileGrid files={filtered} />
          </TabsContent>
          <TabsContent value="document" className="space-y-3">
            <FileGrid files={filtered} />
          </TabsContent>
          <TabsContent value="image" className="space-y-3">
            <FileGrid files={filtered} />
          </TabsContent>
        </Tabs>

        {filtered.length === 0 && <p className="text-sm text-slate-500">Ingen filer funnet for valgt kategori.</p>}
      </CardContent>
    </Card>
  );
}

function FileGrid({ files }: { files: FileItem[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {files.map((file) => (
        <div key={file.id} className="border rounded-lg p-3 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              {categoryIcons[(file.category as Category) || "unknown"]}
              <span className="font-medium">{file.name}</span>
            </div>
            <div className="text-xs text-slate-500">{formatBytes(file.size)}</div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">{categoryLabels[(file.category as Category) || "unknown"]}</Badge>
            <Button variant="ghost" size="sm" asChild>
              <a href={file.publicUrl} target="_blank" rel="noreferrer">
                <Download className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

