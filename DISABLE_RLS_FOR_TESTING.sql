-- ============================================================================
-- DISABLE RLS FOR TESTING (TEMPORARY!)
-- ============================================================================
-- This is ONLY for development/testing
-- RLS MUST be enabled before production!
-- ============================================================================

-- Deaktiver RLS på alle nye tabeller
ALTER TABLE public.ifc_elements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.controls DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_findings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cutlist_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawing_snippets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_packages DISABLE ROW LEVEL SECURITY;

-- Verifiser at RLS er deaktivert
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '🔒 Enabled' ELSE '🔓 Disabled' END as "RLS Status"
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

-- Du skal se "🔓 Disabled" på alle 14 tabeller
