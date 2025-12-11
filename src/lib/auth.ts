// Authentication and session management for BOB
"use client";

import { User, db } from './database';

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  company: string;
  phone?: string;
  role: 'architect' | 'engineer' | 'contractor' | 'supplier' | 'client';
}

class AuthManager {
  private static instance: AuthManager;
  private currentUser: User | null = null;
  private listeners: ((user: User | null) => void)[] = [];

  private constructor() {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('bob_user');
      if (savedUser) {
        try {
          this.currentUser = JSON.parse(savedUser);
        } catch (error) {
          console.error('Failed to parse saved user:', error);
          localStorage.removeItem('bob_user');
        }
      }
    }
  }

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  // Subscribe to auth state changes
  subscribe(listener: (user: User | null) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentUser));
  }

  private saveUser(user: User | null) {
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('bob_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('bob_user');
      }
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  async login(credentials: LoginCredentials): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      const user = await db.authenticateUser(credentials.email, credentials.password);
      
      if (user) {
        this.currentUser = user;
        this.saveUser(user);
        this.notifyListeners();
        return { success: true, user };
      } else {
        return { success: false, error: 'Invalid email or password' };
      }
    } catch (error) {
      return { success: false, error: 'Login failed. Please try again.' };
    }
  }

  async register(data: RegisterData): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check if user already exists
      const existingUser = await db.getUserByEmail(data.email);
      if (existingUser) {
        return { success: false, error: 'User with this email already exists' };
      }

      // Create new user
      const newUser = await db.createUser({
        name: data.name,
        email: data.email,
        role: data.role,
        company: data.company,
        phone: data.phone
      });

      this.currentUser = newUser;
      this.saveUser(newUser);
      this.notifyListeners();
      return { success: true, user: newUser };
    } catch (error) {
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  }

  async logout(): Promise<void> {
    this.currentUser = null;
    this.saveUser(null);
    this.notifyListeners();
  }

  async updateProfile(updates: Partial<User>): Promise<{ success: boolean; error?: string; user?: User }> {
    if (!this.currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const updatedUser = await db.updateUser(this.currentUser.id, updates);
      if (updatedUser) {
        this.currentUser = updatedUser;
        this.saveUser(updatedUser);
        this.notifyListeners();
        return { success: true, user: updatedUser };
      } else {
        return { success: false, error: 'Failed to update profile' };
      }
    } catch (error) {
      return { success: false, error: 'Update failed. Please try again.' };
    }
  }

  // Check if user has access to a project
  async hasProjectAccess(projectId: string): Promise<boolean> {
    if (!this.currentUser) return false;

    const userProjects = await db.getProjectsForUser(this.currentUser.id);
    return userProjects.some(project => project.id === projectId);
  }

  // Get user permissions for a project
  async getProjectPermissions(projectId: string): Promise<string[]> {
    if (!this.currentUser) return [];

    return await db.getUserPermissions(this.currentUser.id, projectId);
  }

  // Check if user has specific permission for a project
  async hasPermission(projectId: string, permission: string): Promise<boolean> {
    const permissions = await this.getProjectPermissions(projectId);
    return permissions.includes(permission);
  }

  // Role-based access control
  isAdmin(): boolean {
    return this.currentUser?.role === 'super_admin' || this.currentUser?.role === 'company_admin';
  }

  isProjectAdmin(): boolean {
    return this.isAdmin() || this.currentUser?.role === 'project_admin';
  }

  canManageUsers(): boolean {
    return this.isAdmin();
  }

  canCreateProjects(): boolean {
    return this.isProjectAdmin();
  }

  canUploadModels(): boolean {
    return this.currentUser?.role !== 'client'; // All roles except client can upload
  }

  canRunControls(): boolean {
    return this.isProjectAdmin() || this.currentUser?.role === 'architect' || this.currentUser?.role === 'engineer';
  }
}

// Export singleton instance
export const authManager = AuthManager.getInstance();

// React hook for using auth in components
export const useAuth = () => {
  const [authState, setAuthState] = React.useState<AuthState>({
    user: authManager.getCurrentUser(),
    isLoading: false,
    error: null
  });

  React.useEffect(() => {
    const unsubscribe = authManager.subscribe((user) => {
      setAuthState(prev => ({ ...prev, user, error: null }));
    });

    return unsubscribe;
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    const result = await authManager.login(credentials);
    setAuthState(prev => ({ 
      ...prev, 
      isLoading: false, 
      error: result.success ? null : result.error || 'Login failed',
      user: result.user || null
    }));
    return result;
  };

  const register = async (data: RegisterData) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    const result = await authManager.register(data);
    setAuthState(prev => ({ 
      ...prev, 
      isLoading: false, 
      error: result.success ? null : result.error || 'Registration failed',
      user: result.user || null
    }));
    return result;
  };

  const logout = async () => {
    await authManager.logout();
  };

  const updateProfile = async (updates: Partial<User>) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
    const result = await authManager.updateProfile(updates);
    setAuthState(prev => ({ 
      ...prev, 
      isLoading: false, 
      error: result.success ? null : result.error || 'Update failed',
      user: result.user || prev.user
    }));
    return result;
  };

  return {
    ...authState,
    login,
    register,
    logout,
    updateProfile,
    hasProjectAccess: authManager.hasProjectAccess.bind(authManager),
    getProjectPermissions: authManager.getProjectPermissions.bind(authManager),
    hasPermission: authManager.hasPermission.bind(authManager),
    isAdmin: authManager.isAdmin.bind(authManager),
    isProjectAdmin: authManager.isProjectAdmin.bind(authManager),
    canManageUsers: authManager.canManageUsers.bind(authManager),
    canCreateProjects: authManager.canCreateProjects.bind(authManager),
    canUploadModels: authManager.canUploadModels.bind(authManager),
    canRunControls: authManager.canRunControls.bind(authManager)
  };
};

// Add React import for the hook
import React from 'react';