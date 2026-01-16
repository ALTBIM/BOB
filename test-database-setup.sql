-- BOB Platform - Database Setup Verification Script
-- Kjør dette scriptet for å verifisere at migreringen var vellykket
-- Estimert tid: 2 minutter

\echo '========================================='
\echo 'BOB Platform - Database Verification'
\echo '========================================='
\echo ''

-- 1. Sjekk at alle tabeller eksisterer
\echo '1. Checking if all tables exist...'
SELECT 
  CASE 
    WHEN COUNT(*) = 14 THEN '✅ All 14 tables created successfully'
    ELSE '❌ Missing tables! Expected 14, found ' || COUNT(*)
  END as status
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
  );

\echo ''
\echo '2. Listing all new tables with RLS status...'
SELECT 
  tablename as "Table Name",
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

\echo ''
\echo '3. Checking indexes...'
SELECT 
  COUNT(*) as "Total Indexes",
  CASE 
    WHEN COUNT(*) >= 30 THEN '✅ Sufficient indexes created'
    ELSE '⚠️  Expected at least 30 indexes, found ' || COUNT(*)
  END as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'ifc_elements',
    'issues',
    'issue_comments',
    'controls',
    'control_runs',
    'cutlist_items',
    'drawing_snippets',
    'activity_log',
    'notifications',
    'file_versions',
    'meetings'
  );

\echo ''
\echo '4. Checking critical indexes...'
SELECT 
  indexname as "Index Name",
  tablename as "Table",
  CASE 
    WHEN indexdef LIKE '%USING gin%' THEN '🔍 Full-text search'
    WHEN indexdef LIKE '%UNIQUE%' THEN '🔑 Unique constraint'
    ELSE '📊 Regular index'
  END as "Type"
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_ifc_elements_search',
    'idx_ifc_elements_project',
    'idx_ifc_elements_type',
    'idx_ifc_elements_floor',
    'idx_issues_project',
    'idx_issues_status',
    'idx_activity_log_project',
    'idx_notifications_user'
  )
ORDER BY tablename, indexname;

\echo ''
\echo '5. Checking RLS policies...'
SELECT 
  schemaname as "Schema",
  tablename as "Table",
  policyname as "Policy Name",
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    ELSE cmd
  END as "Command"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'ifc_elements',
    'issues',
    'controls',
    'activity_log',
    'notifications'
  )
ORDER BY tablename, policyname
LIMIT 20;

\echo ''
\echo '6. Checking helper functions...'
SELECT 
  proname as "Function Name",
  CASE 
    WHEN proname LIKE '%admin%' THEN '👤 Admin check'
    WHEN proname LIKE '%read%' THEN '📖 Read permission'
    WHEN proname LIKE '%write%' THEN '✏️  Write permission'
    ELSE '🔧 Utility'
  END as "Type"
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'is_app_admin',
    'is_org_admin',
    'can_project_read',
    'can_project_write',
    'can_project_admin'
  )
ORDER BY proname;

\echo ''
\echo '7. Checking foreign key constraints...'
SELECT 
  COUNT(*) as "Total Foreign Keys",
  CASE 
    WHEN COUNT(*) >= 20 THEN '✅ Foreign keys properly set up'
    ELSE '⚠️  Expected at least 20 foreign keys, found ' || COUNT(*)
  END as status
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
  AND constraint_type = 'FOREIGN KEY'
  AND table_name IN (
    'ifc_elements',
    'issues',
    'issue_comments',
    'controls',
    'control_runs',
    'cutlist_items',
    'drawing_snippets'
  );

\echo ''
\echo '8. Sample data check (existing tables)...'
SELECT 
  'organizations' as "Table",
  COUNT(*) as "Row Count"
FROM organizations
UNION ALL
SELECT 
  'projects' as "Table",
  COUNT(*) as "Row Count"
FROM projects
UNION ALL
SELECT 
  'files' as "Table",
  COUNT(*) as "Row Count"
FROM files
UNION ALL
SELECT 
  'ifc_models' as "Table",
  COUNT(*) as "Row Count"
FROM ifc_models
ORDER BY "Table";

\echo ''
\echo '========================================='
\echo 'Verification Complete!'
\echo '========================================='
\echo ''
\echo 'Next steps:'
\echo '1. Review the output above'
\echo '2. Verify all checks show ✅'
\echo '3. If any checks show ❌, review DATABASE_MIGRATIONS.sql'
\echo '4. Proceed to STEP_1_DATABASE_SETUP.md for detailed testing'
\echo ''
