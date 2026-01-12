"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FolderOpen, ExternalLink } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import { useSession } from "@/lib/session";
import { db, Project } from "@/lib/database";
import { listIfcFiles } from "@/lib/storage";

interface ModelRow {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  url: string;
}

export default function ModelsPage() {
  const { user, ready } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("bob_selected_project");
    if (stored) setSelectedProject(stored);
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoadingProjects(true);
      try {
        const list = await db.getProjectsForUser(user.id);
        setProjects(list);
        if (list.length && !selectedProject) {
          setSelectedProject(list[0].id);
        }
      } catch (err) {
        console.warn("Klarte ikke hente prosjekter", err);
      } finally {
        setLoadingProjects(false);
      }
    };
    load();
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedProject) {
      window.localStorage.setItem("bob_selected_project", selectedProject);
    }
  }, [selectedProject]);

  useEffect(() => {
    const load = async () => {
      if (!selectedProject) {
        setModels([]);
        return;
      }
      setLoadingModels(true);
      try {
        const files = await listIfcFiles(selectedProject);
        const mapped: ModelRow[] =
          files?.map((f) => ({
            id: f.id || f.path,
            name: f.name,
            size: f.size || 0,
            uploadedAt: f.uploadedAt || "",
            uploadedBy: f.uploadedBy || "Ukjent",
            url: f.publicUrl || f.storageUrl || "",
          })) || [];
        setModels(mapped.filter((m) => m.url));
      } catch (err) {
        console.warn("Kunne ikke hente modeller", err);
        setModels([]);
      } finally {
        setLoadingModels(false);
      }
    };
    load();
  }, [selectedProject]);

  const formatted = useMemo(
    () =>
      models.map((m) => ({
        ...m,
        sizeLabel: m.size ? `${(m.size / (1024 * 1024)).toFixed(2)} MB` : "–",
        dateLabel: m.uploadedAt ? new Date(m.uploadedAt).toLocaleString("nb-NO") : "–",
      })),
    [models]
  );

  if (!user && ready) {
    return <LoginForm />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Modeller</CardTitle>
            <CardDescription>Alle IFC-modeller for valgt prosjekt. Åpne direkte i viewer.</CardDescription>
          </div>
          <div className="w-64">
            {loadingProjects ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Laster prosjekter...
              </div>
            ) : (
              <Select value={selectedProject || ""} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg prosjekt..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4" />
                        <span>{p.name}</span>
                        <Badge variant="outline" className="ml-1">
                          {p.status}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IFC-modeller</CardTitle>
          <CardDescription>Velg en modell for å åpne den i viewer.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingModels ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Laster modeller...
            </div>
          ) : formatted.length === 0 ? (
            <div className="text-sm text-muted-foreground">Ingen modeller funnet for valgt prosjekt.</div>
          ) : (
            <div className="space-y-3">
              {formatted.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col gap-2 rounded-md border border-border/70 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.sizeLabel} • {m.dateLabel} • {m.uploadedBy}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={m.url} target="_blank" rel="noreferrer">
                        Åpne i viewer <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <a href={m.url} download>
                        Last ned
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
