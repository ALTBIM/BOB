"use client";

import LoginForm from "@/components/auth/LoginForm";
import { useSession } from "@/lib/session";
import { useActiveProject } from "@/lib/active-project";
import ProjectManagement from "@/components/admin/ProjectManagement";
import PlatformAdminPanel from "@/components/admin/PlatformAdminPanel";
import OrganizationAdminPanel from "@/components/admin/OrganizationAdminPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminPage() {
  const { user, ready } = useSession();
  const {
    activeProjectId,
    activeProject,
    activeAccessLevel,
    activeOrgRole,
    setActiveProjectId,
    isPlatformAdmin,
    hasOrgAdmin,
  } = useActiveProject();

  if (!user && ready) {
    return <LoginForm />;
  }

  const canManageProject =
    activeAccessLevel === "admin" || isPlatformAdmin || activeOrgRole === "org_admin";
  const showPlatformAdmin = isPlatformAdmin;
  const showOrgAdmin = hasOrgAdmin || isPlatformAdmin;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin</CardTitle>
          <CardDescription>Administrer plattform, organisasjoner og prosjekter.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Tilgang styres av rollen din. Plattformadmin ser alt, organisasjonsadmin styrer eget firma,
          og prosjektadmin styrer eget prosjekt.
        </CardContent>
      </Card>

      {showPlatformAdmin && <PlatformAdminPanel />}
      {showOrgAdmin && <OrganizationAdminPanel />}

      {!activeProjectId && (
        <Card>
          <CardHeader>
            <CardTitle>Prosjektadministrasjon</CardTitle>
            <CardDescription>Velg prosjekt i sidemenyen for {"\u00e5"} administrere tilgang.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {activeProjectId && !canManageProject && (
        <Card>
          <CardHeader>
            <CardTitle>Ingen tilgang</CardTitle>
            <CardDescription>
              Du m{"\u00e5"} v{"\u00e6"}re prosjektadmin for {"\u00e5"} administrere{" "}
              {activeProject?.name || "prosjektet"}.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {activeProjectId && canManageProject && (
        <ProjectManagement selectedProject={activeProjectId} onProjectSelect={setActiveProjectId} />
      )}
    </div>
  );
}
