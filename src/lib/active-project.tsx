"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { db, Project } from "@/lib/database";
import { useSession } from "@/lib/session";

type ActiveProjectContextValue = {
  projects: Project[];
  activeProjectId: string;
  activeProject: Project | null;
  activeRole: string | null;
  activeAccessLevel: "read" | "write" | "admin" | null;
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

  const refreshProjects = async () => {
    if (!user) {
      setProjects([]);
      setActiveProjectId("");
      return;
    }
    setLoading(true);
    try {
      const list = await db.getProjectsForUser(user.id);
      setProjects(list);
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

  const value = useMemo(
    () => ({
      projects,
      activeProjectId,
      activeProject,
      activeRole: activeMember?.role || null,
      activeAccessLevel: activeMember?.accessLevel || null,
      loading,
      setActiveProjectId,
      refreshProjects,
    }),
    [projects, activeProjectId, activeProject, activeMember, loading]
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
