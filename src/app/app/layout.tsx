"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageCircle, Eye } from "lucide-react";
import clsx from "clsx";

const navItems = [
  { name: "Dashboard", href: "/app", icon: LayoutDashboard },
  { name: "Viewer", href: "/app/viewer", icon: Eye },
  { name: "BOB Chat", href: "/app/chat", icon: MessageCircle },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="w-64 border-r border-border/70 bg-card flex flex-col">
        <div className="px-5 py-4 border-b border-border/70">
          <div className="text-lg font-semibold">BOB</div>
          <p className="text-xs text-muted-foreground mt-1">BIM &amp; Operations</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="px-4 pb-4">
          <div className="rounded-lg border border-border/70 bg-muted px-3 py-2">
            <p className="text-xs text-muted-foreground">Prosjekt</p>
            <p className="text-sm font-medium">Velg i headeren</p>
          </div>
        </div>
      </aside>
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
