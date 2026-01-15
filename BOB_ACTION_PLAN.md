# BOB Platform - Prioritized Action Plan
**Date:** December 11, 2025  
**Status:** Ready for Implementation  
**Target:** Production-ready MVP in 3-4 months

---

## Overview

This action plan provides a step-by-step roadmap to transform the current BOB implementation (~25-30% complete) into a production-ready MVP that covers the most critical features from the specification.

---

## Phase 1: Security & Foundation (Weeks 1-4)

### Week 1-2: Multi-Tenant Architecture & Security

#### Task 1.1: Database Schema - Organizations
**Priority:** 🔴 CRITICAL  
**Effort:** 2 days  
**Dependencies:** None

```sql
-- Create organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create org_members table
CREATE TABLE org_members (
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('member', 'org_admin')),
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

-- Create platform_admins table
CREATE TABLE platform_admins (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  granted_at TIMESTAMP DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id)
);

-- Add org_id to projects
ALTER TABLE projects ADD COLUMN org_id UUID REFERENCES organizations(id);
CREATE INDEX idx_projects_org_id ON projects(org_id);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
```

**Acceptance Criteria:**
- [ ] Tables created in Supabase
- [ ] RLS policies defined
- [ ] Migration script tested
- [ ] Rollback script prepared

---

#### Task 1.2: RLS Policies
**Priority:** 🔴 CRITICAL  
**Effort:** 2 days  
**Dependencies:** Task 1.1

```sql
-- Organizations: Users see only their orgs
CREATE POLICY "Users see their organizations"
ON organizations FOR SELECT
USING (
  id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid()
  )
  OR
  auth.uid() IN (SELECT user_id FROM platform_admins)
);

-- Org members: Users see members of their orgs
CREATE POLICY "Users see org members"
ON org_members FOR SELECT
USING (
  org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid()
  )
  OR
  auth.uid() IN (SELECT user_id FROM platform_admins)
);

-- Projects: Users see projects in their orgs
CREATE POLICY "Users see projects in their orgs"
ON projects FOR SELECT
USING (
  org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid()
  )
  OR
  id IN (
    SELECT project_id FROM project_members
    WHERE user_id = auth.uid()
  )
  OR
  auth.uid() IN (SELECT user_id FROM platform_admins)
);

-- Projects: Org admins can create projects
CREATE POLICY "Org admins can create projects"
ON projects FOR INSERT
WITH CHECK (
  org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid() AND role = 'org_admin'
  )
  OR
  auth.uid() IN (SELECT user_id FROM platform_admins)
);
```

**Acceptance Criteria:**
- [ ] All RLS policies created
- [ ] Policies tested with different user roles
- [ ] No data leakage between orgs
- [ ] Platform admins can see all data

---

#### Task 1.3: Enhanced RBAC System
**Priority:** 🔴 CRITICAL  
**Effort:** 3 days  
**Dependencies:** Task 1.1

```sql
-- Enhance project_members table
ALTER TABLE project_members 
  ADD COLUMN access_level TEXT CHECK (access_level IN ('read', 'write', 'admin')),
  ADD COLUMN permissions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN company TEXT,
  ADD COLUMN responsibility TEXT;

-- Create teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create team_members table
CREATE TABLE team_members (
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
```

**Acceptance Criteria:**
- [ ] Schema updated
- [ ] Migration tested
- [ ] Permissions array structure defined
- [ ] Teams functionality working

---

#### Task 1.4: Update API Routes for Multi-Tenant
**Priority:** 🔴 CRITICAL  
**Effort:** 3 days  
**Dependencies:** Tasks 1.1, 1.2, 1.3

**Files to Update:**
- `src/app/api/projects/route.ts` - Add org_id filtering
- `src/app/api/files/route.ts` - Enforce project access
- `src/lib/database.ts` - Update all queries with org_id

**New API Routes:**
```typescript
// src/app/api/organizations/route.ts
POST   /api/organizations          - Create org (platform admin only)
GET    /api/organizations          - List user's orgs
GET    /api/organizations/:id      - Get org details
PATCH  /api/organizations/:id      - Update org (org admin)
DELETE /api/organizations/:id      - Delete org (platform admin)

// src/app/api/organizations/[id]/members/route.ts
GET    /api/organizations/:id/members     - List org members
POST   /api/organizations/:id/members     - Add member (org admin)
DELETE /api/organizations/:id/members/:userId - Remove member (org admin)
PATCH  /api/organizations/:id/members/:userId - Update role (org admin)

// src/app/api/teams/route.ts
POST   /api/teams                  - Create team
GET    /api/teams?projectId=:id    - List project teams
PATCH  /api/teams/:id               - Update team
DELETE /api/teams/:id               - Delete team

// src/app/api/teams/[id]/members/route.ts
POST   /api/teams/:id/members       - Add team member
DELETE /api/teams/:id/members/:userId - Remove team member
```

**Acceptance Criteria:**
- [ ] All API routes enforce org isolation
- [ ] Permission checks in place
- [ ] Error handling standardized
- [ ] API tests written

---

#### Task 1.5: Gated Admin UI
**Priority:** 🟡 HIGH  
**Effort:** 2 days  
**Dependencies:** Task 1.4

**New Components:**
```typescript
// src/components/admin/PlatformAdminPanel.tsx
- Only visible to platform admins
- Manage all organizations
- View all users
- System settings

// src/components/admin/OrgAdminPanel.tsx
- Only visible to org admins
- Manage org members
- View org projects
- Org settings

// src/components/admin/ProjectAdminPanel.tsx
- Only visible to project admins
- Manage project members
- Manage teams
- Project settings
```

**Acceptance Criteria:**
- [ ] Admin panels only show to authorized users
- [ ] Navigation reflects user permissions
- [ ] All admin functions working
- [ ] UI/UX polished

---

### Week 3-4: File Management & Activity Logging

#### Task 1.6: Enhanced File Management
**Priority:** 🟡 HIGH  
**Effort:** 3 days  
**Dependencies:** Task 1.2

```sql
-- Enhance files table
ALTER TABLE files
  ADD COLUMN category TEXT CHECK (category IN (
    'contract', 'drawing', 'fdv', 'description', 
    'supplier', 'control', 'minutes', 'other'
  )),
  ADD COLUMN tags TEXT[],
  ADD COLUMN extracted_text TEXT,
  ADD COLUMN change_summary TEXT,
  ADD COLUMN annotations JSONB DEFAULT '[]'::jsonb;

-- Create file_versions table for better version tracking
CREATE TABLE file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  size BIGINT,
  storage_url TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  change_summary TEXT,
  UNIQUE(file_id, version)
);

-- Enable RLS
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_versions ENABLE ROW LEVEL SECURITY;
```

**Acceptance Criteria:**
- [ ] File categories working
- [ ] Tags system implemented
- [ ] Version comparison shows changes
- [ ] Text extraction for PDF/DOCX

---

#### Task 1.7: Activity Logging & Audit Trail
**Priority:** 🟡 HIGH  
**Effort:** 2 days  
**Dependencies:** None

```sql
-- Create activity_log table
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  org_id UUID REFERENCES organizations(id),
  project_id UUID REFERENCES projects(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_project ON activity_log(project_id);
CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);

-- Enable RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
```

**Implementation:**
```typescript
// src/lib/activity-logger.ts
export async function logActivity(params: {
  userId: string;
  orgId?: string;
  projectId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: any;
}) {
  // Log to database
  // Also send to external service (optional)
}

// Usage in API routes
await logActivity({
  userId: session.user.id,
  projectId: project.id,
  action: 'project.created',
  entityType: 'project',
  entityId: project.id,
  details: { name: project.name }
});
```

**Acceptance Criteria:**
- [ ] All critical actions logged
- [ ] Activity feed UI component
- [ ] Filtering and search working
- [ ] Export functionality

---

## Phase 2: Core Features (Weeks 5-10)

### Week 5-6: IFC Search with Facets (CRITICAL FEATURE)

#### Task 2.1: IFC Element Indexing
**Priority:** 🔴 CRITICAL  
**Effort:** 4 days  
**Dependencies:** Phase 1 complete

```sql
-- Create ifc_elements table
CREATE TABLE ifc_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES ifc_models(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  guid TEXT NOT NULL,
  element_type TEXT NOT NULL,
  name TEXT,
  description TEXT,
  properties JSONB DEFAULT '{}'::jsonb,
  geometry JSONB,
  material TEXT,
  fire_rating TEXT,
  floor TEXT,
  zone TEXT,
  room TEXT,
  status TEXT DEFAULT 'ok',
  supplier TEXT,
  responsible TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(model_id, guid)
);

-- Create indexes for fast search
CREATE INDEX idx_ifc_elements_model ON ifc_elements(model_id);
CREATE INDEX idx_ifc_elements_project ON ifc_elements(project_id);
CREATE INDEX idx_ifc_elements_type ON ifc_elements(element_type);
CREATE INDEX idx_ifc_elements_floor ON ifc_elements(floor);
CREATE INDEX idx_ifc_elements_zone ON ifc_elements(zone);
CREATE INDEX idx_ifc_elements_material ON ifc_elements(material);

-- Full-text search index
CREATE INDEX idx_ifc_elements_search ON ifc_elements 
USING GIN (to_tsvector('english', 
  COALESCE(name, '') || ' ' || 
  COALESCE(description, '') || ' ' || 
  COALESCE(element_type, '')
));

-- Enable RLS
ALTER TABLE ifc_elements ENABLE ROW LEVEL SECURITY;
```

**Acceptance Criteria:**
- [ ] IFC parsing extracts all elements
- [ ] Elements stored with full properties
- [ ] Spatial hierarchy captured
- [ ] Indexing complete

---

#### Task 2.2: IFC Search API
**Priority:** 🔴 CRITICAL  
**Effort:** 3 days  
**Dependencies:** Task 2.1

```typescript
// src/app/api/ifc/search/route.ts
export async function POST(request: Request) {
  const { projectId, query, filters } = await request.json();
  
  // Build SQL query with filters
  let sql = `
    SELECT * FROM ifc_elements
    WHERE project_id = $1
  `;
  
  const params = [projectId];
  let paramIndex = 2;
  
  // Add text search
  if (query) {
    sql += ` AND to_tsvector('english', name || ' ' || description) @@ plainto_tsquery('english', $${paramIndex})`;
    params.push(query);
    paramIndex++;
  }
  
  // Add filters
  if (filters.elementType?.length) {
    sql += ` AND element_type = ANY($${paramIndex})`;
    params.push(filters.elementType);
    paramIndex++;
  }
  
  if (filters.floor?.length) {
    sql += ` AND floor = ANY($${paramIndex})`;
    params.push(filters.floor);
    paramIndex++;
  }
  
  // ... more filters
  
  sql += ` ORDER BY name LIMIT 100`;
  
  const results = await db.query(sql, params);
  
  return Response.json({
    results: results.rows,
    total: results.rowCount,
    facets: await getFacets(projectId, filters)
  });
}

// Get available filter options
async function getFacets(projectId: string, currentFilters: any) {
  return {
    elementTypes: await getDistinctValues('element_type', projectId, currentFilters),
    floors: await getDistinctValues('floor', projectId, currentFilters),
    zones: await getDistinctValues('zone', projectId, currentFilters),
    materials: await getDistinctValues('material', projectId, currentFilters),
    // ...
  };
}
```

**Acceptance Criteria:**
- [ ] Search API returns results < 500ms
- [ ] Facets update based on current filters
- [ ] Pagination working
- [ ] Handles large result sets

---

#### Task 2.3: IFC Search UI Component
**Priority:** 🔴 CRITICAL  
**Effort:** 4 days  
**Dependencies:** Task 2.2

```typescript
// src/components/bim/IFCSearch.tsx
export function IFCSearch({ projectId, onElementSelect }: Props) {
  return (
    <div className="flex h-full">
      {/* Left: Search & Filters */}
      <div className="w-80 border-r p-4 space-y-4">
        <SearchInput />
        
        <Accordion type="multiple">
          <AccordionItem value="element-type">
            <AccordionTrigger>Element Type</AccordionTrigger>
            <AccordionContent>
              <FilterCheckboxes options={facets.elementTypes} />
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="floor">
            <AccordionTrigger>Floor</AccordionTrigger>
            <AccordionContent>
              <FilterCheckboxes options={facets.floors} />
            </AccordionContent>
          </AccordionItem>
          
          {/* More filter sections */}
        </Accordion>
      </div>
      
      {/* Right: Results */}
      <div className="flex-1 p-4">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {results.total} results found
          </p>
        </div>
        
        <div className="space-y-2">
          {results.items.map(element => (
            <ElementResultCard
              key={element.guid}
              element={element}
              onClick={() => onElementSelect(element)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] SearchResultsPage-like experience
- [ ] Facets update dynamically
- [ ] Click element zooms in viewer
- [ ] Fast and responsive
- [ ] Mobile-friendly

---

### Week 7-8: Issue/RFI/Deviation Tracking

#### Task 2.4: Issues Database Schema
**Priority:** 🔴 CRITICAL  
**Effort:** 2 days  
**Dependencies:** Phase 1 complete

```sql
-- Create issues table
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deviation', 'rfi', 'change_request')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  due_date TIMESTAMP,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  ifc_element_guids TEXT[],
  attachments JSONB DEFAULT '[]'::jsonb
);

-- Create issue_comments table
CREATE TABLE issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create issue_history table
CREATE TABLE issue_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  changes JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_issues_project ON issues(project_id);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_assigned ON issues(assigned_to);
CREATE INDEX idx_issue_comments_issue ON issue_comments(issue_id);

-- Enable RLS
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_history ENABLE ROW LEVEL SECURITY;
```

**Acceptance Criteria:**
- [ ] Schema created
- [ ] RLS policies defined
- [ ] Triggers for updated_at
- [ ] History tracking working

---

#### Task 2.5: Issues API
**Priority:** 🔴 CRITICAL  
**Effort:** 3 days  
**Dependencies:** Task 2.4

```typescript
// src/app/api/issues/route.ts
POST   /api/issues                    - Create issue
GET    /api/issues?projectId=:id      - List issues
GET    /api/issues/:id                - Get issue details
PATCH  /api/issues/:id                - Update issue
DELETE /api/issues/:id                - Delete issue

// src/app/api/issues/[id]/comments/route.ts
POST   /api/issues/:id/comments       - Add comment
GET    /api/issues/:id/comments       - List comments

// src/app/api/issues/[id]/history/route.ts
GET    /api/issues/:id/history        - Get history
```

**Acceptance Criteria:**
- [ ] All CRUD operations working
- [ ] Status transitions validated
- [ ] Notifications sent on assignment
- [ ] History tracked automatically

---

#### Task 2.6: Issues UI Components
**Priority:** 🔴 CRITICAL  
**Effort:** 4 days  
**Dependencies:** Task 2.5

```typescript
// Components needed:
- IssueList.tsx          - List with filters
- IssueCard.tsx          - Issue summary card
- IssueDetail.tsx        - Full issue view
- IssueForm.tsx          - Create/edit form
- IssueComments.tsx      - Comment thread
- IssueStatusBadge.tsx   - Status indicator
- IssuePriorityBadge.tsx - Priority indicator
```

**Acceptance Criteria:**
- [ ] Create issue from IFC element
- [ ] Assign to user/role
- [ ] Add comments
- [ ] Upload attachments
- [ ] View history
- [ ] Filter and search

---

### Week 9-10: Project-Aware AI

#### Task 2.7: Document Ingestion for RAG
**Priority:** 🟡 HIGH  
**Effort:** 3 days  
**Dependencies:** Task 1.6

```typescript
// src/lib/document-processor.ts
export async function ingestDocument(
  file: File,
  projectId: string,
  category: string
) {
  // 1. Extract text
  const text = await extractText(file);
  
  // 2. Chunk text
  const chunks = chunkText(text, {
    maxChunkSize: 1000,
    overlap: 200
  });
  
  // 3. Generate embeddings
  const embeddings = await generateEmbeddings(chunks);
  
  // 4. Store in vector database with project_id
  await storeEmbeddings(embeddings, {
    projectId,
    fileId: file.id,
    category,
    metadata: {
      filename: file.name,
      uploadedAt: new Date().toISOString()
    }
  });
  
  // 5. Update file record
  await updateFile(file.id, {
    extracted_text: text,
    indexed_at: new Date()
  });
}
```

**Acceptance Criteria:**
- [ ] PDF text extraction working
- [ ] DOCX text extraction working
- [ ] Chunking strategy optimized
- [ ] Embeddings stored with project_id

---

#### Task 2.8: Project-Aware AI Context
**Priority:** 🔴 CRITICAL  
**Effort:** 4 days  
**Dependencies:** Task 2.7

```typescript
// src/lib/ai-context.ts
export async function buildAIContext(
  userId: string,
  projectId: string,
  query: string
): Promise<AIContext> {
  // 1. Verify access
  const hasAccess = await verifyProjectAccess(userId, projectId);
  if (!hasAccess) {
    throw new Error('Access denied');
  }
  
  // 2. Get relevant documents (RAG)
  const relevantDocs = await searchDocuments(projectId, query, {
    limit: 5
  });
  
  // 3. Get relevant IFC elements
  const relevantElements = await searchIFCElements(projectId, query, {
    limit: 10
  });
  
  // 4. Get recent issues
  const recentIssues = await getRecentIssues(projectId, {
    limit: 5,
    status: ['new', 'in_progress']
  });
  
  // 5. Build context
  return {
    projectId,
    userId,
    documents: relevantDocs,
    ifcElements: relevantElements,
    issues: recentIssues,
    projectMetadata: await getProjectMetadata(projectId)
  };
}
```

**Acceptance Criteria:**
- [ ] Context only includes accessible data
- [ ] No cross-project data leakage
- [ ] Context size optimized
- [ ] Fast context building (< 2s)

---

#### Task 2.9: Enhanced Chat Interface
**Priority:** 🟡 HIGH  
**Effort:** 3 days  
**Dependencies:** Task 2.8

```typescript
// src/components/chat/ProjectChat.tsx
export function ProjectChat({ projectId }: Props) {
  const handleMessage = async (message: string) => {
    // 1. Build context
    const context = await buildAIContext(userId, projectId, message);
    
    // 2. Call AI with context
    const response = await callAI({
      message,
      context,
      systemPrompt: `You are BOB, an AI assistant for construction projects.
        You have access to project documents, IFC models, and issues.
        Always cite your sources and stay within the project context.`
    });
    
    // 3. Display response with citations
    return response;
  };
  
  return (
    <div className="flex flex-col h-full">
      <ChatHeader projectName={project.name} />
      <ChatMessages messages={messages} />
      <ChatInput onSend={handleMessage} />
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Chat respects project context
- [ ] Responses cite sources
- [ ] Can answer about docs, IFC, issues
- [ ] Suggests actions
- [ ] Generates standard texts

---

## Phase 3: Production Features (Weeks 11-14)

### Week 11-12: Quality Controls

#### Task 3.1: Control System
**Priority:** 🟡 HIGH  
**Effort:** 5 days

```sql
-- Create controls table
CREATE TABLE controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('requirement', 'model_health', 'logistics')),
  ruleset JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create control_runs table
CREATE TABLE control_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id UUID REFERENCES controls(id) ON DELETE CASCADE,
  run_by UUID REFERENCES auth.users(id),
  run_at TIMESTAMP DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  findings_count INTEGER DEFAULT 0,
  duration_ms INTEGER
);

-- Create control_findings table
CREATE TABLE control_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_run_id UUID REFERENCES control_runs(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  description TEXT NOT NULL,
  element_guid TEXT,
  recommended_action TEXT,
  auto_created_issue_id UUID REFERENCES issues(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_findings ENABLE ROW LEVEL SECURITY;
```

**Acceptance Criteria:**
- [ ] Control definition UI
- [ ] Rule engine working
- [ ] Findings generated
- [ ] Auto-create issues option

---

### Week 13-14: Cut Lists (Basic Version)

#### Task 3.2: Cut List Generation
**Priority:** 🟡 HIGH  
**Effort:** 5 days

```sql
-- Create cutlists table
CREATE TABLE cutlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  zone TEXT,
  material_type TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create cutlist_items table
CREATE TABLE cutlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutlist_id UUID REFERENCES cutlists(id) ON DELETE CASCADE,
  position_number TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  length NUMERIC,
  width NUMERIC,
  height NUMERIC,
  cut_length NUMERIC,
  material TEXT,
  material_spec TEXT,
  zone TEXT,
  room TEXT,
  comment TEXT,
  ifc_element_guids TEXT[]
);

-- Enable RLS
ALTER TABLE cutlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE cutlist_items ENABLE ROW LEVEL SECURITY;
```

**Implementation:**
```typescript
// src/lib/cutlist-generator.ts
export async function generateCutList(params: {
  projectId: string;
  modelId: string;
  zone?: string;
  materialType?: string;
}): Promise<CutList> {
  // 1. Query IFC elements
  const elements = await queryElements(params);
  
  // 2. Group by material and dimensions
  const grouped = groupElements(elements);
  
  // 3. Generate position numbers
  const items = grouped.map((group, index) => ({
    positionNumber: `P${String(index + 1).padStart(3, '0')}`,
    quantity: group.count,
    dimensions: group.dimensions,
    material: group.material,
    // ...
  }));
  
  // 4. Save to database
  return await saveCutList({ ...params, items });
}
```

**Acceptance Criteria:**
- [ ] Generate cut list from IFC
- [ ] Filter by zone/material
- [ ] Export to PDF
- [ ] Export to XLSX
- [ ] Position numbers assigned

---

## Phase 4: Polish & Launch (Weeks 15-16)

### Week 15: Dashboard & Notifications

#### Task 4.1: Enhanced Dashboard
**Priority:** 🟡 HIGH  
**Effort:** 3 days

```typescript
// src/components/dashboard/ProjectDashboard.tsx
export function ProjectDashboard({ projectId }: Props) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Active Issues"
          value={stats.activeIssues}
          trend={stats.issuesTrend}
          icon={AlertCircle}
        />
        <KPICard
          title="Progress"
          value={`${stats.progress}%`}
          trend={stats.progressTrend}
          icon={TrendingUp}
        />
        {/* More KPIs */}
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Issues by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <IssueStatusChart data={stats.issuesByStatus} />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Progress Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressChart data={stats.progressHistory} />
          </CardContent>
        </Card>
      </div>
      
      {/* Activity Feed */}
      <Card>
        <CardHeader>
