"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Building2, 
  Users, 
  FileText, 
  Settings, 
  Edit, 
  Trash2, 
  Plus,
  Eye,
  UserPlus,
  Upload,
  Download
} from "lucide-react";
import { Project, User, BIMModel, ProjectStatus, ProjectType, db } from "@/lib/database";

interface ProjectManagementProps {
  selectedProject: string | null;
  onProjectSelect: (projectId: string) => void;
}

export default function ProjectManagement({ selectedProject, onProjectSelect }: ProjectManagementProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [models, setModels] = useState<BIMModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    status: "planning" as ProjectStatus,
    type: "residential" as ProjectType,
    client: "",
    location: "",
    progress: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [projectsData, usersData, modelsData] = await Promise.all([
        db.getProjects(),
        db.getUsers(),
        db.getBIMModels()
      ]);
      setProjects(projectsData);
      setUsers(usersData);
      setModels(modelsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async () => {
    try {
      const project = await db.createProject({
        ...newProject,
        createdBy: "1" // Current user ID
      });
      setProjects(prev => [...prev, project]);
      setNewProject({
        name: "",
        description: "",
        status: "planning",
        type: "residential",
        client: "",
        location: "",
        progress: 0
      });
      setIsCreateOpen(false);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const getProjectModels = (projectId: string) => {
    return models.filter(model => model.projectId === projectId);
  };

  const getProjectTeamSize = (project: Project) => {
    return project.teamMembers.length;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('no-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const selectedProjectData = projects.find(p => p.id === selectedProject);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading project data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Project Management</h2>
          <p className="text-slate-600">Manage projects, users, and files</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Set up a new construction project with team access and file management
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="Enter project name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Input
                  id="client"
                  value={newProject.client}
                  onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                  placeholder="Client name"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Project description"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Project Type</Label>
                <Select value={newProject.type} onValueChange={(value) => setNewProject({ ...newProject, type: value as ProjectType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="infrastructure">Infrastructure</SelectItem>
                    <SelectItem value="renovation">Renovation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={newProject.location}
                  onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                  placeholder="Project location"
                />
              </div>
              <div className="col-span-2 flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateProject}>
                  Create Project
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Project Details</TabsTrigger>
          <TabsTrigger value="team">Team & Access</TabsTrigger>
          <TabsTrigger value="files">Files & Models</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card 
                key={project.id} 
                className={`hover:shadow-lg transition-all cursor-pointer ${
                  selectedProject === project.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                }`}
                onClick={() => onProjectSelect(project.id)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <CardDescription className="mt-1">{project.description}</CardDescription>
                    </div>
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-2" />
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div>
                      <div className="font-semibold">{getProjectTeamSize(project)}</div>
                      <div className="text-slate-500">Team</div>
                    </div>
                    <div>
                      <div className="font-semibold">{getProjectModels(project.id).length}</div>
                      <div className="text-slate-500">Models</div>
                    </div>
                    <div>
                      <div className="font-semibold">{project.type}</div>
                      <div className="text-slate-500">Type</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 space-y-1">
                    <div>Client: {project.client}</div>
                    <div>Location: {project.location}</div>
                    <div>Created: {formatDate(project.createdAt)}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          {selectedProjectData ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>{selectedProjectData.name}</CardTitle>
                    <CardDescription>Project details and configuration</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Project Name</Label>
                      <p className="text-slate-900">{selectedProjectData.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Description</Label>
                      <p className="text-slate-600">{selectedProjectData.description}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Client</Label>
                      <p className="text-slate-900">{selectedProjectData.client}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Status</Label>
                      <div className="flex items-center space-x-2">
                        <Badge variant={selectedProjectData.status === 'active' ? 'default' : 'secondary'}>
                          {selectedProjectData.status}
                        </Badge>
                        <span className="text-slate-600">{selectedProjectData.progress}% complete</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Type</Label>
                      <p className="text-slate-900 capitalize">{selectedProjectData.type}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Location</Label>
                      <p className="text-slate-900">{selectedProjectData.location}</p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{getProjectTeamSize(selectedProjectData)}</div>
                      <div className="text-sm text-slate-600">Team Members</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{getProjectModels(selectedProjectData.id).length}</div>
                      <div className="text-sm text-slate-600">BIM Models</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-orange-600">0</div>
                      <div className="text-sm text-slate-600">Open Findings</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">0</div>
                      <div className="text-sm text-slate-600">Cutting Lists</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="font-medium text-slate-900 mb-2">No Project Selected</h3>
                <p className="text-slate-600">Select a project from the overview to view details</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          {selectedProjectData ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>Manage user access and roles for {selectedProjectData.name}</CardDescription>
                  </div>
                  <Button size="sm">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Member
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedProjectData.teamMembers.map((member) => {
                    const user = users.find(u => u.id === member.userId);
                    if (!user) return null;

                    return (
                      <div key={member.userId} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-medium">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-medium text-slate-900">{user.name}</h4>
                            <div className="text-sm text-slate-600">{user.company}</div>
                            <div className="text-xs text-slate-500">
                              Added {formatDate(member.addedAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge variant="default">{member.role}</Badge>
                          <div className="text-xs text-slate-500">
                            {member.permissions.length} permissions
                          </div>
                          <Button variant="outline" size="sm">
                            <Settings className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="font-medium text-slate-900 mb-2">No Project Selected</h3>
                <p className="text-slate-600">Select a project to manage team members</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="files" className="space-y-6">
          {selectedProjectData ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Project Files</CardTitle>
                    <CardDescription>BIM models and documents for {selectedProjectData.name}</CardDescription>
                  </div>
                  <Button size="sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload File
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {getProjectModels(selectedProjectData.id).map((model) => (
                    <div key={model.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <FileText className="w-8 h-8 text-blue-500" />
                        <div>
                          <h4 className="font-medium text-slate-900">{model.name}</h4>
                          <div className="text-sm text-slate-600">
                            {(model.size / 1024 / 1024).toFixed(1)} MB • {model.filename}
                          </div>
                          <div className="text-xs text-slate-500">
                            Uploaded {formatDate(model.uploadedAt)} by {users.find(u => u.id === model.uploadedBy)?.name}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right text-sm">
                          <div className="font-medium">{model.objects} objects</div>
                          <div className="text-slate-500">{model.zones} zones</div>
                        </div>
                        <Badge variant={model.status === 'completed' ? 'default' : 'secondary'}>
                          {model.status}
                        </Badge>
                        <div className="flex items-center space-x-1">
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {getProjectModels(selectedProjectData.id).length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                      <p>No files uploaded to this project yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="font-medium text-slate-900 mb-2">No Project Selected</h3>
                <p className="text-slate-600">Select a project to manage files and models</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}