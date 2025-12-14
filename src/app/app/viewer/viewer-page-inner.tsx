"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { db, Project } from "@/lib/database";
import { Loader2, Eye } from "lucide-react";

type ModelItem = {
  id: string;
  name: string;
  url: string;
  uploadedAt?: string;
};

export default function ViewerPageInner() {
  const { user, ready } = useSession();
  const searchParams = useSearchParams();
  const paramProjectId = useMemo(() => searchParams.get("projectId") || "", [searchParams]);
  const paramUrl = useMemo(() => searchParams.get("url") || searchParams.get("modelUrl") || "", [searchParams]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [models, setModels] = useState<ModelItem[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string>("");
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadProjects = async () => {
      try {
        const list = await db.getProjectsForUser(user.id);
        setProjects(list);
        if (list.length && !projectId) {
          const initial = paramProjectId && list.find((p) => p.id === paramProjectId) ? paramProjectId : list[0].id;
          setProjectId(initial);
        }
      } catch (err) {
        console.warn("Kunne ikke hente prosjekter", err);
      }
    };
    loadProjects();
  }, [user, paramProjectId, projectId]);

  useEffect(() => {
    const loadModels = async () => {
      if (!projectId) {
        setModels([]);
        setSelectedUrl("");
        return;
      }
      setLoadingModels(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/models`);
        if (!res.ok) {
          setModels([]);
          setSelectedUrl("");
          return;
        }
        const data = await res.json();
        const items: ModelItem[] =
          data?.models?.map((m: any) => ({
            id: m.id || m.path,
            name: m.filename || m.name || m.path,
            url: m.storageUrl || m.publicUrl,
            uploadedAt: m.uploadedAt,
          })) || [];
        setModels(items);
        if (paramUrl) {
          setSelectedUrl(paramUrl);
        } else {
          setSelectedUrl(items[0]?.url || "");
        }
      } catch (err) {
        console.warn("Kunne ikke hente modeller", err);
        setModels([]);
        setSelectedUrl("");
      } finally {
        setLoadingModels(false);
      }
    };
    loadModels();
  }, [projectId, paramUrl]);

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
        Logg inn for å se viewer.
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
          <a href="https://viewer.altbim.no" target="_blank" rel="noreferrer">
            <Eye className="w-4 h-4 mr-2" />
            Åpne i nytt vindu
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
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg prosjekt..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>IFC-modell</Label>
              {loadingModels ? (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Laster modeller...
                </div>
              ) : (
                <Select value={selectedUrl} onValueChange={setSelectedUrl} disabled={models.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={models.length ? "Velg IFC..." : "Ingen IFC funnet"} />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={m.url}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {selectedUrl ? (
            <div className="border rounded-lg overflow-hidden h-[75vh]">
              <iframe
                src={`https://viewer.altbim.no/?url=${encodeURIComponent(selectedUrl)}&embed=1`}
                title="IFC Viewer"
                className="w-full h-full"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Velg en IFC-fil for å vise modellen.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
