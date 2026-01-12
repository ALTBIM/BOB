"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import type { UserRole } from "@/lib/database";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  company?: string;
};

type SessionContextValue = {
  user: SessionUser | null;
  ready: boolean;
  accessToken: string | null;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithMagicLink: (email: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
};

const DEFAULT_ROLE: UserRole = "byggherre";
const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function toSessionUser(user: SupabaseUser | null): SessionUser | null {
  if (!user) return null;
  const meta = (user.user_metadata || {}) as Record<string, string>;
  const name = meta.full_name || meta.name || user.email?.split("@")[0] || "Ukjent bruker";
  return {
    id: user.id,
    email: user.email || "",
    name,
    role: (meta.role as UserRole) || DEFAULT_ROLE,
    company: meta.company || undefined,
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setReady(true);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(toSessionUser(data.session?.user ?? null));
      setAccessToken(data.session?.access_token ?? null);
      setReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(toSessionUser(session?.user ?? null));
      setAccessToken(session?.access_token ?? null);
      setReady(true);
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { error: "Supabase ikke konfigurert." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signInWithMagicLink = async (email: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { error: "Supabase ikke konfigurert." };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    if (error) return { error: error.message };
    return {};
  };

  const logout = async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const value = useMemo(
    () => ({
      user,
      ready,
      accessToken,
      signInWithPassword,
      signInWithMagicLink,
      logout,
    }),
    [accessToken, logout, ready, user]
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
