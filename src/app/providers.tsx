"use client";

import React from "react";
import { SessionProvider } from "@/lib/session";
import { ActiveProjectProvider } from "@/lib/active-project";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem enableColorScheme>
      <SessionProvider>
        <ActiveProjectProvider>{children}</ActiveProjectProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
