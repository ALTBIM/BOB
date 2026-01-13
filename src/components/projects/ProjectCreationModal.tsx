"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Calendar, MapPin, Users } from "lucide-react";
import { db, ProjectType } from "@/lib/database";
import { useSession } from "@/lib/session";

interface ProjectCreationModalProps {
  onProjectCreate: (project: any) => void;
}

export default function ProjectCreationModal({ onProjectCreate }: ProjectCreationModalProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useSession();
  const [projectData, setProjectData] = useState({
    name: "",
    description: "",
    type: "",
    location: "",
    startDate: "",
    endDate: "",
    budget: "",
    client: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Du m\u00e5 v\u00e6re logget inn for \u00e5 opprette prosjekt.");
      return;
    }
    if (!projectData.name.trim()) {
      setError("Prosjektnavn er p\u00e5krevd.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const resolvedType = (projectData.type as ProjectType) || "commercial";
      const newProject = await db.createProject({
        name: projectData.name.trim(),
        description: projectData.description.trim(),
        status: "planning",
        progress: 0,
        client: projectData.client.trim(),
        location: projectData.location.trim(),
        type: resolvedType,
        createdBy: user.id,
      });

      onProjectCreate(newProject);
      setOpen(false);
      setProjectData({
        name: "",
        description: "",
        type: "",
        location: "",
        startDate: "",
        endDate: "",
        budget: "",
        client: ""
      });
    } catch (err: any) {
      console.error("Kunne ikke opprette prosjekt", err);
      setError(err?.message || "Kunne ikke opprette prosjekt. Pr\u00f8v igjen.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Building2 className="h-4 w-4 mr-2" />
          Nytt prosjekt
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Opprett nytt prosjekt</DialogTitle>
          <DialogDescription>
            Opprett et prosjekt og inviter teamet etterp\u00e5.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Prosjektnavn *</Label>
              <Input
                id="project-name"
                placeholder="f.eks. Nye Drammen Sykehus"
                value={projectData.name}
                onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-type">Prosjekttype</Label>
              <Select value={projectData.type} onValueChange={(value) => setProjectData({ ...projectData, type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Bolig</SelectItem>
                  <SelectItem value="commercial">N\u00e6ring</SelectItem>
                  <SelectItem value="industrial">Industri</SelectItem>
                  <SelectItem value="infrastructure">Infrastruktur</SelectItem>
                  <SelectItem value="renovation">Rehab</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Beskrivelse</Label>
            <Textarea
              id="project-description"
              placeholder="Kort beskrivelse av prosjektet..."
              value={projectData.description}
              onChange={(e) => setProjectData({ ...projectData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project-location">Lokasjon</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="project-location"
                  placeholder="Sted"
                  className="pl-10"
                  value={projectData.location}
                  onChange={(e) => setProjectData({ ...projectData, location: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-client">Oppdragsgiver</Label>
              <div className="relative">
                <Users className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="project-client"
                  placeholder="Kunde"
                  className="pl-10"
                  value={projectData.client}
                  onChange={(e) => setProjectData({ ...projectData, client: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Startdato</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="start-date"
                  type="date"
                  className="pl-10"
                  value={projectData.startDate}
                  onChange={(e) => setProjectData({ ...projectData, startDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Forventet slutt</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="end-date"
                  type="date"
                  className="pl-10"
                  value={projectData.endDate}
                  onChange={(e) => setProjectData({ ...projectData, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-budget">Budsjett (valgfritt)</Label>
            <Input
              id="project-budget"
              placeholder="f.eks. 5 000 000 NOK"
              value={projectData.budget}
              onChange={(e) => setProjectData({ ...projectData, budget: e.target.value })}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Oppretter..." : "Opprett prosjekt"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
