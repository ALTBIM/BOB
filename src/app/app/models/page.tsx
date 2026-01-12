"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2 } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import { useSession } from "@/lib/session";
import { db, Project } from "@/lib/database";
import ModelUpload from "@/components/bim/ModelUpload";

export default function ModelsPage() {
  const { user, ready } = useSession();
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
    return <LoginForm />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>BIM Modeller</CardTitle>
            <CardDescription>Last opp og administrer modeller per prosjekt.</CardDescription>
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
                        <Building2 className="w-4 h-4" />
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

      <ModelUpload selectedProject={selectedProject} />
    </div>
  );
}
