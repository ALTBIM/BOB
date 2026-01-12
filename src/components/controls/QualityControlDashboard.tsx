"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, AlertTriangle, Clock, Users, Calendar, FileText, Settings } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface ControlFinding {
  id: string;
  type: 'requirement' | 'model' | 'logistics';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  location?: string;
  affectedRoles: string[];
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
}

interface ControlResult {
  id: string;
  type: 'requirement' | 'model' | 'logistics';
  name: string;
  status: 'completed' | 'running' | 'pending';
  progress: number;
  findings: ControlFinding[];
  completedAt?: string;
  duration?: number;
}

export default function QualityControlDashboard() {
  const [activeControls, setActiveControls] = useState<ControlResult[]>([]);
  const [selectedControl, setSelectedControl] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "info" | "error"; text: string } | null>(null);

  // Mock control results
  const mockControls: ControlResult[] = [
    {
      id: "req-001",
      type: "requirement",
      name: "TEK17 Compliance Check",
      status: "completed",
      progress: 100,
      completedAt: "2024-01-15T10:30:00Z",
      duration: 45,
      findings: [
        {
          id: "f001",
          type: "requirement",
          severity: "high",
          title: "Insufficient Insulation Thickness",
          description: "Wall insulation thickness does not meet TEK17 requirements for climate zone 3",
          location: "Ground Floor - North Wall",
          affectedRoles: ["prosjekterende_ark", "bas_byggeledelse"],
          status: "open",
          createdAt: "2024-01-15T10:30:00Z"
        },
        {
          id: "f002",
          type: "requirement",
          severity: "medium",
          title: "Window U-Value Compliance",
          description: "Some windows exceed maximum U-value requirements",
          location: "Second Floor - East Facade",
          affectedRoles: ["prosjekterende_ark", "leverandor_logistikk"],
          status: "in_progress",
          createdAt: "2024-01-15T10:30:00Z"
        }
      ]
    },
    {
      id: "model-001",
      type: "model",
      name: "Model Consistency Check",
      status: "completed",
      progress: 100,
      completedAt: "2024-01-15T11:15:00Z",
      duration: 28,
      findings: [
        {
          id: "f003",
          type: "model",
          severity: "medium",
          title: "Overlapping Elements",
          description: "Structural beams overlap with HVAC ducts in ceiling space",
          location: "Second Floor - Mechanical Room",
          affectedRoles: ["prosjekterende_rib", "prosjekterende_riv"],
          status: "open",
          createdAt: "2024-01-15T11:15:00Z"
        }
      ]
    },
    {
      id: "log-001",
      type: "logistics",
      name: "Delivery Sequence Validation",
      status: "running",
      progress: 65,
      findings: []
    }
  ];

  const runControl = (controlType: 'requirement' | 'model' | 'logistics') => {
    const controlNames = {
      requirement: "Requirements Compliance Check",
      model: "Model Consistency Validation",
      logistics: "Logistics & Delivery Planning"
    };

    const newControl: ControlResult = {
      id: `${controlType}-${Date.now()}`,
      type: controlType,
      name: controlNames[controlType],
      status: "running",
      progress: 0,
      findings: []
    };

    setActiveControls(prev => [...prev, newControl]);

    // Simulate control execution
    const interval = setInterval(() => {
      setActiveControls(prev => prev.map(control => {
        if (control.id === newControl.id) {
          const newProgress = Math.min(control.progress + Math.random() * 20, 100);
          if (newProgress >= 100) {
            clearInterval(interval);
            return {
              ...control,
              status: "completed",
              progress: 100,
              completedAt: new Date().toISOString(),
              duration: Math.floor(Math.random() * 60) + 15,
              findings: mockControls.find(c => c.type === controlType)?.findings || []
            };
          }
          return { ...control, progress: newProgress };
        }
        return control;
      }));
    }, 500);
  };

  const generateMeetingProposal = (findings: ControlFinding[]) => {
    const affectedRoles = [...new Set(findings.flatMap(f => f.affectedRoles))];
    const highPriorityFindings = findings.filter(f => f.severity === 'high');
    
    const roleNames: Record<string, string> = {
      byggherre: "Byggherre",
      prosjektleder: "Prosjektleder",
      bas_byggeledelse: "BAS / Byggeledelse",
      prosjekterende_ark: "Prosjekterende (ARK)",
      prosjekterende_rib: "Prosjekterende (RIB)",
      prosjekterende_riv: "Prosjekterende (RIV)",
      prosjekterende_rie: "Prosjekterende (RIE)",
      leverandor_logistikk: "Leverand\u00f8r / Logistikk",
      kvalitet_hms: "Kvalitet / HMS"
    };

    const meetingProposal = {
      title: `Quality Control Review Meeting - ${findings.length} Findings`,
      participants: affectedRoles.map(role => roleNames[role] || role),
      agenda: [
        "Review quality control findings",
        ...highPriorityFindings.map(f => `High Priority: ${f.title}`),
        "Assign responsibilities and deadlines",
        "Schedule follow-up actions"
      ],
      priority: highPriorityFindings.length > 0 ? "High" : "Medium",
      suggestedDuration: "60 minutes"
    };

    setBanner({
      type: "info",
      text: `M\u00f8teforslag klar: ${meetingProposal.title}. Deltakere: ${meetingProposal.participants.join(
        ", "
      )}. Prioritet: ${meetingProposal.priority}. Varighet: ${meetingProposal.suggestedDuration}.`,
    });
  };

  const getSeverityBadge = (severity: ControlFinding['severity']) => {
    switch (severity) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="secondary">Medium</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
    }
  };

  const getStatusIcon = (status: ControlResult['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-primary" />;
      case 'running':
        return <Clock className="h-5 w-5 text-muted-foreground" />;
      case 'pending':
        return <Settings className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const allControls = [...mockControls, ...activeControls];
  const allFindings = allControls.flatMap(c => c.findings);
  const openFindings = allFindings.filter(f => f.status === 'open');

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            banner.type === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-muted text-foreground"
          }`}
        >
          {banner.text}
        </div>
      )}
      {/* Control Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => runControl('requirement')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-600" />
              Requirements Control
            </CardTitle>
            <CardDescription>
              Validate against TEK17, Svanemerket, and internal standards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">Run Requirements Check</Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => runControl('model')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
              Model Control
            </CardTitle>
            <CardDescription>
              Check for inconsistencies, missing objects, and overlaps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">Run Model Check</Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => runControl('logistics')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
              Logistics Control
            </CardTitle>
            <CardDescription>
              Validate quantities, delivery flow, and capacity planning
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">Run Logistics Check</Button>
          </CardContent>
        </Card>
      </div>

      {/* Control Results */}
      {allControls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Control Results</CardTitle>
            <CardDescription>
              Track quality control execution and review findings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="findings">Findings ({allFindings.length})</TabsTrigger>
                <TabsTrigger value="meetings">Meeting Proposals</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                {allControls.map((control) => (
                  <div key={control.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(control.status)}
                        <div>
                          <h4 className="font-medium">{control.name}</h4>
                          <p className="text-sm text-slate-600">
                            {control.status === 'completed' && control.completedAt && (
                              <>Completed {new Date(control.completedAt).toLocaleString()}</>
                            )}
                            {control.status === 'running' && "In progress..."}
                            {control.status === 'pending' && "Waiting to start"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={control.findings.length > 0 ? "destructive" : "default"}>
                          {control.findings.length} findings
                        </Badge>
                        {control.duration && (
                          <p className="text-xs text-slate-600 mt-1">{control.duration}s duration</p>
                        )}
                      </div>
                    </div>
                    
                    {control.status !== 'pending' && (
                      <Progress value={control.progress} className="mb-2" />
                    )}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="findings" className="space-y-4">
                {allFindings.length === 0 ? (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      No findings yet. Run quality controls to identify potential issues.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {allFindings.map((finding) => (
                      <div key={finding.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-medium">{finding.title}</h4>
                              {getSeverityBadge(finding.severity)}
                            </div>
                            <p className="text-sm text-slate-600 mb-2">{finding.description}</p>
                            {finding.location && (
                              <p className="text-xs text-slate-500">Location: {finding.location}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <span className="text-slate-600">
                              Affects: {finding.affectedRoles.join(", ")}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {finding.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <span className="text-slate-500">
                            {new Date(finding.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="meetings" className="space-y-4">
                {openFindings.length === 0 ? (
                  <Alert>
                    <Calendar className="h-4 w-4" />
                    <AlertDescription>
                      No open findings requiring meetings. Run quality controls to identify issues that need coordination.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Meeting Proposal</CardTitle>
                      <CardDescription>
                        Based on {openFindings.length} open findings requiring coordination
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">Affected Roles</h4>
                          <div className="flex flex-wrap gap-2">
                            {[...new Set(openFindings.flatMap(f => f.affectedRoles))].map(role => (
                              <Badge key={role} variant="outline">
                                <Users className="h-3 w-3 mr-1" />
                                {role.replace("_", " ")}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Priority Breakdown</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>High Priority:</span>
                              <span className="font-medium text-red-600">
                                {openFindings.filter(f => f.severity === 'high').length}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Medium Priority:</span>
                              <span className="font-medium text-yellow-600">
                                {openFindings.filter(f => f.severity === 'medium').length}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Low Priority:</span>
                              <span className="font-medium text-green-600">
                                {openFindings.filter(f => f.severity === 'low').length}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <Button 
                        onClick={() => generateMeetingProposal(openFindings)}
                        className="w-full"
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Generate Meeting Proposal
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


