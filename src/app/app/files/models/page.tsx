"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import { useSession } from "@/lib/session";
import { useActiveProject } from "@/lib/active-project";
import { listIfcFiles } from "@/lib/storage";

interface ModelRow {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  url: string;
}

export default function ModelsPage() {
  const { user, ready } = useSession();
  const { activeProjectId, activeProject } = useActiveProject();
  const [models, setModels] = useState<ModelRow[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!activeProjectId) {
        setModels([]);
        return;
      }
      setLoadingModels(true);
      try {
        const files = await listIfcFiles(activeProjectId);
        const mapped: ModelRow[] =
          files?.map((f) => ({
            id: f.id || f.path,
            name: f.name,
            size: f.size || 0,
            uploadedAt: f.uploadedAt || "",
            uploadedBy: f.uploadedBy || "Ukjent",
            url: f.publicUrl || f.storageUrl || "",
          })) || [];
        setModels(mapped.filter((m) => m.url));
      } catch (err) {
        console.warn("Kunne ikke hente modeller", err);
        setModels([]);
      } finally {
        setLoadingModels(false);
      }
    };
    load();
  }, [activeProjectId]);

  const formatted = useMemo(
    () =>
      models.map((m) => ({
        ...m,
        sizeLabel: m.size ? `${(m.size / (1024 * 1024)).toFixed(2)} MB` : "Ukjent st\u00f8rrelse",
        dateLabel: m.uploadedAt ? new Date(m.uploadedAt).toLocaleString("nb-NO") : "Ukjent dato",
      })),
    [models]
  );

  if (!user && ready) {
    return <LoginForm />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Modeller</CardTitle>
          <CardDescription>
            {activeProject
              ? `Alle IFC-modeller for ${activeProject.name}.`
              : "Velg prosjekt i sidemenyen for \u00e5 se modeller."}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IFC-modeller</CardTitle>
          <CardDescription>Velg en modell for \u00e5 \u00e5pne den i viewer.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingModels ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Laster modeller...
            </div>
          ) : formatted.length === 0 ? (
            <div className="text-sm text-muted-foreground">Ingen modeller funnet for valgt prosjekt.</div>
          ) : (
            <div className="space-y-3">
              {formatted.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col gap-2 rounded-md border border-border/70 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.sizeLabel} - {m.dateLabel} - {m.uploadedBy}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={m.url} target="_blank" rel="noreferrer">
                        \u00c5pne i viewer <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <a href={m.url} download>
                        Last ned
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
