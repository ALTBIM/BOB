"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import LoginForm from "@/components/auth/LoginForm";
import { useSession } from "@/lib/session";
import { useActiveProject } from "@/lib/active-project";
import { ProjectFiles } from "@/components/files/ProjectFiles";

export default function FilesPage() {
  const { user, ready } = useSession();
  const { activeProjectId, activeProject } = useActiveProject();

  if (!user && ready) {
    return <LoginForm />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filoversikt</CardTitle>
          <CardDescription>
            {activeProject
              ? `Prosjektsikret filarkiv for ${activeProject.name}.`
              : "Velg prosjekt i sidemenyen for \u00e5 se filer."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Du kan filtrere, s\u00f8ke og forh\u00e5ndsvisning styres i filoversikten under.
        </CardContent>
      </Card>

      <ProjectFiles selectedProject={activeProjectId || null} />
    </div>
  );
}
