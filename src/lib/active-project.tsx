"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { db, type AdminContext, type Organization, type OrgMembership, type OrgRole, Project } from "@/lib/database";
import { useSession } from "@/lib/session";

type ActiveProjectContextValue = {
  projects: Project[];
  activeProjectId: string;
  activeProject: Project | null;
  activeRole: string | null;
  activeAccessLevel: "read" | "write" | "admin" | null;
  activeOrgRole: OrgRole | null;
  isPlatformAdmin: boolean;
  hasOrgAdmin: boolean;
  organizations: Organization[];
  orgMemberships: OrgMembership[];
  canSeeAdmin: boolean;
  loading: boolean;
  setActiveProjectId: (projectId: string) => void;
  refreshProjects: () => Promise<void>;
};

const ActiveProjectContext = createContext<ActiveProjectContextValue | undefined>(undefined);

const STORAGE_KEY = "bob_active_project";

export function ActiveProjectProvider({ children }: { children: React.ReactNode }) {
  const { user, ready } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminContext, setAdminContext] = useState<AdminContext>({
    isPlatformAdmin: false,
    orgMemberships: [],
    organizations: [],
  });

  const refreshProjects = async () => {
    if (!user) {
      setProjects([]);
      setActiveProjectId("");
      return;
    }
    setLoading(true);
    try {
      const [list, admin] = await Promise.all([db.getProjectsForUser(user.id), db.getAdminContext(user.id)]);
      setProjects(list);
      setAdminContext(admin);
      if (typeof window === "undefined") return;
      const currentValid = activeProjectId && list.some((p) => p.id === activeProjectId);
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const storedValid = stored && list.some((p) => p.id === stored);
      const nextId = currentValid ? activeProjectId : storedValid ? stored! : list[0]?.id || "";
      setActiveProjectId(nextId);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setProjects([]);
      setActiveProjectId("");
      setAdminContext({ isPlatformAdmin: false, orgMemberships: [], organizations: [] });
      return;
    }
    refreshProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ready]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeProjectId) {
      window.localStorage.setItem(STORAGE_KEY, activeProjectId);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [activeProjectId]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const activeMember = useMemo(() => {
    if (!activeProject || !user) return null;
    return activeProject.teamMembers.find((m) => m.userId === user.id) || activeProject.teamMembers[0] || null;
  }, [activeProject, user]);

  const activeOrgRole = useMemo(() => {
    if (!activeProject?.orgId) return null;
    const membership = adminContext.orgMemberships.find((m) => m.orgId === activeProject.orgId);
    return membership?.orgRole || null;
  }, [activeProject, adminContext.orgMemberships]);

  const hasOrgAdmin = useMemo(() => {
    return adminContext.orgMemberships.some((m) => m.orgRole === "org_admin");
  }, [adminContext.orgMemberships]);

  const canSeeAdmin = useMemo(() => {
    return adminContext.isPlatformAdmin || hasOrgAdmin || activeMember?.accessLevel === "admin";
  }, [adminContext.isPlatformAdmin, hasOrgAdmin, activeMember?.accessLevel]);

  const value = useMemo(
    () => ({
      projects,
      activeProjectId,
      activeProject,
      activeRole: activeMember?.role || null,
      activeAccessLevel: activeMember?.accessLevel || null,
      activeOrgRole,
      isPlatformAdmin: adminContext.isPlatformAdmin,
      hasOrgAdmin,
      organizations: adminContext.organizations,
      orgMemberships: adminContext.orgMemberships,
      canSeeAdmin,
      loading,
      setActiveProjectId,
      refreshProjects,
    }),
    [
      projects,
      activeProjectId,
      activeProject,
      activeMember,
      activeOrgRole,
      adminContext.isPlatformAdmin,
      adminContext.organizations,
      adminContext.orgMemberships,
      canSeeAdmin,
      hasOrgAdmin,
      loading,
    ]
  );

  return <ActiveProjectContext.Provider value={value}>{children}</ActiveProjectContext.Provider>;
}

export function useActiveProject() {
  const ctx = useContext(ActiveProjectContext);
  if (!ctx) {
    throw new Error("useActiveProject must be used within ActiveProjectProvider");
  }
  return ctx;
}
