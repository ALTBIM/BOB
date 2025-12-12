"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { User } from "./database";

type SessionContextValue = {
  user: User | null;
  ready: boolean;
  login: (user: User) => void;
  logout: () => void;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

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

  const value = useMemo(() => ({ user, ready, login, logout }), [user, ready]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}
