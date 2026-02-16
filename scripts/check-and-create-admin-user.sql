-- SQL Script to check if a user exists and add them as platform admin
-- This script should be run in the Supabase SQL Editor
-- 
-- SECURITY NOTE: This script contains example credentials for the repository owner.
-- Replace 'andtheil@gmail.com' with your own email when creating your own admin user.
-- The email mentioned is already publicly visible on the landing page.
-- 
-- Instructions:
-- 1. First, create the user in Supabase Dashboard:
--    - Go to Authentication > Users
--    - Click "Add user" > "Create new user"
--    - Email: [YOUR_EMAIL] (e.g., andtheil@gmail.com for the repo owner)
--    - Password: [YOUR_SECURE_PASSWORD] (e.g., Winter2023!)
--    - Auto Confirm User: YES (check this box)
--    - Click "Create user"
--
-- 2. Then run this SQL script to add admin rights
--
-- Note: Replace 'USER_ID_HERE' with the actual user ID from step 1

-- Option 1: If you know the user ID, use this:
-- INSERT INTO public.app_admins (user_id)
-- VALUES ('USER_ID_HERE')
-- ON CONFLICT (user_id) DO NOTHING;

-- Option 2: If you only know the email, use this query to find the user ID first:
-- You'll need to check auth.users table (requires service role access)
-- SELECT id, email, created_at FROM auth.users WHERE email = 'andtheil@gmail.com';

-- After you get the user ID, run:
-- INSERT INTO public.app_admins (user_id)
-- VALUES ('paste-user-id-here')
-- ON CONFLICT (user_id) DO NOTHING;

-- Verify admin status:
-- SELECT 
--   au.id as user_id,
--   au.email,
--   aa.created_at as admin_since
-- FROM auth.users au
-- LEFT JOIN public.app_admins aa ON aa.user_id = au.id
-- WHERE au.email = 'andtheil@gmail.com';

-- Alternative: Create a function to add admin by email (requires service role)
CREATE OR REPLACE FUNCTION public.add_admin_by_email(user_email TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  is_admin BOOLEAN,
  message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to access auth.users
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_already_admin BOOLEAN;
BEGIN
  -- Find user by email
  SELECT id, auth.users.email INTO v_user_id, v_email
  FROM auth.users
  WHERE auth.users.email = user_email
  LIMIT 1;
  
  -- Check if user exists
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT 
      NULL::UUID, 
      user_email, 
      FALSE, 
      'User not found. Please create the user in Supabase Dashboard first.'::TEXT;
    RETURN;
  END IF;
  
  -- Check if already admin
  SELECT EXISTS(
    SELECT 1 FROM public.app_admins WHERE app_admins.user_id = v_user_id
  ) INTO v_already_admin;
  
  IF v_already_admin THEN
    RETURN QUERY SELECT 
      v_user_id, 
      v_email, 
      TRUE, 
      'User is already a platform admin.'::TEXT;
    RETURN;
  END IF;
  
  -- Add as admin
  INSERT INTO public.app_admins (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN QUERY SELECT 
    v_user_id, 
    v_email, 
    TRUE, 
    'User successfully added as platform admin.'::TEXT;
END;
$$;

-- Usage example:
-- SELECT * FROM public.add_admin_by_email('andtheil@gmail.com');
