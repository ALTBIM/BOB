"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { User } from "./database";

type SessionContextValue = {
  user: User | null;
  ready: boolean;
  login: (user: User) => void;
  logout: () => void;
  demoContentEnabled: boolean;
  setDemoContentEnabled: (value: boolean) => void;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [demoContentEnabled, setDemoContentEnabledState] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("bob_user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as User;
        setUser(parsed);
      } catch {
        localStorage.removeItem("bob_user");
      }
    }

    const demoToggle = localStorage.getItem("bob_demo_content_enabled");
    if (demoToggle) {
      setDemoContentEnabledState(demoToggle === "true");
    }
    setReady(true);
  }, []);

  const login = (u: User) => {
    setUser(u);
    if (typeof window !== "undefined") {
      localStorage.setItem("bob_user", JSON.stringify(u));
    }
  };

  const logout = () => {
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("bob_user");
    }
  };

  const value = useMemo(
    () => ({
      user,
      ready,
      login,
      logout,
      demoContentEnabled,
      setDemoContentEnabled: (value: boolean) => {
        setDemoContentEnabledState(value);
        if (typeof window !== "undefined") {
          localStorage.setItem("bob_demo_content_enabled", String(value));
        }
      }
    }),
    [demoContentEnabled, login, logout, ready, user]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}
