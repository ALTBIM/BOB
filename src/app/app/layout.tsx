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
  FileText,
  Image,
} from "lucide-react";
import clsx from "clsx";
import { Fragment, useEffect, useMemo, useState, type ReactElement } from "react";

import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import ProjectSelector from "@/components/layout/ProjectSelector";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useSession } from "@/lib/session";
import { useActiveProject } from "@/lib/active-project";

const primaryNav = [
  { name: "BOB Chat", href: "/app/chat", icon: MessageCircle },
  { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { name: "BIM Modeller", href: "/app/models", icon: Box },
  { name: "Produksjon", href: "/app/production", icon: Wrench },
  { name: "Kontroller", href: "/app/controls", icon: ShieldCheck },
  { name: "Viewer", href: "/app/viewer", icon: Eye },
  { name: "Users", href: "/app/users", icon: Users },
  { name: "Admin", href: "/app/admin", icon: Settings },
];

const filesNav = [
  { name: "Filoversikt", href: "/app/files", icon: Files },
  { name: "Last opp", href: "/app/files/upload", icon: FilePlus2 },
  { name: "Modeller", href: "/app/files/models", icon: Box },
];

const productionNav = [
  { name: "Mengdelister", href: "/app/production?tab=quantities", icon: FileText, tab: "quantities" },
  { name: "Tegningsproduksjon", href: "/app/production?tab=drawings", icon: Image, tab: "drawings" },
  { name: "IFC Kontroll", href: "/app/production?tab=control", icon: ShieldCheck, tab: "control" },
  { name: "Dokumenter", href: "/app/production?tab=files", icon: Files, tab: "files" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [filesOpen, setFilesOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [productionTab, setProductionTab] = useState<string | null>(null);
  const { user, logout } = useSession();
  const { canSeeAdmin } = useActiveProject();

  const navItems = useMemo(() => {
    if (canSeeAdmin) return primaryNav;
    return primaryNav.filter((item) => item.href !== "/app/admin");
  }, [canSeeAdmin]);

  const handleNavSelection = () => {
    setMobileNavOpen(false);
  };

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
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setProductionTab(params.get("tab"));
  }, [pathname]);

  useEffect(() => {
    if (mobileNavOpen) {
      setMobileNavOpen(false);
    }
  }, [pathname]);

  const renderNavLinks = (onItemClick?: () => void, closeOnNavigate?: boolean) => (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {navItems.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        const linkNode: ReactElement = (
          <Link
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
        const node = closeOnNavigate ? (
          <SheetClose key={item.href} asChild>
            {linkNode}
          </SheetClose>
        ) : (
          <Fragment key={item.href}>{linkNode}</Fragment>
        );

        if (item.name !== "Produksjon") return node;

        return (
          <Fragment key={item.href}>
            {node}
            <div className="mt-1 ml-3 space-y-1">
              {productionNav.map((child) => {
                const childActive = pathname === "/app/production" && productionTab === child.tab;
                const ChildIcon = child.icon;
                const childLink: ReactElement = (
                  <Link
                    href={child.href}
                    onClick={onItemClick}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                      childActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <ChildIcon className="h-4 w-4" />
                    <span>{child.name}</span>
                  </Link>
                );
                return closeOnNavigate ? (
                  <SheetClose key={child.href} asChild>
                    {childLink}
                  </SheetClose>
                ) : (
                  <Fragment key={child.href}>{childLink}</Fragment>
                );
              })}
            </div>
          </Fragment>
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
                const linkNode: ReactElement = (
                  <Link
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
                return closeOnNavigate ? (
                  <SheetClose key={item.href} asChild>
                    {linkNode}
                  </SheetClose>
                ) : (
                  <Fragment key={item.href}>{linkNode}</Fragment>
                );
              })}
            </div>
          )}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <div className="fixed left-4 top-4 z-30 lg:hidden">
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-4 py-2 text-sm font-medium text-foreground backdrop-blur"
            >
              <Menu className="h-4 w-4" />
              Meny
            </button>
          </SheetTrigger>
        </div>
        <SheetContent side="left" className="px-0">
          <SheetHeader className="border-b border-border/70 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">BOB</div>
                <p className="text-xs text-muted-foreground">BIM &amp; Operations</p>
              </div>
              <SheetClose asChild>
                <button
                  type="button"
                  className="rounded-full border border-border/70 bg-background p-2 text-muted-foreground hover:border-primary hover:text-primary-foreground"
                  aria-label="Lukk meny"
                >
                  X
                </button>
              </SheetClose>
            </div>
          </SheetHeader>
          <div className="px-5 py-3 border-b border-border/70">
            <ProjectSelector />
          </div>
          {renderNavLinks(handleNavSelection, true)}
          <SheetFooter className="border-t border-border/70 px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <ThemeToggle />
              {user && (
                <Button variant="outline" size="sm" onClick={() => logout()}>
                  Logg ut
                </Button>
              )}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border/70 bg-card/60">
        <div className="px-5 py-4 border-b border-border/70">
          <div className="text-lg font-semibold">BOB</div>
          <p className="text-xs text-muted-foreground">BIM &amp; Operations</p>
        </div>
        <div className="px-5 py-3 border-b border-border/70">
          <ProjectSelector />
        </div>
        {renderNavLinks()}
        <div className="mt-auto px-5 py-4 border-t border-border/70 flex items-center justify-between">
          <ThemeToggle />
          {user && (
            <Button variant="outline" size="sm" onClick={() => logout()}>
              Logg ut
            </Button>
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <main className="max-w-7xl mx-auto px-6 pt-20 pb-6 lg:pt-10">{children}</main>
      </div>
    </div>
  );
}
