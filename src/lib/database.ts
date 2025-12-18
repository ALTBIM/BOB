// Database abstraction layer for BOB
// This provides a clean interface for data operations

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company: string;
  phone?: string;
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  client?: string;
  location?: string;
  type: ProjectType;
  createdAt: string;
  createdBy: string;
  teamMembers: ProjectMember[];
}

export interface ProjectMember {
  userId: string;
  projectId: string;
  role: ProjectRole;
  permissions: Permission[];
  addedAt: string;
  addedBy: string;
}

export interface BIMModel {
  id: string;
  name: string;
  filename: string;
  size: number;
  projectId: string;
  uploadedBy: string;
  uploadedAt: string;
  status: ModelStatus;
  objects?: number;
  zones?: number;
  materials?: number;
  storageUrl?: string;
  version: number;
  description?: string;
}

// Enums for type safety
export type UserRole = 'super_admin' | 'company_admin' | 'project_admin' | 'architect' | 'engineer' | 'contractor' | 'supplier' | 'client';
export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type ProjectType = 'residential' | 'commercial' | 'industrial' | 'infrastructure' | 'renovation';
export type ProjectRole = 'admin' | 'manager' | 'designer' | 'contractor' | 'supplier' | 'viewer';
export type Permission = 'read' | 'write' | 'delete' | 'manage_users' | 'manage_models' | 'generate_lists' | 'run_controls';
export type ModelStatus = 'uploading' | 'processing' | 'completed' | 'error';

// Mock database implementation
class MockDatabase {
  private storageKey = 'bob_mock_users';
  private storageHydrated = false;
  private credentials: Record<string, { password: string; userId: string }> = {
    'admin@bob.no': { password: 'bobadmin', userId: 'admin-1' }
  };
  private users: User[] = [
    {
      id: 'admin-1',
      name: 'BOB Administrator',
      email: 'admin@bob.no',
      role: 'super_admin',
      company: 'ALTBIM',
      phone: '+47 000 00 000',
      createdAt: '2024-01-01T00:00:00Z',
      lastLogin: '2024-01-10T08:00:00Z',
      isActive: true
    },
    {
      id: '1',
      name: 'Andreas Hansen',
      email: 'andreas@altbim.no',
      role: 'company_admin',
      company: 'AltBIM Solutions AS',
      phone: '+47 123 45 678',
      createdAt: '2024-01-01T00:00:00Z',
      lastLogin: '2024-01-15T10:30:00Z',
      isActive: true
    },
    {
      id: '2',
      name: 'Erik Hansen',
      email: 'erik@drammen-sykehus.no',
      role: 'architect',
      company: 'Drammen Arkitekter AS',
      phone: '+47 987 65 432',
      createdAt: '2024-01-02T00:00:00Z',
      lastLogin: '2024-01-15T08:15:00Z',
      isActive: true
    },
    {
      id: '3',
      name: 'Maria Olsen',
      email: 'maria@byggmester.no',
      role: 'contractor',
      company: 'Byggmester Olsen AS',
      phone: '+47 555 12 345',
      createdAt: '2024-01-03T00:00:00Z',
      lastLogin: '2024-01-14T16:45:00Z',
      isActive: true
    }
  ];

  private projects: Project[] = [
    {
      id: 'project-1',
      name: 'Nye Drammen Sykehus',
      description: 'Hospital construction project with advanced BIM integration',
      status: 'active',
      progress: 65,
      client: 'Drammen Kommune',
      location: 'Drammen, Norway',
      type: 'infrastructure',
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: '1',
      teamMembers: [
        {
          userId: '1',
          projectId: 'project-1',
          role: 'admin',
          permissions: ['read', 'write', 'delete', 'manage_users', 'manage_models', 'generate_lists', 'run_controls'],
          addedAt: '2024-01-01T00:00:00Z',
          addedBy: '1'
        },
        {
          userId: '2',
          projectId: 'project-1',
          role: 'designer',
          permissions: ['read', 'write', 'manage_models', 'generate_lists'],
          addedAt: '2024-01-02T00:00:00Z',
          addedBy: '1'
        },
        {
          userId: '3',
          projectId: 'project-1',
          role: 'contractor',
          permissions: ['read', 'generate_lists'],
          addedAt: '2024-01-03T00:00:00Z',
          addedBy: '1'
        }
      ]
    },
    {
      id: 'project-2',
      name: 'Fornebu Office Complex',
      description: 'Modern office building with sustainable design',
      status: 'planning',
      progress: 25,
      client: 'Green Office Solutions',
      location: 'Fornebu, Norway',
      type: 'commercial',
      createdAt: '2024-01-05T00:00:00Z',
      createdBy: '1',
      teamMembers: [
        {
          userId: '1',
          projectId: 'project-2',
          role: 'admin',
          permissions: ['read', 'write', 'delete', 'manage_users', 'manage_models', 'generate_lists', 'run_controls'],
          addedAt: '2024-01-05T00:00:00Z',
          addedBy: '1'
        }
      ]
    },
    {
      id: 'project-3',
      name: 'Bergen Residential Tower',
      description: 'High-rise residential building project',
      status: 'active',
      progress: 80,
      client: 'Bergen Bolig AS',
      location: 'Bergen, Norway',
      type: 'residential',
      createdAt: '2024-01-10T00:00:00Z',
      createdBy: '1',
      teamMembers: [
        {
          userId: '1',
          projectId: 'project-3',
          role: 'admin',
          permissions: ['read', 'write', 'delete', 'manage_users', 'manage_models', 'generate_lists', 'run_controls'],
          addedAt: '2024-01-10T00:00:00Z',
          addedBy: '1'
        },
        {
          userId: '3',
          projectId: 'project-3',
          role: 'contractor',
          permissions: ['read', 'generate_lists'],
          addedAt: '2024-01-11T00:00:00Z',
          addedBy: '1'
        }
      ]
    }
  ];

  private bimModels: BIMModel[] = [
    {
      id: 'model-1',
      name: 'Hospital Floor 1-3',
      filename: 'Hospital_Floor_1-3.ifc',
      size: 45000000,
      projectId: 'project-1',
      uploadedBy: '2',
      uploadedAt: '2024-01-15T10:30:00Z',
      status: 'completed',
      objects: 3420,
      zones: 24,
      materials: 156,
      version: 1,
      description: 'Main hospital floors with patient rooms and facilities'
    },
    {
      id: 'model-2',
      name: 'Hospital Structure',
      filename: 'Hospital_Structure.ifc',
      size: 28000000,
      projectId: 'project-1',
      uploadedBy: '2',
      uploadedAt: '2024-01-14T14:20:00Z',
      status: 'completed',
      objects: 1850,
      zones: 12,
      materials: 89,
      version: 1,
      description: 'Structural elements and load-bearing components'
    },
    {
      id: 'model-3',
      name: 'Office Building Complete',
      filename: 'Office_Building_Complete.ifc',
      size: 52000000,
      projectId: 'project-2',
      uploadedBy: '1',
      uploadedAt: '2024-01-12T09:15:00Z',
      status: 'completed',
      objects: 4200,
      zones: 18,
      materials: 203,
      version: 1,
      description: 'Complete office building model with all systems'
    },
    {
      id: 'model-4',
      name: 'Residential Tower Floors 1-10',
      filename: 'Residential_Tower_Floors_1-10.ifc',
      size: 38000000,
      projectId: 'project-3',
      uploadedBy: '1',
      uploadedAt: '2024-01-10T16:45:00Z',
      status: 'completed',
      objects: 2890,
      zones: 30,
      materials: 145,
      version: 1,
      description: 'Residential floors with apartments and common areas'
    }
  ];

  private hydrateFromStorage() {
    this.storageHydrated = true;
  }

  private persistUsers() {
    // Persistence disabled to avoid carrying over demo users between sessions
  }

  // User operations
  async getUsers(): Promise<User[]> {
    this.hydrateFromStorage();
    return [...this.users];
  }

  async getUserById(id: string): Promise<User | null> {
    this.hydrateFromStorage();
    return this.users.find(user => user.id === id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    this.hydrateFromStorage();
    return this.users.find(user => user.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'isActive'>): Promise<User> {
    this.hydrateFromStorage();
    const newUser: User = {
      ...userData,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isActive: true
    };
    this.users.push(newUser);
    this.persistUsers();
    return newUser;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    this.hydrateFromStorage();
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) return null;

    this.users[userIndex] = { ...this.users[userIndex], ...updates };
    this.persistUsers();
    return this.users[userIndex];
  }

  // Project operations
  async getProjects(): Promise<Project[]> {
    return [...this.projects];
  }

  async getProjectById(id: string): Promise<Project | null> {
    return this.projects.find(project => project.id === id) || null;
  }

  async getProjectsForUser(userId: string): Promise<Project[]> {
    return this.projects.filter(project => 
      project.teamMembers.some(member => member.userId === userId)
    );
  }

  async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'teamMembers'>): Promise<Project> {
    const newProject: Project = {
      ...projectData,
      id: `project-${Date.now()}`,
      createdAt: new Date().toISOString(),
      teamMembers: [
        {
          userId: projectData.createdBy,
          projectId: `project-${Date.now()}`,
          role: 'admin',
          permissions: ['read', 'write', 'delete', 'manage_users', 'manage_models', 'generate_lists', 'run_controls'],
          addedAt: new Date().toISOString(),
          addedBy: projectData.createdBy
        }
      ]
    };
    this.projects.push(newProject);
    return newProject;
  }

  async addProjectMember(projectId: string, member: Omit<ProjectMember, 'projectId' | 'addedAt'>): Promise<ProjectMember | null> {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return null;

    const newMember: ProjectMember = {
      ...member,
      projectId,
      addedAt: new Date().toISOString()
    };

    project.teamMembers.push(newMember);
    return newMember;
  }

  async getUserPermissions(userId: string, projectId: string): Promise<Permission[]> {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return [];

    const member = project.teamMembers.find(m => m.userId === userId);
    return member?.permissions || [];
  }

  // BIM Model operations
  async getBIMModels(): Promise<BIMModel[]> {
    return [...this.bimModels];
  }

  async getBIMModelsByProject(projectId: string): Promise<BIMModel[]> {
    return this.bimModels.filter(model => model.projectId === projectId);
  }

  async createBIMModel(modelData: Omit<BIMModel, 'id' | 'uploadedAt' | 'version'>): Promise<BIMModel> {
    const newModel: BIMModel = {
      ...modelData,
      id: `model-${Date.now()}`,
      uploadedAt: new Date().toISOString(),
      version: 1
    };
    this.bimModels.push(newModel);
    return newModel;
  }

  async updateBIMModel(id: string, updates: Partial<BIMModel>): Promise<BIMModel | null> {
    const modelIndex = this.bimModels.findIndex(model => model.id === id);
    if (modelIndex === -1) return null;
    
    this.bimModels[modelIndex] = { ...this.bimModels[modelIndex], ...updates };
    return this.bimModels[modelIndex];
  }

  // Authentication
  async authenticateUser(email: string, password: string): Promise<User | null> {
    this.hydrateFromStorage();
    const normalizedEmail = email.toLowerCase();
    const credentials = this.credentials[normalizedEmail];

    if (!credentials || credentials.password !== password) {
      return null;
    }

    const user = await this.getUserByEmail(email);
    if (!user || !user.isActive) {
      return null;
    }

    const updatedUser = await this.updateUser(user.id, { lastLogin: new Date().toISOString() });
    return updatedUser;
  }
}

// Export singleton instance
export const db = new MockDatabase();

// Helper functions for role and permission checking
export const hasPermission = (userPermissions: Permission[], requiredPermission: Permission): boolean => {
  return userPermissions.includes(requiredPermission);
};

export const canAccessProject = (user: User, project: Project): boolean => {
  return project.teamMembers.some(member => member.userId === user.id);
};

export const getRoleDisplayName = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    'super_admin': 'Super Administrator',
    'company_admin': 'Company Administrator',
    'project_admin': 'Project Administrator',
    'architect': 'Architect',
    'engineer': 'Engineer',
    'contractor': 'Contractor',
    'supplier': 'Supplier',
    'client': 'Client'
  };
  return roleNames[role];
};

export const getProjectRoleDisplayName = (role: ProjectRole): string => {
  const roleNames: Record<ProjectRole, string> = {
    'admin': 'Administrator',
    'manager': 'Project Manager',
    'designer': 'Designer',
    'contractor': 'Contractor',
    'supplier': 'Supplier',
    'viewer': 'Viewer'
  };
  return roleNames[role];
};
