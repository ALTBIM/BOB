# User Creation and Admin Setup Guide

This guide explains how to check if a user exists and add them with platform admin rights.

**Target User:**
- Email: `andtheil@gmail.com`
- Password: `Winter2023!`
- Role: Platform Admin

---

## Method 1: Using Supabase Dashboard + SQL (Recommended)

This is the easiest method and requires access to Supabase Dashboard.

### Step 1: Create the User in Supabase Dashboard

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/uofsfpvtgxlkbeysvtkk
2. Navigate to **Authentication** → **Users**
3. Check if user `andtheil@gmail.com` already exists:
   - If **YES**: Note the User ID and skip to Step 2
   - If **NO**: Continue to create the user

4. Click **"Add user"** → **"Create new user"**
5. Fill in the details:
   - **Email**: `andtheil@gmail.com`
   - **Password**: `Winter2023!`
   - **Auto Confirm User**: ✅ **Check this box** (important!)
   - **User Metadata** (optional but recommended):
     ```json
     {
       "full_name": "Andreas Ludvigsen Theil",
       "name": "Andreas Ludvigsen Theil",
       "role": "Platform Admin",
       "company": "ALTBIM"
     }
     ```
6. Click **"Create user"**
7. **Copy the User ID** (you'll need it in the next step)

### Step 2: Add Admin Rights Using SQL

1. Go to **SQL Editor** in Supabase: https://supabase.com/dashboard/project/uofsfpvtgxlkbeysvtkk/sql/new
2. Run the helper function from `scripts/check-and-create-admin-user.sql`:

```sql
-- First, create the helper function
CREATE OR REPLACE FUNCTION public.add_admin_by_email(user_email TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  is_admin BOOLEAN,
  message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_already_admin BOOLEAN;
BEGIN
  SELECT id, auth.users.email INTO v_user_id, v_email
  FROM auth.users
  WHERE auth.users.email = user_email
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT 
      NULL::UUID, 
      user_email, 
      FALSE, 
      'User not found. Please create the user in Supabase Dashboard first.'::TEXT;
    RETURN;
  END IF;
  
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
```

3. Then run the function:

```sql
SELECT * FROM public.add_admin_by_email('andtheil@gmail.com');
```

4. You should see output like:
   ```
   user_id: <uuid>
   email: andtheil@gmail.com
   is_admin: true
   message: User successfully added as platform admin.
   ```

### Step 3: Verify

```sql
-- Verify admin status
SELECT 
  au.id as user_id,
  au.email,
  au.created_at as user_created,
  aa.created_at as admin_since
FROM auth.users au
LEFT JOIN public.app_admins aa ON aa.user_id = au.id
WHERE au.email = 'andtheil@gmail.com';
```

---

## Method 2: Using Node.js Script

If you have the Supabase service role key and prefer to use a script.

### Prerequisites

1. Create a `.env.local` file in the project root:

```bash
SUPABASE_URL=https://uofsfpvtgxlkbeysvtkk.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://uofsfpvtgxlkbeysvtkk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

2. Install dependencies (if not already installed):

```bash
npm install
```

### Run the Script

```bash
node scripts/create-admin-user.js
```

The script will:
1. Check if user `andtheil@gmail.com` exists
2. If not, create the user with password `Winter2023!`
3. Add the user to `app_admins` table
4. Display confirmation and credentials

---

## Method 3: Using Bootstrap API Endpoint

If the application is already running and you have the bootstrap secret.

### Prerequisites

You need the `BOOTSTRAP_SECRET` or `APP_ADMIN_BOOTSTRAP_SECRET` from your environment variables.

### Steps

1. First, create the user in Supabase Dashboard (see Method 1, Step 1)

2. Make a POST request to the bootstrap endpoint:

```bash
curl -X POST http://localhost:3000/api/bootstrap/platform-admin \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "YOUR_BOOTSTRAP_SECRET",
    "email": "andtheil@gmail.com"
  }'
```

Or use the API endpoint after authentication:

```bash
curl -X POST http://localhost:3000/api/admin/platform-admins \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "email": "andtheil@gmail.com"
  }'
```

---

## Login After Setup

Once the user is created and has admin rights:

1. Go to the application: http://localhost:3000
2. Click **"Logg inn"** or go to `/app`
3. Sign in with:
   - **Email**: `andtheil@gmail.com`
   - **Password**: `Winter2023!`

You will now have full platform admin access to:
- All organizations
- All projects
- All admin features
- User management
- System configuration

---

## Troubleshooting

### "User not found" error
- Make sure you created the user in Supabase Dashboard first
- Check the email address is exactly `andtheil@gmail.com` (lowercase)
- Verify the user exists in Authentication → Users

### "Cannot login" error
- Ensure "Auto Confirm User" was checked when creating the user
- Try resetting the password in Supabase Dashboard
- Check that the user's email is confirmed

### "No admin access" error
- Verify the user is in `app_admins` table:
  ```sql
  SELECT * FROM public.app_admins WHERE user_id = 'YOUR_USER_ID';
  ```
- Run the `add_admin_by_email()` function again

### Script errors
- Check that `.env.local` has correct Supabase credentials
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set (not the anon key)
- Verify database connection is working

---

## Security Notes

⚠️ **Important Security Reminders:**

1. **Change the password** after first login
2. **Keep service role key secret** - never commit it to git
3. **Use environment variables** for all credentials
4. The bootstrap endpoint should be **disabled in production** or protected with a strong secret
5. Platform admins have **full access** to all data - only grant to trusted users

---

## Next Steps

After successful login:

1. **Change your password** in user settings
2. Create or join an organization
3. Create projects
4. Invite other users
5. Configure project settings

For more information, see:
- [GETTING_STARTED.md](../GETTING_STARTED.md)
- [README.md](../README.md)
- [API_ENDPOINTS.md](../API_ENDPOINTS.md)
