const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres:WiNtEr2026!!@db.uofsfpvtgxlkbeysvtkk.supabase.co:5432/postgres';

async function runMigrations() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Kobler til database...');
    await client.connect();
    console.log('✅ Tilkoblet!\n');

    // Les migreringsfilen
    const migrationPath = path.join(__dirname, '..', 'DATABASE_MIGRATIONS.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Kjører migreringer...');
    console.log('━'.repeat(50));

    // Kjør migreringen
    await client.query(migrationSQL);

    console.log('━'.repeat(50));
    console.log('✅ Migreringer fullført!\n');

    // Verifiser at tabellene er opprettet
    console.log('🔍 Verifiserer tabeller...');
    const verifyQuery = `
      SELECT tablename, rowsecurity as "RLS Enabled"
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

    const result = await client.query(verifyQuery);
    
    console.log('\n📊 Tabeller opprettet:');
    console.log('━'.repeat(50));
    result.rows.forEach(row => {
      const rls = row['RLS Enabled'] ? '✅' : '❌';
      console.log(`${rls} ${row.tablename}`);
    });
    console.log('━'.repeat(50));

    if (result.rows.length === 14) {
      console.log('\n🎉 Alle 14 tabeller opprettet!');
    } else {
      console.log(`\n⚠️  Forventet 14 tabeller, fant ${result.rows.length}`);
    }

    // Tell indekser
    const indexQuery = `
      SELECT COUNT(*) as count
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
    `;

    const indexResult = await client.query(indexQuery);
    console.log(`\n📊 Indekser opprettet: ${indexResult.rows[0].count}`);

    // Tell policies
    const policyQuery = `
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

    const policyResult = await client.query(policyQuery);
    console.log(`📊 RLS Policies opprettet: ${policyResult.rows[0].count}`);

    console.log('\n✅ Migrering fullført!');
    console.log('\n📝 Neste steg:');
    console.log('1. Test API-endepunktene');
    console.log('2. Implementer frontend-komponenter');
    console.log('3. Test i browser\n');

  } catch (error) {
    console.error('\n❌ Feil under migrering:');
    console.error(error.message);
    
    if (error.message.includes('already exists')) {
      console.log('\n💡 Tips: Noen tabeller eksisterer allerede. Dette er OK.');
      console.log('   Scriptet bruker "IF NOT EXISTS" så det er trygt å kjøre på nytt.');
    }
    
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Tilkobling lukket');
  }
}

// Kjør migreringer
runMigrations().catch(console.error);
