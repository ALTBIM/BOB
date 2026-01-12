"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import LoginForm from "@/components/auth/LoginForm";
import { useSession } from "@/lib/session";
import { useActiveProject } from "@/lib/active-project";
import ProductionDashboard from "@/components/production/ProductionDashboard";

export default function ProductionPage() {
  const { user, ready } = useSession();
  const { activeProjectId, activeProject } = useActiveProject();

  if (!user && ready) {
    return <LoginForm />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Produksjon</CardTitle>
          <CardDescription>
            {activeProject
              ? `Planlegging og status for ${activeProject.name}.`
              : "Velg prosjekt i sidemenyen for \u00e5 starte."}
          </CardDescription>
        </CardHeader>
      </Card>

      <ProductionDashboard selectedProject={activeProjectId || null} />
    </div>
  );
}
