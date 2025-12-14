"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, Image, FileType, FilePlus, Folder, Download, Eye, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  hasText?: boolean;
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
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewText, setPreviewText] = useState<{
    content?: string;
    requirements?: { id: string; text: string; source_page?: number; source_path?: string }[];
    loading: boolean;
    error?: string;
  }>({ loading: false });
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const filtered = files.filter((f) => {
    const matchesCategory = activeCategory === "all" || f.category === activeCategory;
    const matchesSearch =
      !searchTerm ||
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.category || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const loadTextForFile = async (file: FileItem) => {
    if (!file.id || !file.hasText) {
      setPreviewText({ loading: false, content: undefined, requirements: [] });
      return;
    }
    setPreviewText({ loading: true, requirements: [] });
    try {
      const res = await fetch(`/api/files/text?fileId=${encodeURIComponent(file.id)}`, { cache: "no-store" });
      if (!res.ok) {
        setPreviewText({ loading: false, error: "Kunne ikke hente tekst" });
        return;
      }
      const data = await res.json();
      setPreviewText({
        loading: false,
        content: data.content,
        requirements: data.requirements || [],
      });
    } catch (err) {
      setPreviewText({ loading: false, error: "Kunne ikke hente tekst" });
    }
  };

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
              hasText: res.hasText,
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
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onUpload}
          />
          <Button size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Last opp filer
          </Button>
          {isUploading && <Badge variant="secondary">Laster opp...</Badge>}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Søk i filnavn eller kategori..."
              className="pl-9"
            />
          </div>
        </div>

        <Tabs value={activeCategory} onValueChange={(val) => setActiveCategory(val as Category | "all")}>
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="all">Alle</TabsTrigger>
            <TabsTrigger value="ifc">IFC</TabsTrigger>
            <TabsTrigger value="pdf">PDF</TabsTrigger>
            <TabsTrigger value="document">Dokument</TabsTrigger>
            <TabsTrigger value="image">Bilde</TabsTrigger>
            <TabsTrigger value="spreadsheet">Regneark</TabsTrigger>
            <TabsTrigger value="other">Andre</TabsTrigger>
          </TabsList>

          <TabsContent value={activeCategory} className="space-y-3">
            <FileGrid files={filtered} onPreview={setPreviewFile} />
          </TabsContent>
        </Tabs>

        {filtered.length === 0 && <p className="text-sm text-slate-500">Ingen filer funnet for valgt kategori.</p>}
      </CardContent>

      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.name}</DialogTitle>
            <p className="text-sm text-slate-500 break-all">{previewFile?.publicUrl}</p>
          </DialogHeader>
          {previewFile ? (
            <PreviewBody file={previewFile} previewText={previewText} onLoadText={loadTextForFile} />
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function FileGrid({ files, onPreview }: { files: FileItem[]; onPreview: (f: FileItem) => void }) {
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
            {file.hasText && (
              <div className="text-[11px] text-emerald-700">Tekst ekstrahert for chat/krav</div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">{categoryLabels[(file.category as Category) || "unknown"]}</Badge>
            <Button variant="outline" size="sm" onClick={() => onPreview(file)}>
              <Eye className="w-4 h-4 mr-1" />
              Apne
            </Button>
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

function PreviewBody({
  file,
  previewText,
  onLoadText,
}: {
  file: FileItem;
  previewText: { content?: string; requirements?: any[]; loading: boolean; error?: string };
  onLoadText: (f: FileItem) => void;
}) {
  const [showFullText, setShowFullText] = useState(false);
  const category = (file.category as Category) || "unknown";
  const iframeUrl =
    category === "ifc"
      ? `/xeokit-viewer.html?url=${encodeURIComponent(file.publicUrl)}`
      : file.publicUrl;

  useEffect(() => {
    if (file.hasText) {
      onLoadText(file);
    }
  }, [file?.id]);

  if (category === "image") {
    return <img src={file.publicUrl} alt={file.name} className="max-h-[70vh] w-full object-contain rounded" />;
  }
  if (category === "pdf") {
    return (
      <iframe
        src={file.publicUrl}
        title={file.name}
        className="w-full"
        style={{ minHeight: "70vh" }}
      />
    );
  }
  if (category === "ifc") {
    return (
      <iframe
        src={iframeUrl}
        title={file.name}
        className="w-full"
        style={{ minHeight: "70vh" }}
      />
    );
  }
  if (category === "document" || category === "spreadsheet" || category === "other") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Forhandsvisning stottes ikke for denne filtypen. Bruk nedlasting for a apne lokalt.
        </p>
        <Button asChild>
          <a href={file.publicUrl} target="_blank" rel="noreferrer">
            <Download className="w-4 h-4 mr-1" />
            Last ned
          </a>
        </Button>
        {file.hasText && (
          <div className="space-y-3 border-t pt-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Tekst &amp; krav (ekstrahert)</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowFullText((v) => !v)}>
                  {showFullText ? "Skjul" : "Vis mer"}
                </Button>
              </div>
            </div>
            {previewText.loading && <p className="text-sm text-slate-500">Laster tekst...</p>}
            {previewText.error && <p className="text-sm text-red-500">{previewText.error}</p>}
            {previewText.content && (
              <div
                className="p-2 bg-muted rounded text-sm overflow-auto whitespace-pre-wrap"
                style={{ maxHeight: showFullText ? "55vh" : "22vh" }}
              >
                {showFullText ? previewText.content : previewText.content.slice(0, 4000)}
                {!showFullText && previewText.content.length > 4000 ? " ..." : ""}
              </div>
            )}
            {previewText.requirements && previewText.requirements.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs uppercase text-slate-500">Krav (alle)</p>
                <ul className="list-disc pl-4 space-y-1 text-sm max-h-56 overflow-auto">
                  {previewText.requirements.map((req) => (
                    <li key={req.id}>
                      {req.text}
                      {req.source_page ? <span className="text-xs text-slate-500"> (side {req.source_page})</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  return null;
}
