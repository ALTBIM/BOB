-- Create helper functions for RLS policies
-- These functions check user permissions

-- ============================================================================
-- Helper function: Check if user is app admin
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_app_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_admins aa WHERE aa.user_id = uid
  );
$$;

-- ============================================================================
-- Helper function: Check if user is org admin
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_org_admin(uid uuid, org uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.org_id = org AND om.user_id = uid AND om.org_role = 'org_admin'
  );
$$;

-- ============================================================================
-- Helper function: Check if user can read project
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_project_read(uid uuid, pid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_app_admin(uid)
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = pid AND pm.user_id = uid
    )
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      JOIN public.projects p ON p.org_id = om.org_id
      WHERE p.id = pid AND om.user_id = uid AND om.org_role = 'org_admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = pid AND p.created_by = uid
    );
$$;

-- ============================================================================
-- Helper function: Check if user can write to project
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_project_write(uid uuid, pid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_app_admin(uid)
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      JOIN public.projects p ON p.org_id = om.org_id
      WHERE p.id = pid AND om.user_id = uid AND om.org_role = 'org_admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = pid
        AND pm.user_id = uid
        AND pm.access_level IN ('write','admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = pid AND p.created_by = uid
    );
$$;

-- ============================================================================
-- Helper function: Check if user is project admin
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_project_admin(uid uuid, pid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_app_admin(uid)
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      JOIN public.projects p ON p.org_id = om.org_id
      WHERE p.id = pid AND om.user_id = uid AND om.org_role = 'org_admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = pid
        AND pm.user_id = uid
        AND pm.access_level = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = pid AND p.created_by = uid
    );
$$;

-- ============================================================================
-- Verify functions created
-- ============================================================================

SELECT 
  routine_name as "Function Name",
  '✅ Created' as "Status"
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'is_app_admin',
    'is_org_admin',
    'can_project_read',
    'can_project_write',
    'can_project_admin'
  )
ORDER BY routine_name;
