"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageCircle,
  Eye,
  Folder,
  FilePlus2,
  Files,
  Box,
  Wrench,
  ShieldCheck,
  Users,
  Settings,
  Menu,
  X,
} from "lucide-react";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";

import { useDeviceType } from "@/lib/hooks/use-device-type";

const primaryNav = [
  { name: "Dashboard", href: "/app", icon: LayoutDashboard },
  { name: "BIM Modeller", href: "/app/models", icon: Box },
  { name: "Produksjon", href: "/app/production", icon: Wrench },
  { name: "Kontroller", href: "/app/controls", icon: ShieldCheck },
  { name: "Viewer", href: "/app/viewer", icon: Eye },
  { name: "Users", href: "/app/users", icon: Users },
  { name: "Admin", href: "/app/admin", icon: Settings },
  { name: "BOB Chat", href: "/app/chat", icon: MessageCircle },
];

const filesNav = [
  { name: "Filoversikt", href: "/app/files", icon: Files },
  { name: "Last opp", href: "/app/files/upload", icon: FilePlus2 },
  { name: "Modeller", href: "/app/files/models", icon: Box },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [filesOpen, setFilesOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const deviceType = useDeviceType();
  const isTouchView = deviceType !== "desktop";

  const handleNavSelection = () => {
    if (isTouchView) {
      setMobileNavOpen(false);
    }
  };

  const overlayClass = useMemo(
    () =>
      clsx(
        "fixed inset-0 z-40 md:hidden pointer-events-none transition-opacity duration-300",
        mobileNavOpen ? "opacity-100 pointer-events-auto" : "opacity-0"
      ),
    [mobileNavOpen]
  );

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("bob_sidebar_files_open") : null;
    if (saved === "true") setFilesOpen(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("bob_sidebar_files_open", filesOpen ? "true" : "false");
    }
  }, [filesOpen]);

  useEffect(() => {
    if (filesNav.some((item) => item.href === pathname)) {
      setFilesOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (!isTouchView) {
      setMobileNavOpen(false);
    }
  }, [isTouchView]);

  useEffect(() => {
    if (mobileNavOpen) {
      setMobileNavOpen(false);
    }
  }, [pathname]);

  const renderNavLinks = (onItemClick?: () => void) => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {primaryNav.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.name}</span>
          </Link>
        );
      })}

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setFilesOpen((v) => !v)}
          className={clsx(
            "flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            "text-muted-foreground hover:bg-muted"
          )}
          aria-expanded={filesOpen}
        >
          <Folder className="h-4 w-4" />
          <span className="flex-1 text-left">Filer</span>
          <span className="text-xs text-muted-foreground">{filesOpen ? "-" : "+"}</span>
        </button>
        {filesOpen && (
          <div className="mt-1 ml-3 space-y-1">
            {filesNav.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onItemClick}
                  className={clsx(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="hidden md:flex">
        <aside className="w-64 border-r border-border/70 bg-card flex flex-col">
          <div className="px-5 py-4 border-b border-border/70">
            <div className="text-lg font-semibold">BOB</div>
            <p className="text-xs text-muted-foreground mt-1">BIM &amp; Operations</p>
          </div>
          {renderNavLinks()}
          <div className="px-4 pb-4">
            <div className="rounded-lg border border-border/70 bg-muted px-3 py-2">
              <p className="text-xs text-muted-foreground">Prosjekt</p>
              <p className="text-sm font-medium">Velg i headeren</p>
            </div>
          </div>
        </aside>
      </div>

      {isTouchView && (
        <div className={overlayClass} aria-hidden={!mobileNavOpen}>
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
          <aside
            className={clsx(
              "absolute inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border/70 bg-card transition-transform duration-300 shadow-2xl",
              mobileNavOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <div>
                <div className="text-lg font-semibold">BOB</div>
                <p className="text-xs text-muted-foreground">BIM &amp; Operations</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-full border border-border/70 bg-background p-2 text-muted-foreground hover:border-primary hover:text-primary-foreground"
                aria-label="Lukk meny"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderNavLinks(handleNavSelection)}
            <div className="mt-auto px-4 pb-4">
              <div className="rounded-lg border border-border/70 bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground">Prosjekt</p>
                <p className="text-sm font-medium">Velg i headeren</p>
              </div>
            </div>
          </aside>
        </div>
      )}

      <div className="md:ml-64">
        <main className="flex-1 relative">
          {isTouchView && (
            <div className="absolute left-4 top-4 z-20 md:hidden">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-4 py-2 text-sm font-medium text-foreground backdrop-blur"
              >
                <Menu className="h-4 w-4" />
                Meny
              </button>
            </div>
          )}
          <div className="max-w-7xl mx-auto px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
