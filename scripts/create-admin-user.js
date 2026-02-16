/**
 * Script to check if a user exists and create them with admin rights
 * Usage: node scripts/create-admin-user.js
 * 
 * This script will:
 * 1. Check if user with email andtheil@gmail.com exists
 * 2. If not, create the user with password Winter2023!
 * 3. Add the user to app_admins table for platform admin rights
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const TARGET_EMAIL = 'andtheil@gmail.com';
const TARGET_PASSWORD = 'Winter2023!';

async function main() {
  console.log('🔍 Checking for user registration...\n');

  // Get Supabase credentials from environment
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing Supabase credentials');
    console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    process.exit(1);
  }

  // Create Supabase client with service role key (has admin privileges)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Step 1: Check if user exists
    console.log(`📧 Looking for user: ${TARGET_EMAIL}`);
    
    const { data: existingUser, error: getUserError } = await supabase.auth.admin.listUsers();
    
    if (getUserError) {
      throw new Error(`Failed to list users: ${getUserError.message}`);
    }

    const user = existingUser.users.find(u => u.email === TARGET_EMAIL);

    let userId;

    if (user) {
      console.log(`✅ User found!`);
      console.log(`   - Email: ${user.email}`);
      console.log(`   - User ID: ${user.id}`);
      console.log(`   - Created: ${new Date(user.created_at).toLocaleString()}`);
      userId = user.id;
    } else {
      console.log(`⚠️  User not found. Creating new user...`);
      
      // Step 2: Create user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: TARGET_EMAIL,
        password: TARGET_PASSWORD,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: 'Andreas Ludvigsen Theil',
          name: 'Andreas Ludvigsen Theil',
          role: 'Platform Admin',
          company: 'ALTBIM'
        }
      });

      if (createError) {
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      console.log(`✅ User created successfully!`);
      console.log(`   - Email: ${newUser.user.email}`);
      console.log(`   - User ID: ${newUser.user.id}`);
      console.log(`   - Password: ${TARGET_PASSWORD}`);
      userId = newUser.user.id;
    }

    // Step 3: Check if user is already an admin
    console.log('\n🔐 Checking admin status...');
    
    const { data: adminCheck, error: adminCheckError } = await supabase
      .from('app_admins')
      .select('user_id, created_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (adminCheckError && adminCheckError.code !== 'PGRST116') {
      throw new Error(`Failed to check admin status: ${adminCheckError.message}`);
    }

    if (adminCheck) {
      console.log(`✅ User is already a platform admin`);
      console.log(`   - Admin since: ${new Date(adminCheck.created_at).toLocaleString()}`);
    } else {
      console.log(`⚠️  User is not a platform admin. Adding admin rights...`);
      
      // Step 4: Add user to app_admins table
      const { error: addAdminError } = await supabase
        .from('app_admins')
        .insert({ user_id: userId });

      if (addAdminError && addAdminError.code !== '23505') { // 23505 is duplicate key error
        throw new Error(`Failed to add admin rights: ${addAdminError.message}`);
      }

      console.log(`✅ Admin rights granted!`);
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SETUP COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📋 User Details:');
    console.log(`   Email:    ${TARGET_EMAIL}`);
    console.log(`   Password: ${TARGET_PASSWORD}`);
    console.log(`   User ID:  ${userId}`);
    console.log(`   Status:   Platform Admin ✅`);
    console.log('\n📝 Next steps:');
    console.log('   1. Go to the login page');
    console.log('   2. Sign in with the credentials above');
    console.log('   3. You will have full platform admin access');
    console.log('');

  } catch (error) {
    console.error('\n❌ Error occurred:');
    console.error(error.message);
    process.exit(1);
  }
}

main();
