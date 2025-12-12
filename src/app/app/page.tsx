"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Users, FileText, CheckCircle, Calendar, Settings, Search, AlertTriangle } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import ProjectCreationModal from "@/components/projects/ProjectCreationModal";
import ModelUpload from "@/components/bim/ModelUpload";
import ProductionDashboard from "@/components/production/ProductionDashboard";
import QualityControlDashboard from "@/components/controls/QualityControlDashboard";
import UserManagement from "@/components/auth/UserManagement";
import ProjectManagement from "@/components/admin/ProjectManagement";
import { User, Project, db, getRoleDisplayName } from "@/lib/database";
import { useSession } from "@/lib/session";

export default function HomePage() {
  const { user, ready, login, logout } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState("projects");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  useEffect(() => {
    if (ready) {
      setIsLoading(false);
    }
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
      console.error('Failed to load projects:', error);
    }
  };

  const handleLogin = (userData: User) => {
    console.log("User logged in:", userData);
    login(userData);
  };

  const handleLogout = () => {
    logout();
    setSelectedProject(null);
    console.log('User logged out');
  };

  const handleProjectCreate = (newProject: Project) => {
    setProjects(prev => [...prev, newProject]);
  };

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left - Logo */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Building2 className="h-8 w-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-slate-900">BOB</h1>
              </div>
              <Badge variant="secondary" className="text-xs">
                BIM Operations & Building Management
              </Badge>
            </div>

            {/* Center - Search */}
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="S++k prosjekter, brukere, filer..."
                  className="pl-10"
                />
              </div>
            </div>

            {/* Right - Project selector + User menu */}
            <div className="flex items-center space-x-4">
              {/* PROJECT SELECTOR DROPDOWN */}
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-slate-700">Prosjekt:</span>
                <Select value={selectedProject || ""} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Velg prosjekt...">
                      {selectedProject && projects.find(p => p.id === selectedProject)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4" />
                          <span>{project.name}</span>
                          <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="ml-2">
                            {project.status}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" size="sm" onClick={() => setActiveTab("users")}>
                <Users className="w-4 h-4 mr-2" />
                Users
              </Button>
              <Button variant="outline" size="sm" onClick={() => setActiveTab("admin")}>
                <Settings className="w-4 h-4 mr-2" />
                Admin
              </Button>
              <div className="flex items-center gap-3 min-w-[200px] justify-end">
                <div className="text-right leading-tight">
                  <p className="text-sm font-medium text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-600">{getRoleDisplayName(user.role)} - {user.company}</p>
                </div>
                <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            Velkommen til BOB
          </h2>
          <p className="text-lg text-slate-600 max-w-3xl">
            Ditt digitale verkt++y for byggeprosjekter som kobler BIM-modeller direkte til produksjon, 
            logistikk og prosjektstyring. Generer mengdelister, lag arbeidstegninger, 
            og administrer kvalitetskontroller p+Ñ ett sted.
          </p>
        </div>

        {!selectedProject && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <p className="text-yellow-800 font-medium">Ingen prosjekt valgt</p>
            </div>
            <p className="text-yellow-700 text-sm mt-1">
              Velg et prosjekt fra dropdown-menyen ++verst for +Ñ f+Ñ tilgang til BIM-modeller, produksjonsverkt++y og kontroller.
            </p>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktive Prosjekter</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projects.length}</div>
              <p className="text-xs text-muted-foreground">
                {projects.filter(p => p.status === 'active').length} aktive, {projects.filter(p => p.status === 'planning').length} planlegging
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mengdelister</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24</div>
              <p className="text-xs text-muted-foreground">Denne m+Ñneden</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kvalitetskontroller</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">8 best+Ñtt, 4 venter</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Planlagte M++ter</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5</div>
              <p className="text-xs text-muted-foreground">Neste 7 dager</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="projects">Dashboard</TabsTrigger>
            <TabsTrigger value="models" disabled={!selectedProject}>BIM Modeller</TabsTrigger>
            <TabsTrigger value="production" disabled={!selectedProject}>Produksjon</TabsTrigger>
            <TabsTrigger value="controls" disabled={!selectedProject}>Kontroller</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-slate-900">Dine Prosjekter</h3>
              <ProjectCreationModal onProjectCreate={handleProjectCreate} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <Card 
                  key={project.id} 
                  className={`hover:shadow-lg transition-shadow cursor-pointer ${
                    selectedProject === project.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedProject(project.id)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                        {project.status === 'active' ? 'Aktiv' : 'Planlegging'}
                      </Badge>
                    </div>
                    <CardDescription>
                      {project.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Fremdrift</span>
                        <span className="font-medium">{project.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            project.progress >= 80 ? 'bg-green-600' : 
                            project.progress >= 50 ? 'bg-blue-600' : 'bg-yellow-500'
                          }`} 
                          style={{ width: `${project.progress}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-sm text-slate-600">
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
              <h3 className="text-xl font-semibold text-slate-900">BIM Modeller</h3>
              {selectedProject && (
                <div className="text-sm text-slate-600">
                  Prosjekt: <span className="font-medium">{projects.find(p => p.id === selectedProject)?.name}</span>
                </div>
              )}
            </div>
            <ModelUpload selectedProject={selectedProject} />
          </TabsContent>

          <TabsContent value="production" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-slate-900">Produksjon</h3>
              {selectedProject && (
                <div className="text-sm text-slate-600">
                  Prosjekt: <span className="font-medium">{projects.find(p => p.id === selectedProject)?.name}</span>
                </div>
              )}
            </div>
            <ProductionDashboard selectedProject={selectedProject} />
          </TabsContent>

          <TabsContent value="controls" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-slate-900">Kvalitetskontroller</h3>
              {selectedProject && (
                <div className="text-sm text-slate-600">
                  Prosjekt: <span className="font-medium">{projects.find(p => p.id === selectedProject)?.name}</span>
                </div>
              )}
            </div>
            <QualityControlDashboard selectedProject={selectedProject} />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="admin" className="space-y-6">
            <ProjectManagement 
              selectedProject={selectedProject}
              onProjectSelect={setSelectedProject}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

