"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Calendar, CheckCircle, Search } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import ProjectCreationModal from "@/components/projects/ProjectCreationModal";
import { User, Project, db, getRoleDisplayName } from "@/lib/database";
import { useSession } from "@/lib/session";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { DocumentIngestPanel } from "@/components/rag/DocumentIngestPanel";

export default function HomePage() {
  const { user, ready, login, logout } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  useEffect(() => {
    if (ready) setIsLoading(false);
  }, [ready]);

  useEffect(() => {
    if (user) {
      loadUserProjects();
    } else {
      setProjects([]);
    }
  }, [user]);

  // Hydrate selected project from localStorage to keep selection across routes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("bob_selected_project");
    if (stored) {
      setSelectedProject(stored);
    }
  }, []);

  // Persist selection
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedProject) {
      window.localStorage.setItem("bob_selected_project", selectedProject);
    } else {
      window.localStorage.removeItem("bob_selected_project");
    }
  }, [selectedProject]);

  const loadUserProjects = async () => {
    if (!user) return;
    try {
      const userProjects = await db.getProjectsForUser(user.id);
      setProjects(userProjects);
      if (userProjects.length && !selectedProject) {
        setSelectedProject(userProjects[0].id);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  };

  const handleLogin = (userData: User) => {
    login(userData);
  };

  const handleLogout = () => {
    logout();
    setSelectedProject(null);
  };

  const handleProjectCreate = (newProject: Project) => {
    setProjects((prev) => [...prev, newProject]);
  };

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const userInitials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/80 backdrop-blur-md supports-[backdrop-filter]:bg-card/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                <h1 className="text-2xl font-semibold tracking-tight">BOB</h1>
              </div>
              <Badge variant="secondary" className="text-xs">
                BIM Operations &amp; Building Management
              </Badge>
            </div>

            <div className="flex-1 max-w-xl mx-6 hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Søk prosjekter, brukere, filer..." className="pl-10 bg-muted border-border/70" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden lg:flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Prosjekt:</span>
                <Select value={selectedProject || ""} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-64 bg-background border-border">
                    <SelectValue placeholder="Velg prosjekt...">
                      {selectedProject && projects.find((p) => p.id === selectedProject)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4" />
                          <span>{project.name}</span>
                          <Badge variant={project.status === "active" ? "default" : "secondary"} className="ml-2">
                            {project.status}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="px-3 py-1 text-xs">
                  {getRoleDisplayName(user.role)}
                </Badge>
                <div className="bg-primary/10 text-primary-foreground flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold">
                  {userInitials}
                </div>
                <ThemeToggle />
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Logg ut
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">Velkommen til BOB</h2>
          <p className="text-muted-foreground">
            Ditt digitale verktøy for byggeprosjekter som kobler BIM-modeller direkte til produksjon, logistikk og
            kvalitetskontroller.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktive prosjekter</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">{projects.length}</div>
              <p className="text-xs text-muted-foreground">
                {projects.filter((p) => p.status === "active").length} aktive,{" "}
                {projects.filter((p) => p.status === "planning").length} planlegging
              </p>
            </CardContent>
          </Card>
          <Card className="border border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mengdelister</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">24</div>
              <p className="text-xs text-muted-foreground">Denne måneden</p>
            </CardContent>
          </Card>
          <Card className="border border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kvalitetskontroller</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">12</div>
              <p className="text-xs text-muted-foreground">8 bestått, 4 venter</p>
            </CardContent>
          </Card>
          <Card className="border border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Planlagte møter</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">5</div>
              <p className="text-xs text-muted-foreground">Neste 7 dager</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-foreground">Dine prosjekter</h3>
            <ProjectCreationModal onProjectCreate={handleProjectCreate} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className={`border border-border bg-card hover:shadow-sm transition-shadow cursor-pointer ${
                  selectedProject === project.id ? "ring-1 ring-primary/60 bg-primary/5 dark:bg-primary/10" : ""
                }`}
                onClick={() => setSelectedProject(project.id)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <Badge variant={project.status === "active" ? "default" : "secondary"}>
                      {project.status === "active" ? "Aktiv" : "Planlegging"}
                    </Badge>
                  </div>
                  <CardDescription>{project.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Fremdrift</span>
                      <span className="font-medium">{project.progress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          project.progress >= 80 ? "bg-green-600" : project.progress >= 50 ? "bg-blue-600" : "bg-yellow-500"
                        }`}
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Team: {project.teamMembers.length} medlemmer</span>
                      <span>{project.location}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedProject && (
            <Card>
              <CardHeader>
                <CardTitle>Dokument- og kravinnhenting</CardTitle>
                <CardDescription>Tekstuttrekk for chat/kontroller fra prosjektets dokumenter.</CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentIngestPanel projectId={selectedProject} />
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
