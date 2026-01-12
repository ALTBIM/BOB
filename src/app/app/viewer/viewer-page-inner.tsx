"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/lib/session";
import { useActiveProject } from "@/lib/active-project";
import { Loader2, Eye } from "lucide-react";
import { listIfcFiles } from "@/lib/storage";

type ModelItem = {
  id: string;
  name: string;
  fileUrl: string;
  viewerUrl: string;
  uploadedAt?: string;
};

const VIEWER_BASE_URL = process.env.NEXT_PUBLIC_IFC_VIEWER_URL || "https://viewer.altbim.no";

const toSafeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");

const buildViewerUrl = (projectId: string, file: { id?: string; name: string; path: string; publicUrl: string; provider?: string }) => {
  const safeId = toSafeId(file.id || file.path || file.name);
  const params = new URLSearchParams({
    url: file.publicUrl,
    name: file.name,
    path: file.path,
    provider: file.provider || "supabase",
    fileId: file.id || file.path,
    embed: "1",
  });
  return `${VIEWER_BASE_URL}/projects/${encodeURIComponent(projectId)}/models/${encodeURIComponent(safeId)}/viewer?${params.toString()}`;
};

export default function ViewerPageInner() {
  const { user, ready } = useSession();
  const { projects, activeProjectId, setActiveProjectId } = useActiveProject();
  const searchParams = useSearchParams();
  const paramProjectId = useMemo(() => searchParams.get("projectId") || "", [searchParams]);
  const paramUrl = useMemo(() => searchParams.get("url") || searchParams.get("modelUrl") || "", [searchParams]);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [selectedViewerUrl, setSelectedViewerUrl] = useState<string>("");
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (!paramProjectId || projects.length === 0) return;
    if (projects.some((p) => p.id === paramProjectId) && paramProjectId !== activeProjectId) {
      setActiveProjectId(paramProjectId);
    }
  }, [paramProjectId, projects, activeProjectId, setActiveProjectId]);

  useEffect(() => {
    const loadModels = async () => {
      if (!activeProjectId) {
        setModels([]);
        setSelectedViewerUrl("");
        return;
      }
      setLoadingModels(true);
      try {
        const storageList = await listIfcFiles(activeProjectId);
        const items: ModelItem[] =
          storageList?.map((m: any) => ({
            id: m.id || m.path,
            name: m.name || m.filename || m.path,
            fileUrl: m.publicUrl,
            viewerUrl: buildViewerUrl(activeProjectId, {
              id: m.id || m.path,
              name: m.name || m.filename || m.path,
              path: m.path,
              publicUrl: m.publicUrl,
              provider: m.provider || "supabase",
            }),
            uploadedAt: m.uploadedAt,
          })) || [];
        setModels(items);
        if (paramUrl) {
          const match = items.find((item) => item.fileUrl === paramUrl);
          setSelectedViewerUrl(match?.viewerUrl || items[0]?.viewerUrl || "");
        } else {
          setSelectedViewerUrl(items[0]?.viewerUrl || "");
        }
      } catch (err) {
        console.warn("Kunne ikke hente modeller", err);
        setModels([]);
        setSelectedViewerUrl("");
      } finally {
        setLoadingModels(false);
      }
    };
    loadModels();
  }, [activeProjectId, paramUrl]);

  if (!ready) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Laster ...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">
        Logg inn for \u00e5 se viewer.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">IFC Viewer</h1>
          <p className="text-sm text-muted-foreground">Vis IFC-modeller fra prosjektet direkte i BOB.</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={selectedViewerUrl || VIEWER_BASE_URL} target="_blank" rel="noreferrer">
            <Eye className="w-4 h-4 mr-2" />
            \u00c5pne i nytt vindu
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Velg prosjekt og IFC</CardTitle>
          <CardDescription>Modellene hentes fra samme lagring som upload-modulen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prosjekt</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {projects.find((p) => p.id === activeProjectId)?.name || "Velg prosjekt i sidemenyen"}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label>IFC-modell</Label>
              {loadingModels ? (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Laster modeller...
                </div>
              ) : (
                <Select value={selectedViewerUrl} onValueChange={setSelectedViewerUrl} disabled={models.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={models.length ? "Velg IFC..." : "Ingen IFC funnet"} />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.viewerUrl}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {selectedViewerUrl ? (
            <div className="border rounded-lg overflow-hidden h-[75vh]">
              <iframe
                src={selectedViewerUrl}
                title="IFC Viewer"
                className="w-full h-full"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Velg en IFC-fil for \u00e5 vise modellen.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
