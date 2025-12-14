"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Search, Settings } from "lucide-react";
import { Project, db } from "@/lib/database";

interface ProjectSelectorProps {
  selectedProject: string | null;
  onProjectChange: (projectId: string | null) => void;
  onManageProjects: () => void;
}

export default function ProjectSelector({ selectedProject, onProjectChange, onManageProjects }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const userProjects = await db.getProjects(); // In real app, filter by user access
      setProjects(userProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProjectData = projects.find(p => p.id === selectedProject);

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <Building2 className="w-5 h-5 text-blue-600" />
        <span className="text-sm font-medium text-slate-700">Project:</span>
      </div>
      
      <div className="min-w-[300px]">
        <Select value={selectedProject || ""} onValueChange={(value) => onProjectChange(value || null)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a project...">
              {selectedProjectData && (
                <div className="flex items-center space-x-2">
                  <span>{selectedProjectData.name}</span>
                  <Badge variant={selectedProjectData.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                    {selectedProjectData.status}
                  </Badge>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8"
                />
              </div>
            </div>
            {filteredProjects.length > 0 ? (
              filteredProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <div className="font-medium">{project.name}</div>
                      <div className="text-xs text-slate-500">{project.description}</div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {project.status}
                      </Badge>
                      <span className="text-xs text-slate-400">{project.progress}%</span>
                    </div>
                  </div>
                </SelectItem>
              ))
            ) : (
              <div className="p-4 text-center text-slate-500 text-sm">
                {searchTerm ? 'No projects found' : 'No projects available'}
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      <Button variant="outline" size="sm" onClick={onManageProjects}>
        <Settings className="w-4 h-4 mr-2" />
        Manage
      </Button>

      {selectedProjectData && (
        <div className="hidden lg:flex items-center space-x-4 text-sm text-slate-600">
          <span>Progress: {selectedProjectData.progress}%</span>
          <span>Team: {selectedProjectData.teamMembers.length}</span>
          <span>{selectedProjectData.location}</span>
        </div>
      )}
    </div>
  );
}