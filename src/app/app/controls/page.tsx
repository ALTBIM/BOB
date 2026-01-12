"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import LoginForm from "@/components/auth/LoginForm";
import { useSession } from "@/lib/session";
import { useActiveProject } from "@/lib/active-project";
import QualityControlDashboard from "@/components/controls/QualityControlDashboard";
import { DocumentIngestPanel } from "@/components/rag/DocumentIngestPanel";

export default function ControlsPage() {
  const { user, ready } = useSession();
  const { activeProjectId, activeProject } = useActiveProject();

  if (!user && ready) {
    return <LoginForm />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Kvalitetskontroller</CardTitle>
          <CardDescription>
            {activeProject
              ? `Kontroller og kravoppf\u00f8lging for ${activeProject.name}.`
              : "Velg prosjekt i sidemenyen for \u00e5 se kontroller."}
          </CardDescription>
        </CardHeader>
      </Card>

      <QualityControlDashboard selectedProject={activeProjectId || null} />
      {activeProjectId && <DocumentIngestPanel projectId={activeProjectId} />}
    </div>
  );
}
