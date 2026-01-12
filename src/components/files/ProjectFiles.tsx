"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, Image, FileType, FilePlus, Folder, Download, Eye, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { listAllFiles, uploadGenericFile } from "@/lib/storage";
import { useSession } from "@/lib/session";

interface ProjectFilesProps {
  selectedProject: string | null;
}

type Category = "ifc" | "pdf" | "document" | "image" | "spreadsheet" | "other" | "unknown";

interface FileItem {
  id: string;
  name: string;
  size: number;
  path: string;
  publicUrl: string | null;
  uploadedAt: string;
  provider?: string;
  type?: string;
  category?: Category;
  projectId?: string;
  hasText?: boolean;
  version?: number;
  archived?: boolean;
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
  const { accessToken } = useSession();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
      const data = await listAllFiles(selectedProject, showArchived);
      setFiles(data as FileItem[]);
    };
    load();
  }, [selectedProject, showArchived]);

  const filtered = files.filter((f) => {
    if (!showArchived && f.archived) return false;
    const matchesCategory = activeCategory === "all" || f.category === activeCategory;
    const matchesSearch =
      !searchTerm ||
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.category || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  useEffect(() => {
    const filteredIds = new Set(filtered.map((f) => f.id));
    setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => filteredIds.has(id))));
  }, [filtered]);

  const handleToggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filtered.map((f) => f.id)));
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!accessToken) {
      alert("Mangler p\u00e5logging. Logg inn p\u00e5 nytt.");
      return;
    }
    const confirmDelete = window.confirm(
      `Vil du slette ${selectedIds.size} fil(er)? Dette kan ikke angres.`
    );
    if (!confirmDelete) return;

    const selected = files.filter((f) => selectedIds.has(f.id));
    const payload = {
      fileIds: selected.map((f) => f.id),
      paths: selected.map((f) => f.path).filter(Boolean),
      projectId: selectedProject,
    };

    try {
      const res = await fetch("/api/files/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        alert(`Sletting feilet: ${text}`);
        return;
      }
      setFiles((prev) => prev.filter((f) => !selectedIds.has(f.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Sletting feilet", err);
      alert("Sletting feilet");
    }
  };

  const loadTextForFile = async (file: FileItem) => {
    if (!file.id || !file.hasText) {
      setPreviewText({ loading: false, content: undefined, requirements: [] });
      return;
    }
    if (!accessToken) {
      setPreviewText({ loading: false, error: "Mangler p\u00e5logging." });
      return;
    }
    setPreviewText({ loading: true, requirements: [] });
    try {
      const res = await fetch(`/api/files/text?fileId=${encodeURIComponent(file.id)}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
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
        const hasActive = files.some(
          (file) =>
            file.name.toLowerCase() === f.name.toLowerCase() &&
            (file.type || "") === (f.type || "") &&
            !file.archived
        );
        if (hasActive) {
          const confirmReplace = window.confirm(
            `Det finnes allerede en fil med navnet "${f.name}". Vil du laste opp en ny versjon? Den gamle flyttes til arkiv.`
          );
          if (!confirmReplace) continue;
        }
        const res = await uploadGenericFile(f, selectedProject);
        if (res?.publicUrl) {
          const newFile: FileItem = {
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
            version: res.version || 1,
            archived: false,
          };
          setFiles((prev) => {
            const updated = prev.map((file) => {
              if (
                file.name.toLowerCase() === f.name.toLowerCase() &&
                (file.type || "") === (f.type || "") &&
                !file.archived
              ) {
                return { ...file, archived: true };
              }
              return file;
            });
            return [newFile, ...updated];
          });
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
          <p className="text-slate-600">Velg et prosjekt for \u00e5 se og laste opp filer</p>
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
              placeholder="S\u00f8k i filnavn eller kategori..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="show-archived"
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <label htmlFor="show-archived" className="text-sm text-slate-600">
              Vis arkiv
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all-files"
              checked={filtered.length > 0 && selectedIds.size === filtered.length}
              onCheckedChange={(checked) => handleToggleSelectAll(Boolean(checked))}
            />
            <label htmlFor="select-all-files" className="text-sm text-slate-600">
              Velg alle
            </label>
          </div>
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={handleDeleteSelected}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Slett valgte
          </Button>
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
            <FileGrid
              files={filtered}
              onPreview={setPreviewFile}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
            />
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

function FileGrid({
  files,
  onPreview,
  selectedIds,
  onToggleSelect,
}: {
  files: FileItem[];
  onPreview: (f: FileItem) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {files.map((file) => (
        <div key={file.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={selectedIds.has(file.id)}
              onCheckedChange={(checked) => onToggleSelect(file.id, Boolean(checked))}
            />
            <div>
              <div className="flex items-center space-x-2">
                {categoryIcons[(file.category as Category) || "unknown"]}
                <span className="font-medium">{file.name}</span>
              </div>
              <div className="text-xs text-slate-500">
                v{file.version || 1} - {formatDateTime(file.uploadedAt)}
              </div>
              {file.hasText && (
                <div className="text-[11px] text-emerald-700">Tekst ekstrahert for chat/krav</div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">{categoryLabels[(file.category as Category) || "unknown"]}</Badge>
            {file.archived && <Badge variant="outline">Arkiv</Badge>}
            <Button variant="outline" size="sm" onClick={() => onPreview(file)}>
              <Eye className="w-4 h-4 mr-1" />
              \u00c5pne
            </Button>
            {file.publicUrl ? (
              <Button variant="ghost" size="sm" asChild>
                <a href={file.publicUrl} target="_blank" rel="noreferrer">
                  <Download className="w-4 h-4" />
                </a>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" disabled title="Ingen nedlastingslenke tilgjengelig">
                <Download className="w-4 h-4" />
              </Button>
            )}
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

function formatDateTime(dateString?: string) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString("no-NO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      ? `https://viewer.altbim.no/?url=${encodeURIComponent(file.publicUrl)}`
      : file.publicUrl;

  if (!file.publicUrl) {
    return <p className="text-sm text-slate-600">Ingen gyldig nedlastingslenke tilgjengelig for filen.</p>;
  }

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
          Forh\u00e5ndsvisning st\u00f8ttes ikke for denne filtypen. Bruk nedlasting for \u00e5 \u00e5pne lokalt.
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
















