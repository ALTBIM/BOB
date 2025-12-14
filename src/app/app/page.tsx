"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle,
  ChevronDown,
  FileText,
  Search,
  Settings,
  Users,
  Eye,
} from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import ProjectCreationModal from "@/components/projects/ProjectCreationModal";
import ModelUpload from "@/components/bim/ModelUpload";
import ProductionDashboard from "@/components/production/ProductionDashboard";
import QualityControlDashboard from "@/components/controls/QualityControlDashboard";
import UserManagement from "@/components/auth/UserManagement";
import ProjectManagement from "@/components/admin/ProjectManagement";
import { User, Project, db, getRoleDisplayName } from "@/lib/database";
import { useSession } from "@/lib/session";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { DocumentIngestPanel } from "@/components/rag/DocumentIngestPanel";
import { listIfcFiles } from "@/lib/storage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function HomePage() {
  const { user, ready, login, logout } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState("projects");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [ifcFiles, setIfcFiles] = useState<{ id: string; name: string; url: string }[]>([]);
  const [selectedIfcUrl, setSelectedIfcUrl] = useState<string>("");

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

  const loadUserProjects = async () => {
    if (!user) return;
    try {
      const userProjects = await db.getProjectsForUser(user.id);
      setProjects(userProjects);
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  };

  // Load IFC files for viewer tab
  useEffect(() => {
    const loadIfc = async () => {
      if (!selectedProject) {
        setIfcFiles([]);
        setSelectedIfcUrl("");
        return;
      }
      try {
        const files = await listIfcFiles(selectedProject);
        const mapped =
          files
            ?.filter((f) => f.publicUrl)
            .map((f) => ({
              id: f.id || f.path,
              name: f.name,
              url: f.publicUrl,
            })) || [];
        setIfcFiles(mapped);
        setSelectedIfcUrl(mapped[0]?.url || "");
      } catch (err) {
        console.warn("Kunne ikke hente IFC-filer for viewer", err);
        setIfcFiles([]);
        setSelectedIfcUrl("");
      }
    };
    loadIfc();
  }, [selectedProject]);

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

  // Set a sensible default tab per rolle når prosjekt er valgt
  useEffect(() => {
    if (!user || !selectedProject) return;
    const roleDefaults: Record<User["role"], string> = {
      contractor: "production",
      supplier: "production",
      engineer: "models",
      architect: "models",
      client: "controls",
      project_admin: "admin",
      company_admin: "admin",
      super_admin: "admin",
    };
    const defaultTab = roleDefaults[user.role];
    if (defaultTab && activeTab === "projects") {
      setActiveTab(defaultTab);
    }
  }, [user, selectedProject, activeTab]);

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
                BIM Operations & Building Management
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

              <div className="hidden sm:flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/app/documents">
                    <FileText className="w-4 h-4 mr-2" />
                    Dokumenter
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setActiveTab("users")}>
                  <Users className="w-4 h-4 mr-2" />
                  Users
                </Button>
                <Button variant="outline" size="sm" onClick={() => setActiveTab("admin")}>
                  <Settings className="w-4 h-4 mr-2" />
                  Admin
                </Button>
              </div>

              <ThemeToggle />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center gap-3 rounded-full border-border bg-card/90 px-3 h-11 shadow-sm"
                  >
                    <div className="hidden sm:block text-left leading-tight max-w-[220px]">
                      <span className="block text-sm font-semibold truncate">{user.name}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {getRoleDisplayName(user.role)} • {user.company}
                      </span>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                      {userInitials || user.name.charAt(0).toUpperCase()}
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                        {userInitials || user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold leading-tight">{user.name}</div>
                        <div className="text-xs text-muted-foreground leading-tight">{user.email || "Bruker"}</div>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="flex flex-col items-start">
                    <span className="text-sm font-medium">Rolle</span>
                    <span className="text-xs text-muted-foreground">{getRoleDisplayName(user.role)}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex flex-col items-start">
                    <span className="text-sm font-medium">Selskap</span>
                    <span className="text-xs text-muted-foreground">{user.company}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex flex-col items-start" disabled={!selectedProject}>
                    <span className="text-sm font-medium">Prosjekt</span>
                    <span className="text-xs text-muted-foreground">
                      {selectedProject ? projects.find((p) => p.id === selectedProject)?.name : "Ingen valgt"}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 dark:text-red-400 font-medium"
                    onSelect={(event) => {
                      event.preventDefault();
                      handleLogout();
                    }}
                  >
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Velkommen til BOB</h2>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Ditt digitale verktøy for byggeprosjekter som kobler BIM-modeller direkte til produksjon, logistikk og
            prosjektstyring. Generer mengdelister, lag arbeidstegninger og administrer kvalitetskontroller på ett sted.
          </p>
        </div>

        {!selectedProject && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-400/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-300" />
              <p className="text-amber-800 dark:text-amber-100 font-medium">Ingen prosjekt valgt</p>
            </div>
            <p className="text-amber-700 dark:text-amber-200 text-sm mt-1">
              Velg et prosjekt fra dropdown-menyen over for å få tilgang til BIM-modeller, produksjonsverktøy og kontroller.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktive prosjekter</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">{projects.length}</div>
              <p className="text-xs text-muted-foreground">
                {projects.filter((p) => p.status === "active").length} aktive, {projects.filter((p) => p.status === "planning").length} planlegging
              </p>
            </CardContent>
          </Card>
          <Card className="border border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mengdelister</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[220px,1fr] gap-6 items-start">
            <div className="flex flex-col gap-2">
              <NavButton icon={<Building2 className="w-4 h-4" />} active={activeTab === "projects"} onClick={() => setActiveTab("projects")}>
                Dashboard
              </NavButton>
              <NavButton
                icon={<FileText className="w-4 h-4" />}
                active={activeTab === "models"}
                onClick={() => setActiveTab("models")}
                disabled={!selectedProject}
              >
                BIM Modeller
              </NavButton>
              <NavButton
                icon={<CheckCircle className="w-4 h-4" />}
                active={activeTab === "production"}
                onClick={() => setActiveTab("production")}
                disabled={!selectedProject}
              >
                Produksjon
              </NavButton>
              <NavButton
                icon={<AlertTriangle className="w-4 h-4" />}
                active={activeTab === "controls"}
                onClick={() => setActiveTab("controls")}
                disabled={!selectedProject}
              >
                Kontroller
              </NavButton>
              <NavButton icon={<Eye className="w-4 h-4" />} active={activeTab === "viewer"} onClick={() => setActiveTab("viewer")}>
                Viewer (ny)
              </NavButton>
              <NavButton icon={<Users className="w-4 h-4" />} active={activeTab === "users"} onClick={() => setActiveTab("users")}>
                Users
              </NavButton>
              <NavButton icon={<Settings className="w-4 h-4" />} active={activeTab === "admin"} onClick={() => setActiveTab("admin")}>
                Admin
              </NavButton>
            </div>

            <div className="space-y-6">

          <TabsContent value="projects" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-foreground">Dine Prosjekter</h3>
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
          </TabsContent>

          <TabsContent value="models" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-foreground">BIM Modeller</h3>
              {selectedProject && (
                <div className="text-sm text-muted-foreground">
                  Prosjekt: <span className="font-medium">{projects.find((p) => p.id === selectedProject)?.name}</span>
                </div>
              )}
            </div>
            <ModelUpload selectedProject={selectedProject} />
          </TabsContent>

          <TabsContent value="production" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-foreground">Produksjon</h3>
              {selectedProject && (
                <div className="text-sm text-muted-foreground">
                  Prosjekt: <span className="font-medium">{projects.find((p) => p.id === selectedProject)?.name}</span>
                </div>
              )}
            </div>
            <ProductionDashboard selectedProject={selectedProject} />
          </TabsContent>

          <TabsContent value="controls" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-foreground">Kvalitetskontroller</h3>
              {selectedProject && (
                <div className="text-sm text-muted-foreground">
                  Prosjekt: <span className="font-medium">{projects.find((p) => p.id === selectedProject)?.name}</span>
                </div>
              )}
            </div>
            <QualityControlDashboard selectedProject={selectedProject} />
            {selectedProject && <DocumentIngestPanel projectId={selectedProject} />}
          </TabsContent>

          <TabsContent value="viewer" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>IFC Viewer (viewer.altbim.no)</CardTitle>
                <CardDescription>
                  Sømløst innebygd viewer.altbim.no. Velg IFC fra prosjektet ditt, så åpnes den i rammen under.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!selectedProject ? (
                  <p className="text-sm text-muted-foreground">Velg et prosjekt for å vise IFC-filer.</p>
                ) : ifcFiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen IFC-filer funnet i dette prosjektet.</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-2 max-w-xl">
                      <Label>Velg IFC-fil</Label>
                      <Select value={selectedIfcUrl} onValueChange={setSelectedIfcUrl}>
                        <SelectTrigger>
                          <SelectValue placeholder="Velg IFC..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ifcFiles.map((f) => (
                            <SelectItem key={f.id} value={f.url}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedIfcUrl && (
                      <div className="border rounded-lg overflow-hidden h-[70vh]">
                        <iframe
                          src={`https://viewer.altbim.no/?url=${encodeURIComponent(selectedIfcUrl)}&embed=1`}
                          title="IFC Viewer"
                          className="w-full h-full"
                        />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="admin" className="space-y-6">
            <ProjectManagement selectedProject={selectedProject} onProjectSelect={setSelectedProject} />
          </TabsContent>
            </div>
          </div>
        </Tabs>
      </main>
    </div>
  );
}

function NavButton({
  children,
  icon,
  active,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      variant={active ? "default" : "ghost"}
      className="justify-start gap-2 w-full"
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span>{children}</span>
    </Button>
  );
}

