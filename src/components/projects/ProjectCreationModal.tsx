"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Calendar, MapPin, Users } from "lucide-react";

interface ProjectCreationModalProps {
  onProjectCreate: (project: any) => void;
}

export default function ProjectCreationModal({ onProjectCreate }: ProjectCreationModalProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      const newProject = {
        id: `project-${Date.now()}`,
        ...projectData,
        status: "planning",
        progress: 0,
        teamMembers: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
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
      setIsLoading(false);
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Building2 className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Set up a new construction project in BOB. You can add team members and upload BIM models after creation.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                placeholder="e.g., Residential Complex A"
                value={projectData.name}
                onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-type">Project Type</Label>
              <Select value={projectData.type} onValueChange={(value) => setProjectData({ ...projectData, type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                  <SelectItem value="infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="renovation">Renovation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              placeholder="Brief description of the project..."
              value={projectData.description}
              onChange={(e) => setProjectData({ ...projectData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project-location">Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="project-location"
                  placeholder="City, Country"
                  className="pl-10"
                  value={projectData.location}
                  onChange={(e) => setProjectData({ ...projectData, location: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-client">Client</Label>
              <div className="relative">
                <Users className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="project-client"
                  placeholder="Client name"
                  className="pl-10"
                  value={projectData.client}
                  onChange={(e) => setProjectData({ ...projectData, client: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
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
              <Label htmlFor="end-date">Expected End Date</Label>
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
            <Label htmlFor="project-budget">Budget (Optional)</Label>
            <Input
              id="project-budget"
              placeholder="e.g., 5,000,000 NOK"
              value={projectData.budget}
              onChange={(e) => setProjectData({ ...projectData, budget: e.target.value })}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}