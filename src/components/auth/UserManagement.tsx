"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  UserPlus, 
  Settings, 
  Shield, 
  Building2, 
  Mail, 
  Phone, 
  Calendar,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  XCircle
} from "lucide-react";
import { User, Project, ProjectMember, UserRole, ProjectRole, Permission, db, getRoleDisplayName, getProjectRoleDisplayName } from "@/lib/database";

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    role: "contractor" as UserRole
  });

  const [newProjectMember, setNewProjectMember] = useState({
    userId: "",
    role: "viewer" as ProjectRole,
    permissions: [] as Permission[]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersData, projectsData] = await Promise.all([
        db.getUsers(),
        db.getProjects()
      ]);
      setUsers(usersData);
      setProjects(projectsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async () => {
    try {
      const user = await db.createUser({
        ...newUser,
        lastLogin: undefined
      });
      setUsers(prev => [...prev, user]);
      setNewUser({
        name: "",
        email: "",
        company: "",
        phone: "",
        role: "contractor"
      });
      setIsAddUserOpen(false);
    } catch (error) {
      console.error('Failed to add user:', error);
    }
  };

  const handleAddToProject = async () => {
    if (!selectedProject || !newProjectMember.userId) return;

    try {
      await db.addProjectMember(selectedProject, {
        userId: newProjectMember.userId,
        role: newProjectMember.role,
        permissions: getDefaultPermissions(newProjectMember.role),
        addedBy: "1" // Current user ID
      });
      
      // Reload projects to get updated team members
      const updatedProjects = await db.getProjects();
      setProjects(updatedProjects);
      
      setNewProjectMember({
        userId: "",
        role: "viewer",
        permissions: []
      });
    } catch (error) {
      console.error('Failed to add user to project:', error);
    }
  };

  const getDefaultPermissions = (role: ProjectRole): Permission[] => {
    const permissionMap: Record<ProjectRole, Permission[]> = {
      'admin': ['read', 'write', 'delete', 'manage_users', 'manage_models', 'generate_lists', 'run_controls'],
      'manager': ['read', 'write', 'manage_models', 'generate_lists', 'run_controls'],
      'designer': ['read', 'write', 'manage_models', 'generate_lists'],
      'contractor': ['read', 'generate_lists'],
      'supplier': ['read'],
      'viewer': ['read']
    };
    return permissionMap[role] || ['read'];
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    const variants: Record<UserRole, "default" | "secondary" | "destructive" | "outline"> = {
      'super_admin': 'destructive',
      'company_admin': 'destructive',
      'project_admin': 'default',
      'architect': 'default',
      'engineer': 'default',
      'contractor': 'secondary',
      'supplier': 'secondary',
      'client': 'outline'
    };
    return variants[role] || 'secondary';
  };

  const getProjectRoleBadgeVariant = (role: ProjectRole) => {
    const variants: Record<ProjectRole, "default" | "secondary" | "destructive" | "outline"> = {
      'admin': 'destructive',
      'manager': 'default',
      'designer': 'default',
      'contractor': 'secondary',
      'supplier': 'secondary',
      'viewer': 'outline'
    };
    return variants[role] || 'secondary';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('no-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const selectedProjectData = projects.find(p => p.id === selectedProject);
  const availableUsers = users.filter(user => 
    !selectedProjectData?.teamMembers.some(member => member.userId === user.id)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading user data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
          <p className="text-slate-600">Manage users, roles, and project access</p>
        </div>
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account and assign their role
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={newUser.company}
                  onChange={(e) => setNewUser({ ...newUser, company: e.target.value })}
                  placeholder="Enter company name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value as UserRole })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="architect">Architect</SelectItem>
                    <SelectItem value="engineer">Engineer</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddUser}>
                  Add User
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">All Users</TabsTrigger>
          <TabsTrigger value="projects">Project Access</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Users</CardTitle>
              <CardDescription>
                All registered users in the BOB system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900">{user.name}</h4>
                        <div className="flex items-center space-x-4 text-sm text-slate-600">
                          <div className="flex items-center space-x-1">
                            <Mail className="w-3 h-3" />
                            <span>{user.email}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Building2 className="w-3 h-3" />
                            <span>{user.company}</span>
                          </div>
                          {user.phone && (
                            <div className="flex items-center space-x-1">
                              <Phone className="w-3 h-3" />
                              <span>{user.phone}</span>
                            </div>
                          )}
                        </div>
                        {user.lastLogin && (
                          <div className="flex items-center space-x-1 text-xs text-slate-500 mt-1">
                            <Calendar className="w-3 h-3" />
                            <span>Last login: {formatDate(user.lastLogin)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {getRoleDisplayName(user.role)}
                      </Badge>
                      <div className="flex items-center space-x-1">
                        {user.isActive ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className="text-xs text-slate-500">
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Access Management</CardTitle>
              <CardDescription>
                Manage user access and roles for specific projects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="project-select">Select Project</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4" />
                          <span>{project.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProjectData && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">Project Team Members</h4>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <UserPlus className="w-4 h-4 mr-2" />
                          Add Member
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Team Member</DialogTitle>
                          <DialogDescription>
                            Add a user to {selectedProjectData.name}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="user-select">User</Label>
                            <Select value={newProjectMember.userId} onValueChange={(value) => setNewProjectMember({ ...newProjectMember, userId: value })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a user..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableUsers.map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    <div className="flex items-center space-x-2">
                                      <span>{user.name}</span>
                                      <span className="text-slate-500">({user.company})</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="project-role">Project Role</Label>
                            <Select value={newProjectMember.role} onValueChange={(value) => setNewProjectMember({ ...newProjectMember, role: value as ProjectRole })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Administrator</SelectItem>
                                <SelectItem value="manager">Project Manager</SelectItem>
                                <SelectItem value="designer">Designer</SelectItem>
                                <SelectItem value="contractor">Contractor</SelectItem>
                                <SelectItem value="supplier">Supplier</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline">Cancel</Button>
                            <Button onClick={handleAddToProject}>Add Member</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-4">
                    {selectedProjectData.teamMembers.map((member) => {
                      const user = users.find(u => u.id === member.userId);
                      if (!user) return null;

                      return (
                        <div key={member.userId} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 text-sm font-medium">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <h5 className="font-medium text-slate-900">{user.name}</h5>
                              <p className="text-sm text-slate-600">{user.company}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Badge variant={getProjectRoleBadgeVariant(member.role)}>
                              {getProjectRoleDisplayName(member.role)}
                            </Badge>
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
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}