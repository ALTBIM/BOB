"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import LoginForm from "@/components/auth/LoginForm";
import { useSession } from "@/lib/session";
import { useActiveProject } from "@/lib/active-project";
import ModelUpload from "@/components/bim/ModelUpload";

export default function UploadFilesPage() {
  const { user, ready } = useSession();
  const { activeProjectId, activeProject } = useActiveProject();

  if (!user && ready) {
    return <LoginForm />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Last opp filer</CardTitle>
          <CardDescription>
            {activeProject
              ? `Last opp filer til ${activeProject.name}.`
              : "Velg prosjekt i sidemenyen for \u00e5 laste opp filer."}
          </CardDescription>
        </CardHeader>
      </Card>

      <ModelUpload selectedProject={activeProjectId || null} />
    </div>
  );
}
