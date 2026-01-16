-- BOB Platform - Manglende database-tabeller
-- Basert på full spesifikasjon
-- Kjør dette etter eksisterende schema.sql

-- ============================================================================
-- IFC ELEMENTS (for SearchResultsPage-opplevelse)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ifc_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES public.ifc_models(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
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
  status TEXT DEFAULT 'ok' CHECK (status IN ('ok', 'avvik', 'til_kontroll')),
  supplier TEXT,
  responsible TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(model_id, guid)
);

-- Indekser for rask søk
CREATE INDEX IF NOT EXISTS idx_ifc_elements_model ON public.ifc_elements(model_id);
CREATE INDEX IF NOT EXISTS idx_ifc_elements_project ON public.ifc_elements(project_id);
CREATE INDEX IF NOT EXISTS idx_ifc_elements_type ON public.ifc_elements(element_type);
CREATE INDEX IF NOT EXISTS idx_ifc_elements_floor ON public.ifc_elements(floor);
CREATE INDEX IF NOT EXISTS idx_ifc_elements_zone ON public.ifc_elements(zone);
CREATE INDEX IF NOT EXISTS idx_ifc_elements_room ON public.ifc_elements(room);
CREATE INDEX IF NOT EXISTS idx_ifc_elements_material ON public.ifc_elements(material);
CREATE INDEX IF NOT EXISTS idx_ifc_elements_status ON public.ifc_elements(status);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_ifc_elements_search ON public.ifc_elements 
USING GIN (to_tsvector('english', 
  COALESCE(name, '') || ' ' || 
  COALESCE(description, '') || ' ' || 
  COALESCE(element_type, '')
));

-- RLS
ALTER TABLE public.ifc_elements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ifc_elements_select" ON public.ifc_elements;
CREATE POLICY "ifc_elements_select" ON public.ifc_elements FOR SELECT
USING (public.can_project_read(auth.uid(), ifc_elements.project_id));

DROP POLICY IF EXISTS "ifc_elements_insert" ON public.ifc_elements;
CREATE POLICY "ifc_elements_insert" ON public.ifc_elements FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), ifc_elements.project_id));

DROP POLICY IF EXISTS "ifc_elements_update" ON public.ifc_elements;
CREATE POLICY "ifc_elements_update" ON public.ifc_elements FOR UPDATE
USING (public.can_project_write(auth.uid(), ifc_elements.project_id));

DROP POLICY IF EXISTS "ifc_elements_delete" ON public.ifc_elements;
CREATE POLICY "ifc_elements_delete" ON public.ifc_elements FOR DELETE
USING (public.can_project_write(auth.uid(), ifc_elements.project_id));

-- ============================================================================
-- ISSUES (Avvik/RFI/Endringsforespørsler)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('avvik', 'rfi', 'endringsforespørsel')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ny' CHECK (status IN ('ny', 'under_behandling', 'avklart', 'lukket')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('lav', 'medium', 'høy', 'kritisk')),
  category TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  due_date TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  ifc_element_guids TEXT[] DEFAULT '{}',
  attachments JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_issues_project ON public.issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON public.issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON public.issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_assigned ON public.issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_created_by ON public.issues(created_by);
CREATE INDEX IF NOT EXISTS idx_issues_type ON public.issues(type);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_issues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_issues_updated_at ON public.issues;
CREATE TRIGGER trigger_issues_updated_at
  BEFORE UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION update_issues_updated_at();

-- RLS
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "issues_select" ON public.issues;
CREATE POLICY "issues_select" ON public.issues FOR SELECT
USING (public.can_project_read(auth.uid(), issues.project_id));

DROP POLICY IF EXISTS "issues_insert" ON public.issues;
CREATE POLICY "issues_insert" ON public.issues FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), issues.project_id));

DROP POLICY IF EXISTS "issues_update" ON public.issues;
CREATE POLICY "issues_update" ON public.issues FOR UPDATE
USING (public.can_project_write(auth.uid(), issues.project_id));

DROP POLICY IF EXISTS "issues_delete" ON public.issues;
CREATE POLICY "issues_delete" ON public.issues FOR DELETE
USING (public.can_project_admin(auth.uid(), issues.project_id));

-- ============================================================================
-- ISSUE COMMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  comment TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_comments_issue ON public.issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_comments_user ON public.issue_comments(user_id);

-- RLS
ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "issue_comments_select" ON public.issue_comments;
CREATE POLICY "issue_comments_select" ON public.issue_comments FOR SELECT
USING (
  public.can_project_read(
    auth.uid(),
    (SELECT i.project_id FROM public.issues i WHERE i.id = issue_comments.issue_id)
  )
);

DROP POLICY IF EXISTS "issue_comments_insert" ON public.issue_comments;
CREATE POLICY "issue_comments_insert" ON public.issue_comments FOR INSERT
WITH CHECK (
  public.can_project_write(
    auth.uid(),
    (SELECT i.project_id FROM public.issues i WHERE i.id = issue_comments.issue_id)
  )
);

-- ============================================================================
-- ISSUE HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.issue_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  changes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_history_issue ON public.issue_history(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_history_created ON public.issue_history(created_at DESC);

-- RLS
ALTER TABLE public.issue_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "issue_history_select" ON public.issue_history;
CREATE POLICY "issue_history_select" ON public.issue_history FOR SELECT
USING (
  public.can_project_read(
    auth.uid(),
    (SELECT i.project_id FROM public.issues i WHERE i.id = issue_history.issue_id)
  )
);

-- ============================================================================
-- CONTROLS (Kvalitetskontroller)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('kravkontroll', 'modellhelse', 'logistikk')),
  ruleset JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_controls_project ON public.controls(project_id);
CREATE INDEX IF NOT EXISTS idx_controls_type ON public.controls(type);

-- RLS
ALTER TABLE public.controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "controls_select" ON public.controls;
CREATE POLICY "controls_select" ON public.controls FOR SELECT
USING (public.can_project_read(auth.uid(), controls.project_id));

DROP POLICY IF EXISTS "controls_insert" ON public.controls;
CREATE POLICY "controls_insert" ON public.controls FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), controls.project_id));

DROP POLICY IF EXISTS "controls_update" ON public.controls;
CREATE POLICY "controls_update" ON public.controls FOR UPDATE
USING (public.can_project_write(auth.uid(), controls.project_id));

DROP POLICY IF EXISTS "controls_delete" ON public.controls;
CREATE POLICY "controls_delete" ON public.controls FOR DELETE
USING (public.can_project_admin(auth.uid(), controls.project_id));

-- ============================================================================
-- CONTROL RUNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.control_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id UUID NOT NULL REFERENCES public.controls(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  run_by UUID REFERENCES auth.users(id),
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'kjører' CHECK (status IN ('kjører', 'fullført', 'feilet')),
  findings_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_control_runs_control ON public.control_runs(control_id);
CREATE INDEX IF NOT EXISTS idx_control_runs_project ON public.control_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_control_runs_run_at ON public.control_runs(run_at DESC);

-- RLS
ALTER TABLE public.control_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "control_runs_select" ON public.control_runs;
CREATE POLICY "control_runs_select" ON public.control_runs FOR SELECT
USING (public.can_project_read(auth.uid(), control_runs.project_id));

DROP POLICY IF EXISTS "control_runs_insert" ON public.control_runs;
CREATE POLICY "control_runs_insert" ON public.control_runs FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), control_runs.project_id));

-- ============================================================================
-- CONTROL FINDINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.control_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_run_id UUID NOT NULL REFERENCES public.control_runs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'advarsel', 'feil', 'kritisk')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  element_guid TEXT,
  element_type TEXT,
  location JSONB,
  recommended_action TEXT,
  auto_created_issue_id UUID REFERENCES public.issues(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_control_findings_run ON public.control_findings(control_run_id);
CREATE INDEX IF NOT EXISTS idx_control_findings_project ON public.control_findings(project_id);
CREATE INDEX IF NOT EXISTS idx_control_findings_severity ON public.control_findings(severity);

-- RLS
ALTER TABLE public.control_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "control_findings_select" ON public.control_findings;
CREATE POLICY "control_findings_select" ON public.control_findings FOR SELECT
USING (public.can_project_read(auth.uid(), control_findings.project_id));

DROP POLICY IF EXISTS "control_findings_insert" ON public.control_findings;
CREATE POLICY "control_findings_insert" ON public.control_findings FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), control_findings.project_id));

-- ============================================================================
-- CUTLIST ITEMS (Detaljert kappliste-struktur)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cutlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutlist_id UUID NOT NULL REFERENCES public.kapplister(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
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
  ifc_element_guids TEXT[] DEFAULT '{}',
  drawing_snippet_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cutlist_items_cutlist ON public.cutlist_items(cutlist_id);
CREATE INDEX IF NOT EXISTS idx_cutlist_items_project ON public.cutlist_items(project_id);
CREATE INDEX IF NOT EXISTS idx_cutlist_items_position ON public.cutlist_items(position_number);

-- RLS
ALTER TABLE public.cutlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cutlist_items_select" ON public.cutlist_items;
CREATE POLICY "cutlist_items_select" ON public.cutlist_items FOR SELECT
USING (public.can_project_read(auth.uid(), cutlist_items.project_id));

DROP POLICY IF EXISTS "cutlist_items_insert" ON public.cutlist_items;
CREATE POLICY "cutlist_items_insert" ON public.cutlist_items FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), cutlist_items.project_id));

-- ============================================================================
-- DRAWING SNIPPETS (Tegningsutsnitt med pos.nr)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.drawing_snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  cutlist_id UUID REFERENCES public.kapplister(id) ON DELETE CASCADE,
  position_number TEXT NOT NULL,
  snippet_type TEXT CHECK (snippet_type IN ('plan', 'snitt', 'detalj', '3d')),
  image_url TEXT,
  thumbnail_url TEXT,
  coordinates JSONB,
  annotations JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drawing_snippets_project ON public.drawing_snippets(project_id);
CREATE INDEX IF NOT EXISTS idx_drawing_snippets_cutlist ON public.drawing_snippets(cutlist_id);
CREATE INDEX IF NOT EXISTS idx_drawing_snippets_position ON public.drawing_snippets(position_number);

-- RLS
ALTER TABLE public.drawing_snippets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drawing_snippets_select" ON public.drawing_snippets;
CREATE POLICY "drawing_snippets_select" ON public.drawing_snippets FOR SELECT
USING (public.can_project_read(auth.uid(), drawing_snippets.project_id));

DROP POLICY IF EXISTS "drawing_snippets_insert" ON public.drawing_snippets;
CREATE POLICY "drawing_snippets_insert" ON public.drawing_snippets FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), drawing_snippets.project_id));

-- ============================================================================
-- ACTIVITY LOG (Full revisjonslogg)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  org_id UUID REFERENCES public.organizations(id),
  project_id UUID REFERENCES public.projects(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_org ON public.activity_log(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_project ON public.activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON public.activity_log(action);

-- RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_log_select" ON public.activity_log;
CREATE POLICY "activity_log_select" ON public.activity_log FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_app_admin(auth.uid())
  OR (org_id IS NOT NULL AND public.is_org_admin(auth.uid(), org_id))
  OR (project_id IS NOT NULL AND public.can_project_read(auth.uid(), project_id))
);

DROP POLICY IF EXISTS "activity_log_insert" ON public.activity_log;
CREATE POLICY "activity_log_insert" ON public.activity_log FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT,
  message TEXT,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_project ON public.notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE
USING (user_id = auth.uid());

-- ============================================================================
-- FILE VERSIONS (Bedre versjonshåndtering)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  size BIGINT,
  storage_url TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_summary TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(file_id, version)
);

CREATE INDEX IF NOT EXISTS idx_file_versions_file ON public.file_versions(file_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_project ON public.file_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_version ON public.file_versions(file_id, version DESC);

-- RLS
ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "file_versions_select" ON public.file_versions;
CREATE POLICY "file_versions_select" ON public.file_versions FOR SELECT
USING (public.can_project_read(auth.uid(), file_versions.project_id));

DROP POLICY IF EXISTS "file_versions_insert" ON public.file_versions;
CREATE POLICY "file_versions_insert" ON public.file_versions FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), file_versions.project_id));

-- ============================================================================
-- MEETINGS (Møter)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 60,
  location TEXT,
  meeting_type TEXT,
  status TEXT DEFAULT 'planlagt' CHECK (status IN ('planlagt', 'pågår', 'fullført', 'avlyst')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  control_run_id UUID REFERENCES public.control_runs(id),
  agenda JSONB DEFAULT '[]'::jsonb,
  participants JSONB DEFAULT '[]'::jsonb,
  decision_points JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_meetings_project ON public.meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON public.meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_control_run ON public.meetings(control_run_id);

-- RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
CREATE POLICY "meetings_select" ON public.meetings FOR SELECT
USING (public.can_project_read(auth.uid(), meetings.project_id));

DROP POLICY IF EXISTS "meetings_insert" ON public.meetings;
CREATE POLICY "meetings_insert" ON public.meetings FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), meetings.project_id));

DROP POLICY IF EXISTS "meetings_update" ON public.meetings;
CREATE POLICY "meetings_update" ON public.meetings FOR UPDATE
USING (public.can_project_write(auth.uid(), meetings.project_id));

DROP POLICY IF EXISTS "meetings_delete" ON public.meetings;
CREATE POLICY "meetings_delete" ON public.meetings FOR DELETE
USING (public.can_project_admin(auth.uid(), meetings.project_id));

-- ============================================================================
-- MEETING PACKAGES (Møtepakker)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.meeting_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  pdf_url TEXT,
  summary TEXT,
  top_risks JSONB DEFAULT '[]'::jsonb,
  findings JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_packages_meeting ON public.meeting_packages(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_packages_project ON public.meeting_packages(project_id);

-- RLS
ALTER TABLE public.meeting_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meeting_packages_select" ON public.meeting_packages;
CREATE POLICY "meeting_packages_select" ON public.meeting_packages FOR SELECT
USING (public.can_project_read(auth.uid(), meeting_packages.project_id));

DROP POLICY IF EXISTS "meeting_packages_insert" ON public.meeting_packages;
CREATE POLICY "meeting_packages_insert" ON public.meeting_packages FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), meeting_packages.project_id));

-- ============================================================================
-- Refresh PostgREST schema cache
-- ============================================================================

SELECT pg_notify('pgrst', 'reload schema');

-- ============================================================================
-- FERDIG!
-- ============================================================================

-- Verifiser at alle tabeller er opprettet:
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'ifc_elements',
    'issues',
    'issue_comments',
    'issue_history',
    'controls',
    'control_runs',
    'control_findings',
    'cutlist_items',
    'drawing_snippets',
    'activity_log',
    'notifications',
    'file_versions',
    'meetings',
    'meeting_packages'
  )
ORDER BY tablename;
