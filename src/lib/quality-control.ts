// Quality Control Engine for BOB
// Handles requirements checking, model validation, and logistics control

export interface ControlFinding {
  id: string;
  type: ControlType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  location?: string;
  zone?: string;
  affectedObjects?: string[];
  recommendation: string;
  assignedTo?: string[];
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
  category: string;
}

export interface ControlResult {
  id: string;
  type: ControlType;
  projectId: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  findings: ControlFinding[];
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
  };
  executedAt: string;
  executedBy: string;
  duration: number; // in seconds
}

export interface MeetingSuggestion {
  id: string;
  title: string;
  description: string;
  suggestedParticipants: ParticipantSuggestion[];
  agenda: AgendaItem[];
  priority: 'urgent' | 'high' | 'medium' | 'low';
  estimatedDuration: number; // in minutes
  relatedFindings: string[];
  suggestedDate?: string;
}

export interface ParticipantSuggestion {
  role: string;
  reason: string;
  required: boolean;
  department?: string;
}

export interface AgendaItem {
  id: string;
  title: string;
  description: string;
  estimatedTime: number; // in minutes
  relatedFindings: string[];
  priority: 'high' | 'medium' | 'low';
}

export type ControlType = 'requirements' | 'model' | 'logistics';

class QualityControlEngine {
  private static instance: QualityControlEngine;

  private constructor() {}

  static getInstance(): QualityControlEngine {
    if (!QualityControlEngine.instance) {
      QualityControlEngine.instance = new QualityControlEngine();
    }
    return QualityControlEngine.instance;
  }

  // Run Requirements Control (TEK17, Svanemerket, etc.)
  async runRequirementsControl(projectId: string): Promise<ControlResult> {
    const controlResult: ControlResult = {
      id: `req-control-${Date.now()}`,
      type: 'requirements',
      projectId,
      name: 'Requirements Control - TEK17 & Svanemerket',
      status: 'running',
      progress: 0,
      findings: [],
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        criticalFindings: 0,
        highFindings: 0,
        mediumFindings: 0,
        lowFindings: 0
      },
      executedAt: new Date().toISOString(),
      executedBy: 'Current User',
      duration: 0
    };

    // Simulate control execution with progress updates
    const checks = [
      { name: 'Fire safety requirements (TEK17 §11)', pass: true },
      { name: 'Accessibility requirements (TEK17 §12)', pass: false },
      { name: 'Energy performance (TEK17 §14)', pass: true },
      { name: 'Ventilation requirements (TEK17 §13)', pass: true },
      { name: 'Svanemerket material requirements', pass: false },
      { name: 'Structural safety (TEK17 §10)', pass: true },
      { name: 'Sound insulation (TEK17 §15)', pass: false },
      { name: 'Moisture protection (TEK17 §9)', pass: true }
    ];

    let completedChecks = 0;
    const findings: ControlFinding[] = [];

    for (const check of checks) {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 500));
      
      completedChecks++;
      controlResult.progress = (completedChecks / checks.length) * 100;

      if (!check.pass) {
        const finding = this.generateRequirementsFinding(check.name, controlResult.id);
        findings.push(finding);
      }
    }

    // Generate final results
    controlResult.status = 'completed';
    controlResult.progress = 100;
    controlResult.findings = findings;
    controlResult.duration = checks.length * 0.5; // seconds
    controlResult.summary = {
      totalChecks: checks.length,
      passedChecks: checks.filter(c => c.pass).length,
      failedChecks: checks.filter(c => !c.pass).length,
      criticalFindings: findings.filter(f => f.severity === 'critical').length,
      highFindings: findings.filter(f => f.severity === 'high').length,
      mediumFindings: findings.filter(f => f.severity === 'medium').length,
      lowFindings: findings.filter(f => f.severity === 'low').length
    };

    return controlResult;
  }

  // Run Model Control (consistency, overlaps, missing objects)
  async runModelControl(projectId: string): Promise<ControlResult> {
    const controlResult: ControlResult = {
      id: `model-control-${Date.now()}`,
      type: 'model',
      projectId,
      name: 'Model Consistency Control',
      status: 'running',
      progress: 0,
      findings: [],
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        criticalFindings: 0,
        highFindings: 0,
        mediumFindings: 0,
        lowFindings: 0
      },
      executedAt: new Date().toISOString(),
      executedBy: 'Current User',
      duration: 0
    };

    const checks = [
      { name: 'Object overlap detection', pass: false },
      { name: 'Missing structural elements', pass: true },
      { name: 'Geometry consistency', pass: true },
      { name: 'Material property validation', pass: false },
      { name: 'Level alignment check', pass: true },
      { name: 'Connection validation', pass: false }
    ];

    let completedChecks = 0;
    const findings: ControlFinding[] = [];

    for (const check of checks) {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      completedChecks++;
      controlResult.progress = (completedChecks / checks.length) * 100;

      if (!check.pass) {
        const finding = this.generateModelFinding(check.name, controlResult.id);
        findings.push(finding);
      }
    }

    controlResult.status = 'completed';
    controlResult.progress = 100;
    controlResult.findings = findings;
    controlResult.duration = checks.length * 0.8;
    controlResult.summary = {
      totalChecks: checks.length,
      passedChecks: checks.filter(c => c.pass).length,
      failedChecks: checks.filter(c => !c.pass).length,
      criticalFindings: findings.filter(f => f.severity === 'critical').length,
      highFindings: findings.filter(f => f.severity === 'high').length,
      mediumFindings: findings.filter(f => f.severity === 'medium').length,
      lowFindings: findings.filter(f => f.severity === 'low').length
    };

    return controlResult;
  }

  // Run Logistics Control (quantities, delivery, capacity)
  async runLogisticsControl(projectId: string): Promise<ControlResult> {
    const controlResult: ControlResult = {
      id: `logistics-control-${Date.now()}`,
      type: 'logistics',
      projectId,
      name: 'Logistics & Delivery Control',
      status: 'running',
      progress: 0,
      findings: [],
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        criticalFindings: 0,
        highFindings: 0,
        mediumFindings: 0,
        lowFindings: 0
      },
      executedAt: new Date().toISOString(),
      executedBy: 'Current User',
      duration: 0
    };

    const checks = [
      { name: 'Material quantity validation', pass: true },
      { name: 'Delivery sequence optimization', pass: false },
      { name: 'Storage capacity planning', pass: false },
      { name: 'Crane access validation', pass: true },
      { name: 'Just-in-time delivery feasibility', pass: false }
    ];

    let completedChecks = 0;
    const findings: ControlFinding[] = [];

    for (const check of checks) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      completedChecks++;
      controlResult.progress = (completedChecks / checks.length) * 100;

      if (!check.pass) {
        const finding = this.generateLogisticsFinding(check.name, controlResult.id);
        findings.push(finding);
      }
    }

    controlResult.status = 'completed';
    controlResult.progress = 100;
    controlResult.findings = findings;
    controlResult.duration = checks.length * 1.0;
    controlResult.summary = {
      totalChecks: checks.length,
      passedChecks: checks.filter(c => c.pass).length,
      failedChecks: checks.filter(c => !c.pass).length,
      criticalFindings: findings.filter(f => f.severity === 'critical').length,
      highFindings: findings.filter(f => f.severity === 'high').length,
      mediumFindings: findings.filter(f => f.severity === 'medium').length,
      lowFindings: findings.filter(f => f.severity === 'low').length
    };

    return controlResult;
  }

  // Generate meeting suggestions based on findings
  generateMeetingSuggestions(findings: ControlFinding[]): MeetingSuggestion[] {
    const suggestions: MeetingSuggestion[] = [];

    // Group findings by type and severity
    const criticalFindings = findings.filter(f => f.severity === 'critical');
    const highFindings = findings.filter(f => f.severity === 'high');

    // Critical findings require urgent meeting
    if (criticalFindings.length > 0) {
      suggestions.push({
        id: `meeting-critical-${Date.now()}`,
        title: 'Urgent: Critical Issues Resolution',
        description: `Address ${criticalFindings.length} critical finding(s) that require immediate attention`,
        suggestedParticipants: [
          { role: 'Project Manager', reason: 'Overall project responsibility', required: true },
          { role: 'Architect', reason: 'Design decisions required', required: true },
          { role: 'Structural Engineer', reason: 'Safety-critical issues', required: true },
          { role: 'Contractor', reason: 'Implementation feasibility', required: true }
        ],
        agenda: criticalFindings.map((finding, index) => ({
          id: `agenda-${finding.id}`,
          title: finding.title,
          description: finding.description,
          estimatedTime: 15,
          relatedFindings: [finding.id],
          priority: 'high' as const
        })),
        priority: 'urgent',
        estimatedDuration: Math.max(60, criticalFindings.length * 15),
        relatedFindings: criticalFindings.map(f => f.id),
        suggestedDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Tomorrow
      });
    }

    // High priority findings require planning meeting
    if (highFindings.length > 0) {
      suggestions.push({
        id: `meeting-high-${Date.now()}`,
        title: 'Planning Meeting: High Priority Issues',
        description: `Review and plan resolution for ${highFindings.length} high priority finding(s)`,
        suggestedParticipants: [
          { role: 'Project Manager', reason: 'Coordination and planning', required: true },
          { role: 'Lead Architect', reason: 'Design review required', required: false },
          { role: 'Production Manager', reason: 'Production impact assessment', required: true }
        ],
        agenda: highFindings.map((finding, index) => ({
          id: `agenda-${finding.id}`,
          title: finding.title,
          description: finding.description,
          estimatedTime: 10,
          relatedFindings: [finding.id],
          priority: 'medium' as const
        })),
        priority: 'high',
        estimatedDuration: Math.max(45, highFindings.length * 10),
        relatedFindings: highFindings.map(f => f.id),
        suggestedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days
      });
    }

    return suggestions;
  }

  private generateRequirementsFinding(checkName: string, controlId: string): ControlFinding {
    const findingTemplates = {
      'Accessibility requirements (TEK17 §12)': {
        severity: 'high' as const,
        title: 'Accessibility Requirements Not Met',
        description: 'Door widths in Zone A1 do not meet minimum 850mm requirement for universal design',
        location: 'Zone A1 - Living Area',
        zone: 'zone-a1',
        recommendation: 'Increase door widths to minimum 850mm and review corridor widths',
        assignedTo: ['Architect', 'Accessibility Consultant'],
        category: 'Accessibility'
      },
      'Svanemerket material requirements': {
        severity: 'medium' as const,
        title: 'Non-Approved Materials Detected',
        description: 'Some insulation materials are not on the Svanemerket approved list',
        location: 'Multiple zones',
        recommendation: 'Replace with Svanemerket-approved insulation materials',
        assignedTo: ['Architect', 'Sustainability Consultant'],
        category: 'Environmental'
      },
      'Sound insulation (TEK17 §15)': {
        severity: 'high' as const,
        title: 'Insufficient Sound Insulation',
        description: 'Wall construction between apartments does not meet DnT,w ≥ 55 dB requirement',
        location: 'Floor 2 - Apartment walls',
        zone: 'zone-b1',
        recommendation: 'Increase wall thickness or improve insulation specification',
        assignedTo: ['Acoustic Engineer', 'Architect'],
        category: 'Acoustics'
      }
    };

    const template = findingTemplates[checkName as keyof typeof findingTemplates] || {
      severity: 'medium' as const,
      title: 'Requirement Check Failed',
      description: `${checkName} did not pass validation`,
      location: 'Various locations',
      recommendation: 'Review and update design to meet requirements',
      assignedTo: ['Project Team'],
      category: 'General'
    };

    return {
      id: `finding-${Date.now()}-${Math.random()}`,
      type: 'requirements',
      ...template,
      status: 'open',
      createdAt: new Date().toISOString()
    };
  }

  private generateModelFinding(checkName: string, controlId: string): ControlFinding {
    const findingTemplates = {
      'Object overlap detection': {
        severity: 'critical' as const,
        title: 'Structural Element Overlaps Detected',
        description: 'Beam SB-001 overlaps with Column SC-002 in Zone A1',
        location: 'Zone A1 - Living Area',
        zone: 'zone-a1',
        affectedObjects: ['SB-001', 'SC-002'],
        recommendation: 'Adjust beam positioning or column placement to resolve conflict',
        assignedTo: ['Structural Engineer', 'Architect'],
        category: 'Geometry'
      },
      'Material property validation': {
        severity: 'medium' as const,
        title: 'Missing Material Properties',
        description: 'Steel grade not specified for 4 structural elements',
        location: 'Multiple zones',
        affectedObjects: ['SC-001', 'SC-002', 'SB-003', 'SB-004'],
        recommendation: 'Specify steel grade (S355 or S235) for all structural steel elements',
        assignedTo: ['Structural Engineer'],
        category: 'Materials'
      },
      'Connection validation': {
        severity: 'high' as const,
        title: 'Undefined Beam-Column Connections',
        description: 'Connection details missing for 6 beam-column intersections',
        location: 'Zone A1, Zone A2',
        recommendation: 'Define connection details and bolting specifications',
        assignedTo: ['Structural Engineer', 'Detailing Specialist'],
        category: 'Connections'
      }
    };

    const template = findingTemplates[checkName as keyof typeof findingTemplates] || {
      severity: 'medium' as const,
      title: 'Model Validation Issue',
      description: `${checkName} identified potential issues`,
      location: 'Model-wide',
      recommendation: 'Review model for consistency and completeness',
      assignedTo: ['Design Team'],
      category: 'General'
    };

    return {
      id: `finding-${Date.now()}-${Math.random()}`,
      type: 'model',
      ...template,
      status: 'open',
      createdAt: new Date().toISOString()
    };
  }

  private generateLogisticsFinding(checkName: string, controlId: string): ControlFinding {
    const findingTemplates = {
      'Delivery sequence optimization': {
        severity: 'medium' as const,
        title: 'Suboptimal Delivery Sequence',
        description: 'Current delivery schedule may cause storage conflicts and double handling',
        location: 'Site logistics area',
        recommendation: 'Reschedule steel delivery to arrive after concrete curing',
        assignedTo: ['Logistics Coordinator', 'Site Manager'],
        category: 'Scheduling'
      },
      'Storage capacity planning': {
        severity: 'high' as const,
        title: 'Insufficient Storage Capacity',
        description: 'Site storage area cannot accommodate planned material volumes',
        location: 'Material storage area',
        recommendation: 'Arrange off-site storage or implement just-in-time delivery',
        assignedTo: ['Site Manager', 'Logistics Coordinator'],
        category: 'Capacity'
      },
      'Just-in-time delivery feasibility': {
        severity: 'medium' as const,
        title: 'JIT Delivery Risk Assessment',
        description: 'Weather delays could impact just-in-time delivery schedule',
        location: 'Delivery planning',
        recommendation: 'Build buffer time into delivery schedule for weather contingencies',
        assignedTo: ['Logistics Coordinator', 'Project Manager'],
        category: 'Risk Management'
      }
    };

    const template = findingTemplates[checkName as keyof typeof findingTemplates] || {
      severity: 'medium' as const,
      title: 'Logistics Issue',
      description: `${checkName} identified potential logistics challenges`,
      location: 'Site-wide',
      recommendation: 'Review logistics planning and coordination',
      assignedTo: ['Logistics Team'],
      category: 'General'
    };

    return {
      id: `finding-${Date.now()}-${Math.random()}`,
      type: 'logistics',
      ...template,
      status: 'open',
      createdAt: new Date().toISOString()
    };
  }

  // Generate comprehensive meeting suggestions based on all findings
  generateComprehensiveMeetingSuggestions(allFindings: ControlFinding[]): MeetingSuggestion[] {
    const suggestions = this.generateMeetingSuggestions(allFindings);

    // Add coordination meeting if multiple control types have findings
    const controlTypes = [...new Set(allFindings.map(f => f.type))];
    if (controlTypes.length > 1) {
      suggestions.push({
        id: `meeting-coordination-${Date.now()}`,
        title: 'Multi-Disciplinary Coordination Meeting',
        description: `Coordinate resolution of findings across ${controlTypes.length} control areas`,
        suggestedParticipants: [
          { role: 'Project Manager', reason: 'Overall coordination', required: true },
          { role: 'Architect', reason: 'Design coordination', required: true },
          { role: 'Structural Engineer', reason: 'Technical coordination', required: true },
          { role: 'Site Manager', reason: 'Implementation coordination', required: true },
          { role: 'Logistics Coordinator', reason: 'Delivery coordination', required: false }
        ],
        agenda: [
          {
            id: 'agenda-overview',
            title: 'Findings Overview',
            description: 'Review all control findings and their interdependencies',
            estimatedTime: 20,
            relatedFindings: allFindings.map(f => f.id),
            priority: 'high'
          },
          {
            id: 'agenda-priorities',
            title: 'Priority Setting',
            description: 'Establish resolution priorities and dependencies',
            estimatedTime: 15,
            relatedFindings: [],
            priority: 'high'
          },
          {
            id: 'agenda-assignments',
            title: 'Task Assignments',
            description: 'Assign responsibilities and deadlines',
            estimatedTime: 20,
            relatedFindings: [],
            priority: 'medium'
          }
        ],
        priority: 'high',
        estimatedDuration: 90,
        relatedFindings: allFindings.map(f => f.id),
        suggestedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days
      });
    }

    return suggestions;
  }

  // Export meeting agenda as text
  exportMeetingAgenda(meeting: MeetingSuggestion): string {
    const agenda = `
MEETING AGENDA

Title: ${meeting.title}
Date: ${meeting.suggestedDate ? new Date(meeting.suggestedDate).toLocaleDateString('no-NO') : 'TBD'}
Duration: ${meeting.estimatedDuration} minutes
Priority: ${meeting.priority.toUpperCase()}

DESCRIPTION:
${meeting.description}

PARTICIPANTS:
${meeting.suggestedParticipants.map(p => 
  `• ${p.role} ${p.required ? '(Required)' : '(Optional)'} - ${p.reason}`
).join('\n')}

AGENDA ITEMS:
${meeting.agenda.map((item, index) => 
  `${index + 1}. ${item.title} (${item.estimatedTime} min)
     ${item.description}`
).join('\n\n')}

RELATED FINDINGS:
${meeting.relatedFindings.length} finding(s) to be addressed

---
Generated by BOB - BIM Operations & Building Management
    `.trim();

    return agenda;
  }
}

// Export singleton instance
export const qualityControl = QualityControlEngine.getInstance();

// Helper functions
export const getSeverityColor = (severity: ControlFinding['severity']): string => {
  const colors = {
    critical: '#DC2626', // red-600
    high: '#EA580C',     // orange-600
    medium: '#D97706',   // amber-600
    low: '#65A30D'       // lime-600
  };
  return colors[severity];
};

export const getSeverityBadgeVariant = (severity: ControlFinding['severity']) => {
  const variants = {
    critical: 'destructive' as const,
    high: 'destructive' as const,
    medium: 'default' as const,
    low: 'secondary' as const
  };
  return variants[severity];
};

export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
};