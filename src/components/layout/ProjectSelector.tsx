"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActiveProject } from "@/lib/active-project";
import { useSession } from "@/lib/session";
import { ProjectType, db } from "@/lib/database";

const DEFAULT_TYPE: ProjectType = "commercial";

export default function ProjectSelector() {
  const { user } = useSession();
  const {
    projects,
    activeProjectId,
    activeProject,
    loading,
    setActiveProjectId,
    refreshProjects,
    organizations,
    orgMemberships,
    isPlatformAdmin,
  } = useActiveProject();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createOrgId, setCreateOrgId] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const orgOptions = useMemo(() => {
    if (isPlatformAdmin) return organizations;
    const adminOrgIds = new Set(orgMemberships.filter((m) => m.orgRole === "org_admin").map((m) => m.orgId));
    return organizations.filter((org) => adminOrgIds.has(org.id));
  }, [isPlatformAdmin, organizations, orgMemberships]);

  useEffect(() => {
    if (!createOpen) return;
    if (!createOrgId && orgOptions.length === 1) {
      setCreateOrgId(orgOptions[0].id);
    }
  }, [createOpen, createOrgId, orgOptions]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) => {
      return project.name.toLowerCase().includes(query) || project.description.toLowerCase().includes(query);
    });
  }, [projects, searchTerm]);

  const handleSelect = (projectId: string) => {
    setActiveProjectId(projectId);
    setOpen(false);
  };

  const handleCreateProject = async () => {
    if (!user) {
      setCreateError("Du m\u00e5 v\u00e6re logget inn for \u00e5 opprette prosjekt.");
      return;
    }
    if (!createName.trim()) {
      setCreateError("Prosjektnavn er p\u00e5krevd.");
      return;
    }
    if (orgOptions.length > 0 && !createOrgId) {
      setCreateError("Velg organisasjon for prosjektet.");
      return;
    }
    setCreateError(null);
    setIsCreating(true);
    try {
      const project = await db.createProject({
        name: createName.trim(),
        description: createDescription.trim(),
        status: "planning",
        progress: 0,
        client: "",
        location: "",
        type: DEFAULT_TYPE,
        createdBy: user.id,
        orgId: createOrgId || null,
      });
      setActiveProjectId(project.id);
      await refreshProjects();
      setCreateName("");
      setCreateDescription("");
      setCreateOrgId("");
      setCreateOpen(false);
    } catch (err) {
      console.error("Kunne ikke opprette prosjekt", err);
      setCreateError("Kunne ikke opprette prosjekt. Pr\u00f8v igjen.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Prosjekt</div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-background"
            disabled={loading}
          >
            <span className="truncate">
              {activeProject ? activeProject.name : loading ? "Laster prosjekter..." : "Velg prosjekt"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="S\u00f8k prosjekt..."
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              <CommandEmpty>Ingen prosjekter funnet.</CommandEmpty>
              <CommandGroup>
                {filtered.map((project) => (
                  <CommandItem key={project.id} value={project.id} onSelect={(value) => handleSelect(value)}>
                    <Check
                      className={
                        activeProjectId === project.id ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"
                      }
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{project.name}</div>
                      {project.description && <div className="text-xs text-muted-foreground">{project.description}</div>}
                    </div>
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {project.status}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="border-t border-border px-3 py-2">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Opprett prosjekt
              </Button>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle>Nytt prosjekt</DialogTitle>
                  <DialogDescription>
                    Opprett et prosjekt og bli automatisk prosjektadmin.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {createError && <p className="text-sm text-destructive">{createError}</p>}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Prosjektnavn</label>
                    <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Navn" />
                  </div>
                  {orgOptions.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Organisasjon</label>
                      <Select value={createOrgId} onValueChange={setCreateOrgId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Velg organisasjon" />
                        </SelectTrigger>
                        <SelectContent>
                          {orgOptions.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Beskrivelse (valgfritt)</label>
                    <Textarea
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                      placeholder="Kort beskrivelse"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isCreating}>
                      Avbryt
                    </Button>
                    <Button onClick={handleCreateProject} disabled={isCreating}>
                      {isCreating ? "Oppretter..." : "Opprett prosjekt"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </PopoverContent>
      </Popover>
      {activeProject && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{activeProject.location || "Uten lokasjon"}</span>
          <span className="text-muted-foreground/50">{"\u2022"}</span>
          <span>{activeProject.teamMembers.length} medlemmer</span>
        </div>
      )}
    </div>
  );
}
