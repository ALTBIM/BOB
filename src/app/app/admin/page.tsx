"use client";

import LoginForm from "@/components/auth/LoginForm";
import { useSession } from "@/lib/session";
import { useActiveProject } from "@/lib/active-project";
import ProjectManagement from "@/components/admin/ProjectManagement";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminPage() {
  const { user, ready } = useSession();
  const { activeProjectId, activeProject, activeAccessLevel, setActiveProjectId } = useActiveProject();

  if (!user && ready) {
    return <LoginForm />;
  }

  if (!activeProjectId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Admin</CardTitle>
          <CardDescription>Velg prosjekt i sidemenyen for \u00e5 administrere tilgang.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (activeAccessLevel !== "admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ingen tilgang</CardTitle>
          <CardDescription>
            Du m\u00e5 v\u00e6re prosjektadmin for \u00e5 administrere {activeProject?.name || "prosjektet"}.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin</CardTitle>
          <CardDescription>Prosjektadministrasjon og tilgang for {activeProject?.name}.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Administrasjon er begrenset til prosjektets administratorer.
        </CardContent>
      </Card>

      <ProjectManagement selectedProject={activeProjectId} onProjectSelect={setActiveProjectId} />
    </div>
  );
}
