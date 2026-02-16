# BOB Platform - Implementation Roadmap

**Version:** 1.0  
**Date:** February 16, 2026  
**Target:** Production-ready platform with all functional requirements  
**Timeline:** 16 weeks (4 months)

---

## Executive Summary

This roadmap provides a detailed, step-by-step plan to implement all functional requirements specified in `BOB_FUNCTIONAL_REQUIREMENTS.md`. The implementation is divided into 4 phases over 16 weeks, prioritizing security foundation, core features, advanced capabilities, and finally integration and polish.

---

## Phase 1: Foundation & Security (Weeks 1-4)

**Goal:** Establish a secure, multi-tenant foundation with proper RBAC and data isolation.

### Week 1-2: Multi-Tenant Architecture

#### Database Schema Updates

**Files to create/modify:**
- `supabase/migrations/001_multi_tenant_foundation.sql`

**Tasks:**
1. Verify `organizations` table (already exists in schema.sql)
2. Verify `organization_members` table (already exists in schema.sql)
3. Verify `app_admins` table (already exists in schema.sql)
4. Add missing columns to existing tables:
   ```sql
   -- Ensure org_id exists on projects
   ALTER TABLE projects ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);
   
   -- Ensure access_level exists on project_members
   ALTER TABLE project_members ADD COLUMN IF NOT EXISTS access_level TEXT DEFAULT 'read';
   ```

#### Row Level Security (RLS) Policies

**Files to create/modify:**
- `supabase/migrations/002_rls_policies.sql`

**Policies to implement:**

1. **Organizations:**
   ```sql
   -- Users see only organizations they are members of
   CREATE POLICY "org_member_select" ON organizations FOR SELECT
   USING (
     id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
     OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
   );
   ```

2. **Projects:**
   ```sql
   -- Users see only projects in their organizations
   CREATE POLICY "project_org_member_select" ON projects FOR SELECT
   USING (
     org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
     OR id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
     OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
   );
   ```

3. **Files:**
   ```sql
   -- Users see only files from projects they have access to
   CREATE POLICY "file_project_member_select" ON files FOR SELECT
   USING (
     project_id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid())
     OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
   );
   ```

#### API Routes - Organizations

**Files to create:**
- `src/app/api/organizations/route.ts` - List/Create orgs
- `src/app/api/organizations/[id]/route.ts` - Get/Update/Delete org
- `src/app/api/organizations/[id]/members/route.ts` - List/Add members
- `src/app/api/organizations/[id]/members/[userId]/route.ts` - Update/Remove member

**Key functions:**
```typescript
// Check if user is platform admin
async function isPlatformAdmin(userId: string): Promise<boolean>

// Check if user is org admin
async function isOrgAdmin(userId: string, orgId: string): Promise<boolean>

// Check user's access level in project
async function getProjectAccessLevel(userId: string, projectId: string): Promise<'read'|'write'|'admin'|null>
```

#### Admin UI Components

**Files to create:**
- `src/components/admin/PlatformAdminPanel.tsx`
- `src/components/admin/OrgAdminPanel.tsx`
- `src/components/admin/ProjectAdminPanel.tsx`
- `src/components/admin/AdminGuard.tsx`

**Admin routes to create:**
- `src/app/admin/platform/page.tsx` - Platform admin dashboard
- `src/app/admin/organization/page.tsx` - Org admin dashboard
- `src/app/admin/project/[id]/page.tsx` - Project admin dashboard

### Week 3-4: Enhanced File Management & Activity Logging

#### Enhanced File Schema

**Files to modify:**
- `supabase/migrations/003_enhanced_files.sql`

```sql
ALTER TABLE files ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS extracted_text TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS change_summary TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS annotations JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  version INT NOT NULL,
  path TEXT NOT NULL,
  size BIGINT,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_summary TEXT,
  UNIQUE(file_id, version)
);
```

#### Activity Logging

**Files to create:**
- `supabase/migrations/004_activity_logging.sql`

```sql
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  org_id UUID REFERENCES organizations(id),
  project_id UUID REFERENCES projects(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX activity_log_user_idx ON activity_log(user_id);
CREATE INDEX activity_log_org_idx ON activity_log(org_id);
CREATE INDEX activity_log_project_idx ON activity_log(project_id);
CREATE INDEX activity_log_created_idx ON activity_log(created_at DESC);
```

**Files to create:**
- `src/lib/activity-logger.ts` - Logging utilities
- `src/components/ActivityFeed.tsx` - Display activity

---

## Phase 2: Core Features (Weeks 5-10)

**Goal:** Implement essential user-facing features for file management, search, and AI assistance.

### Week 5-6: Auto-Analysis & Knowledge Base

#### Knowledge Base Schema

**Files to create:**
- `supabase/migrations/005_knowledge_base.sql`

```sql
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  chunk_index INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX document_chunks_file_idx ON document_chunks(file_id);
CREATE INDEX document_chunks_project_idx ON document_chunks(project_id);
CREATE INDEX document_chunks_embedding_idx ON document_chunks USING ivfflat (embedding vector_cosine_ops);
```

#### File Processing Pipeline

**Files to create:**
- `src/lib/file-processing/pdf-extractor.ts`
- `src/lib/file-processing/docx-extractor.ts`
- `src/lib/file-processing/ifc-extractor.ts`
- `src/lib/file-processing/chunker.ts`
- `src/lib/file-processing/embedder.ts`
- `src/lib/file-processing/indexer.ts`

**API routes:**
- `src/app/api/files/[id]/analyze/route.ts` - Trigger analysis
- `src/app/api/files/[id]/chunks/route.ts` - Get chunks

### Week 7-8: IFC Viewer Enhancement

#### IFC Search Schema

**Files to create:**
- `supabase/migrations/006_ifc_search.sql`

```sql
CREATE TABLE IF NOT EXISTS ifc_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ifc_model_id UUID NOT NULL REFERENCES ifc_models(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  global_id TEXT NOT NULL,
  ifc_type TEXT NOT NULL,
  name TEXT,
  description TEXT,
  properties JSONB DEFAULT '{}'::jsonb,
  geometry JSONB,
  floor TEXT,
  zone TEXT,
  material TEXT,
  fire_rating TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ifc_elements_model_idx ON ifc_elements(ifc_model_id);
CREATE INDEX ifc_elements_project_idx ON ifc_elements(project_id);
CREATE INDEX ifc_elements_type_idx ON ifc_elements(ifc_type);
CREATE INDEX ifc_elements_floor_idx ON ifc_elements(floor);
CREATE INDEX ifc_elements_zone_idx ON ifc_elements(zone);
CREATE INDEX ifc_elements_material_idx ON ifc_elements(material);
CREATE INDEX ifc_elements_properties_idx ON ifc_elements USING gin(properties);
```

#### IFC Search Components

**Files to create:**
- `src/components/ifc/IFCSearchPanel.tsx`
- `src/components/ifc/IFCSearchResults.tsx`
- `src/components/ifc/IFCFacetFilter.tsx`
- `src/components/ifc/IFCResultItem.tsx`

**API routes:**
- `src/app/api/ifc/search/route.ts` - Search IFC elements
- `src/app/api/ifc/[modelId]/elements/route.ts` - List elements
- `src/app/api/ifc/[modelId]/facets/route.ts` - Get available facets

### Week 9-10: Project-Aware AI & Chat

#### AI Integration

**Files to create:**
- `src/lib/ai/project-context.ts` - Build project context
- `src/lib/ai/rag-query.ts` - RAG query system
- `src/lib/ai/chat-handler.ts` - Handle chat requests

**API routes:**
- `src/app/api/ai/chat/route.ts` - Chat endpoint
- `src/app/api/ai/context/[projectId]/route.ts` - Get project context

**Security features:**
- Project isolation enforcement
- Permission-based context filtering
- Audit logging for AI queries

---

## Phase 3: Advanced Features (Weeks 11-14)

**Goal:** Implement quality controls, production features, and dashboard enhancements.

### Week 11-12: Dashboard & Quality Controls

#### Dashboard Components

**Files to create:**
- `src/app/dashboard/page.tsx` - Main dashboard
- `src/components/dashboard/ProjectCards.tsx`
- `src/components/dashboard/ActivityFeed.tsx`
- `src/components/dashboard/CalendarView.tsx`
- `src/components/dashboard/QuickStats.tsx`
- `src/components/dashboard/NotificationCenter.tsx`

#### Quality Control Schema

**Files to create:**
- `supabase/migrations/007_quality_controls.sql`

```sql
CREATE TABLE IF NOT EXISTS controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'requirement', 'model', 'logistics'
  name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  executed_by UUID,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS control_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id UUID NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  severity TEXT NOT NULL, -- 'high', 'medium', 'low'
  title TEXT NOT NULL,
  description TEXT,
  ifc_element_ids TEXT[],
  status TEXT DEFAULT 'open',
  assigned_to UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Meeting Suggestion System

**Files to create:**
- `src/lib/meetings/suggest-participants.ts`
- `src/lib/meetings/generate-agenda.ts`
- `src/components/meetings/MeetingSuggestion.tsx`

### Week 13-14: Production Features

#### Cut List Schema

**Files to create:**
- `supabase/migrations/008_production_features.sql`

```sql
CREATE TABLE IF NOT EXISTS cut_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ifc_model_id UUID REFERENCES ifc_models(id),
  name TEXT NOT NULL,
  zone TEXT,
  material_type TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cut_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cut_list_id UUID NOT NULL REFERENCES cut_lists(id) ON DELETE CASCADE,
  position_number INT NOT NULL,
  quantity INT NOT NULL,
  dimensions TEXT,
  cut_length NUMERIC,
  material TEXT,
  ifc_element_ids TEXT[],
  drawing_snippet_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drawing_snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cut_list_id UUID REFERENCES cut_lists(id),
  type TEXT, -- 'plan', 'section'
  image_url TEXT,
  position_numbers INT[],
  zone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Production Components

**Files to create:**
- `src/components/production/CutListGenerator.tsx`
- `src/components/production/DrawingSnippetViewer.tsx`
- `src/lib/production/generate-cut-list.ts`
- `src/lib/production/generate-drawing-snippets.ts`

---

## Phase 4: Integration & Polish (Weeks 15-16)

**Goal:** Complete integrations, export features, and prepare for production.

### Week 15: Simplebim & Export Features

#### Simplebim Integration

**Files to create:**
- `src/lib/simplebim/cli-wrapper.ts`
- `src/lib/simplebim/script-generator.ts`
- `src/components/simplebim/ScriptWizard.tsx`
- `src/app/api/simplebim/execute/route.ts`

#### Export Features

**Files to create:**
- `src/lib/export/word-exporter.ts`
- `src/lib/export/excel-exporter.ts`
- `src/lib/export/pdf-exporter.ts`
- `src/components/export/ExportDialog.tsx`

### Week 16: Chat Enhancement & Final Polish

#### Chat Schema

**Files to create:**
- `supabase/migrations/009_enhanced_chat.sql`

```sql
CREATE TABLE IF NOT EXISTS chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'project', 'private'
  is_archived BOOLEAN DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  parent_message_id UUID,
  status TEXT DEFAULT 'open', -- 'open', 'resolved', 'blocked'
  is_decision BOOLEAN DEFAULT FALSE,
  object_type TEXT,
  object_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Chat Components

**Files to create:**
- `src/components/chat/ChannelList.tsx`
- `src/components/chat/ThreadView.tsx`
- `src/components/chat/ObjectChat.tsx`
- `src/components/chat/ChatSearch.tsx`
- `src/components/chat/ConvertToIssue.tsx`

---

## Testing Strategy

### Unit Tests
- Database functions and policies
- API route handlers
- UI components
- Utility functions

### Integration Tests
- File upload and processing
- IFC search functionality
- AI chat with project context
- Permission enforcement

### End-to-End Tests
- Complete user workflows
- Multi-tenant isolation
- Admin operations
- Export features

### Security Tests
- RLS policy validation
- Cross-tenant access attempts
- Permission boundary testing
- File access control

---

## Deployment Checklist

### Pre-Production
- [ ] All migrations tested on staging
- [ ] RLS policies verified
- [ ] Security audit completed
- [ ] Performance testing completed
- [ ] Documentation updated

### Production Setup
- [ ] Environment variables configured
- [ ] Database backups enabled
- [ ] Monitoring and alerting configured
- [ ] SSL certificates installed
- [ ] CDN configured for file delivery

### Post-Deployment
- [ ] Smoke tests passed
- [ ] Performance metrics within targets
- [ ] Error tracking active
- [ ] User training completed
- [ ] Support documentation published

---

## Success Metrics

### Technical Metrics
- API response time p95 < 500ms
- IFC search response time < 2s
- Zero critical security vulnerabilities
- 99.9% uptime
- Test coverage > 80%

### Functional Metrics
- All admin roles functional
- All project isolation verified
- All file access controlled
- All AI queries project-scoped
- All exports working

### Business Metrics
- 5 pilot projects onboarded
- 20+ active users
- 100+ IFC files processed
- 500+ issues tracked
- NPS > 40

---

## Risk Mitigation

### Technical Risks
1. **Performance issues with large IFC files**
   - Mitigation: Implement streaming, chunking, caching
   
2. **Vector search performance**
   - Mitigation: Use proper indexes, limit context window

3. **File storage costs**
   - Mitigation: Implement retention policies, compression

### Security Risks
1. **Data leakage between projects**
   - Mitigation: Comprehensive RLS testing, security audit
   
2. **AI hallucination with wrong project data**
   - Mitigation: Strict context filtering, audit logging

### Business Risks
1. **Scope creep**
   - Mitigation: Strict adherence to roadmap, change control
   
2. **User adoption**
   - Mitigation: User training, clear documentation, pilot program

---

## Next Steps

1. **Review and approve this roadmap**
2. **Set up project management tools** (Jira, Linear, etc.)
3. **Assign development team**
4. **Create sprint 1 backlog** (Weeks 1-2)
5. **Begin Phase 1 implementation**

---

**Document prepared by:** GitHub Copilot  
**For:** ALTBIM/BOB Platform  
**Last updated:** February 16, 2026
