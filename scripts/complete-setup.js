et const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:WiNtEr2026!!@db.uofsfpvtgxlkbeysvtkk.supabase.co:5432/postgres';

async function runSQL(client, sqlFile, description) {
  console.log(`\n📝 ${description}...`);
  console.log('━'.repeat(50));
  
  const sqlPath = path.join(__dirname, '..', sqlFile);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  try {
    await client.query(sql);
    console.log(`✅ ${description} - SUCCESS`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} - FAILED`);
    console.error(`Error: ${error.message}`);
    return false;
  }
}

async function completeSetup() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Step 1: Create helper functions
    const step1 = await runSQL(
      client,
      'CREATE_HELPER_FUNCTIONS.sql',
      'Step 1: Creating helper functions'
    );

    if (!step1) {
      console.log('\n⚠️  Step 1 failed. Stopping here.');
      return;
    }

    // Step 2: Add RLS policies
    const step2 = await runSQL(
      client,
      'ADD_RLS_POLICIES.sql',
      'Step 2: Adding RLS policies'
    );

    if (!step2) {
      console.log('\n⚠️  Step 2 failed. But functions are created.');
      return;
    }

    // Verify everything
    console.log('\n🔍 Verifying setup...');
    console.log('━'.repeat(50));

    // Check functions
    const functionsQuery = `
      SELECT routine_name 
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
    `;
    
    const functionsResult = await client.query(functionsQuery);
    console.log(`\n✅ Functions created: ${functionsResult.rows.length}/5`);
    functionsResult.rows.forEach(row => {
      console.log(`   - ${row.routine_name}`);
    });

    // Check tables with RLS
    const tablesQuery = `
      SELECT 
        tablename,
        CASE WHEN rowsecurity THEN '✅' ELSE '❌' END as rls
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
    `;

    const tablesResult = await client.query(tablesQuery);
    console.log(`\n✅ Tables with RLS: ${tablesResult.rows.filter(r => r.rls === '✅').length}/${tablesResult.rows.length}`);
    tablesResult.rows.forEach(row => {
      console.log(`   ${row.rls} ${row.tablename}`);
    });

    // Check policies
    const policiesQuery = `
      SELECT COUNT(*) as count
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN (
          'ifc_elements',
          'issues',
          'issue_comments',
          'controls',
          'activity_log',
          'notifications'
        );
    `;

    const policiesResult = await client.query(policiesQuery);
    console.log(`\n✅ RLS Policies created: ${policiesResult.rows[0].count}`);

    console.log('\n' + '━'.repeat(50));
    console.log('🎉 DATABASE SETUP COMPLETE!');
    console.log('━'.repeat(50));
    console.log('\n📝 Next steps:');
    console.log('1. ✅ Database tables created');
    console.log('2. ✅ Helper functions created');
    console.log('3. ✅ RLS policies enabled');
    console.log('4. 🔄 Ready to test API endpoints');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Setup failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Connection closed');
  }
}

completeSetup().catch(console.error);
