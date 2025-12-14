"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, FolderOpen, Loader2, ShieldCheck } from "lucide-react";
import { ProjectFiles } from "@/components/files/ProjectFiles";
import LoginForm from "@/components/auth/LoginForm";
import { useSession } from "@/lib/session";
import { db, Project, User } from "@/lib/database";

export default function DocumentsPage() {
  const { user, ready, login } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

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

  if (!user) {
    return <LoginForm onLogin={(u: User) => login(u)} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/80 backdrop-blur-md supports-[backdrop-filter]:bg-card/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight">BOB Dokumenter</h1>
                  <Badge variant="secondary">Prosjektsikret</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Filarkiv per prosjekt med automatisk kategorisering og tekstuttrekk
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild size="sm">
                <Link href="/app">Tilbake til dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <div>
            <h2 className="text-3xl font-bold mb-2">Prosjekt-dokumenter</h2>
            <p className="text-muted-foreground">
              Last opp IFC, PDF, DOCX, bilder og regneark. Vi trekker ut tekst og krav fra dokumenter slik at chat og
              kontroller kan bruke dem.
            </p>
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tilgang og sikkerhet</CardTitle>
              <CardDescription>Kun prosjektmedlemmer kan se filene. Admin ser alle i sitt selskap.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <ShieldCheck className="w-10 h-10 text-emerald-500" />
              <div className="text-sm text-muted-foreground">
                Dataen lagres i Supabase med RLS. Fil-tekst lagres per prosjekt for chat og kravoversikt.
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Velg prosjekt</CardTitle>
              <CardDescription>Du ser kun filer for valgt prosjekt.</CardDescription>
            </div>
            <div className="w-72">
              {loadingProjects ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Laster prosjekter...
                </div>
              ) : projects.length ? (
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
              ) : (
                <div className="text-sm text-destructive">Ingen prosjekter funnet.</div>
              )}
            </div>
          </CardHeader>
        </Card>

        <ProjectFiles selectedProject={selectedProject} />
      </main>
    </div>
  );
}
