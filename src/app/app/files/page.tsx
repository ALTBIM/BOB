"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderOpen } from "lucide-react";
import { ProjectFiles } from "@/components/files/ProjectFiles";
import LoginForm from "@/components/auth/LoginForm";
import { useSession } from "@/lib/session";
import { db, Project, User } from "@/lib/database";

export default function FilesPage() {
  const { user, ready, login } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

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

  if (!user && ready) {
    return <LoginForm onLogin={(u: User) => login(u)} />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Filoversikt</CardTitle>
            <CardDescription>
              Prosjektsikret filarkiv. Velg prosjekt for \u00e5 se og laste opp filer.
            </CardDescription>
          </div>
          <div className="flex gap-3 items-center">
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
          </div>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          Du kan filtrere, s\u00f8ke og forh\u00e5ndsvisning styres i filoversikten under.
        </CardContent>
      </Card>

      <ProjectFiles selectedProject={selectedProject} />
    </div>
  );
}
