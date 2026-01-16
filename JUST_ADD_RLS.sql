-- Just add RLS policies to new tables
-- Functions already exist, so we just use them

-- ============================================================================
-- Enable RLS on all new tables
-- ============================================================================

ALTER TABLE public.ifc_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cutlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawing_snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_packages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Add RLS Policies (using existing functions)
-- ============================================================================

-- IFC ELEMENTS
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

-- ISSUES
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

-- ISSUE COMMENTS
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

-- ISSUE HISTORY
DROP POLICY IF EXISTS "issue_history_select" ON public.issue_history;
CREATE POLICY "issue_history_select" ON public.issue_history FOR SELECT
USING (
  public.can_project_read(
    auth.uid(),
    (SELECT i.project_id FROM public.issues i WHERE i.id = issue_history.issue_id)
  )
);

-- CONTROLS
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

-- CONTROL RUNS
DROP POLICY IF EXISTS "control_runs_select" ON public.control_runs;
CREATE POLICY "control_runs_select" ON public.control_runs FOR SELECT
USING (public.can_project_read(auth.uid(), control_runs.project_id));

DROP POLICY IF EXISTS "control_runs_insert" ON public.control_runs;
CREATE POLICY "control_runs_insert" ON public.control_runs FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), control_runs.project_id));

-- CONTROL FINDINGS
DROP POLICY IF EXISTS "control_findings_select" ON public.control_findings;
CREATE POLICY "control_findings_select" ON public.control_findings FOR SELECT
USING (public.can_project_read(auth.uid(), control_findings.project_id));

DROP POLICY IF EXISTS "control_findings_insert" ON public.control_findings;
CREATE POLICY "control_findings_insert" ON public.control_findings FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), control_findings.project_id));

-- CUTLIST ITEMS
DROP POLICY IF EXISTS "cutlist_items_select" ON public.cutlist_items;
CREATE POLICY "cutlist_items_select" ON public.cutlist_items FOR SELECT
USING (public.can_project_read(auth.uid(), cutlist_items.project_id));

DROP POLICY IF EXISTS "cutlist_items_insert" ON public.cutlist_items;
CREATE POLICY "cutlist_items_insert" ON public.cutlist_items FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), cutlist_items.project_id));

-- DRAWING SNIPPETS
DROP POLICY IF EXISTS "drawing_snippets_select" ON public.drawing_snippets;
CREATE POLICY "drawing_snippets_select" ON public.drawing_snippets FOR SELECT
USING (public.can_project_read(auth.uid(), drawing_snippets.project_id));

DROP POLICY IF EXISTS "drawing_snippets_insert" ON public.drawing_snippets;
CREATE POLICY "drawing_snippets_insert" ON public.drawing_snippets FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), drawing_snippets.project_id));

-- ACTIVITY LOG
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

-- NOTIFICATIONS
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

-- FILE VERSIONS
DROP POLICY IF EXISTS "file_versions_select" ON public.file_versions;
CREATE POLICY "file_versions_select" ON public.file_versions FOR SELECT
USING (public.can_project_read(auth.uid(), file_versions.project_id));

DROP POLICY IF EXISTS "file_versions_insert" ON public.file_versions;
CREATE POLICY "file_versions_insert" ON public.file_versions FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), file_versions.project_id));

-- MEETINGS
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

-- MEETING PACKAGES
DROP POLICY IF EXISTS "meeting_packages_select" ON public.meeting_packages;
CREATE POLICY "meeting_packages_select" ON public.meeting_packages FOR SELECT
USING (public.can_project_read(auth.uid(), meeting_packages.project_id));

DROP POLICY IF EXISTS "meeting_packages_insert" ON public.meeting_packages;
CREATE POLICY "meeting_packages_insert" ON public.meeting_packages FOR INSERT
WITH CHECK (public.can_project_write(auth.uid(), meeting_packages.project_id));

-- ============================================================================
-- Verify setup - Should show all 14 tables with RLS enabled
-- ============================================================================

SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✅ Enabled' ELSE '❌ Disabled' END as "RLS Status"
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
