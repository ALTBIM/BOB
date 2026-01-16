/**
 * BOB Platform - Automated API Tests
 * 
 * Dette scriptet tester alle implementerte API-endepunkter
 * Kjør med: npx tsx tests/api/test-all-apis.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Last inn miljøvariabler fra .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Konfigurer Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Miljøvariabler mangler!');
  console.error('Sjekk at .env.local inneholder:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=...');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=...');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test-resultater
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

// Hjelpefunksjoner
function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    warn: '\x1b[33m'     // Yellow
  };
  const reset = '\x1b[0m';
  console.log(`${colors[type]}${message}${reset}`);
}

async function runTest(name: string, testFn: () => Promise<void>) {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    log(`✅ ${name} (${duration}ms)`, 'success');
  } catch (error) {
    const duration = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMessage, duration });
    log(`❌ ${name} - ${errorMessage}`, 'error');
  }
}

// Test-data
let testProjectId: string;
let testUserId: string;
let testIssueId: string;
let authToken: string;

// ============================================================================
// SETUP
// ============================================================================

async function setup() {
  log('\n🔧 Setting up tests...', 'info');
  
  // Logg inn (bruk en test-bruker eller opprett en)
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_USER_EMAIL || 'test@example.com',
    password: process.env.TEST_USER_PASSWORD || 'testpassword123'
  });

  if (authError || !authData.user) {
    throw new Error('Failed to authenticate. Set TEST_USER_EMAIL and TEST_USER_PASSWORD env vars.');
  }

  testUserId = authData.user.id;
  authToken = authData.session?.access_token || '';
  log(`✅ Authenticated as ${authData.user.email}`, 'success');

  // Finn eller opprett test-prosjekt
  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .limit(1);

  if (projects && projects.length > 0) {
    testProjectId = projects[0].id;
    log(`✅ Using existing project: ${testProjectId}`, 'success');
  } else {
    // Opprett test-prosjekt
    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({
        name: 'Test Project',
        description: 'Automated test project',
        created_by: testUserId
      })
      .select()
      .single();

    if (error || !newProject) {
      throw new Error('Failed to create test project');
    }

    testProjectId = newProject.id;
    log(`✅ Created test project: ${testProjectId}`, 'success');
  }
}

// ============================================================================
// DATABASE TESTS
// ============================================================================

async function testDatabaseTables() {
  log('\n📊 Testing database tables...', 'info');

  const tables = [
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
  ];

  for (const table of tables) {
    await runTest(`Database: ${table} exists`, async () => {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error && !error.message.includes('0 rows')) {
        throw new Error(`Table ${table} not accessible: ${error.message}`);
      }
    });
  }
}

// ============================================================================
// IFC SEARCH API TESTS
// ============================================================================

async function testIFCSearchAPI() {
  log('\n🔍 Testing IFC Search API...', 'info');

  await runTest('IFC Search: Basic search without filters', async () => {
    const response = await fetch('http://localhost:3000/api/ifc/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        project_id: testProjectId,
        limit: 10
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!data.results || !Array.isArray(data.results)) {
      throw new Error('Invalid response format');
    }
    if (typeof data.total !== 'number') {
      throw new Error('Missing total count');
    }
    if (!data.facets) {
      throw new Error('Missing facets');
    }
  });

  await runTest('IFC Search: Search with text', async () => {
    const response = await fetch('http://localhost:3000/api/ifc/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        project_id: testProjectId,
        text: 'vegg',
        limit: 10
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.results)) {
      throw new Error('Invalid response format');
    }
  });

  await runTest('IFC Search: Search with filters', async () => {
    const response = await fetch('http://localhost:3000/api/ifc/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        project_id: testProjectId,
        filters: {
          element_type: ['IfcWall'],
          status: ['ok']
        },
        limit: 10
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.results)) {
      throw new Error('Invalid response format');
    }
  });

  await runTest('IFC Search: Error handling - missing project_id', async () => {
    const response = await fetch('http://localhost:3000/api/ifc/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        limit: 10
      })
    });

    if (response.status !== 400) {
      throw new Error(`Expected 400, got ${response.status}`);
    }
  });
}

// ============================================================================
// ISSUES API TESTS
// ============================================================================

async function testIssuesAPI() {
  log('\n🚨 Testing Issues API...', 'info');

  await runTest('Issues: Create avvik', async () => {
    const response = await fetch('http://localhost:3000/api/issues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        project_id: testProjectId,
        type: 'avvik',
        title: 'Test avvik fra automated test',
        description: 'Dette er en test',
        priority: 'høy',
        category: 'test'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!data.id) {
      throw new Error('No issue ID returned');
    }
    
    testIssueId = data.id;
    
    if (data.type !== 'avvik') {
      throw new Error('Wrong issue type');
    }
    if (data.status !== 'ny') {
      throw new Error('Wrong initial status');
    }
  });

  await runTest('Issues: List issues', async () => {
    const response = await fetch(
      `http://localhost:3000/api/issues?projectId=${testProjectId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.issues)) {
      throw new Error('Invalid response format');
    }
    if (typeof data.total !== 'number') {
      throw new Error('Missing total count');
    }
    if (!data.stats) {
      throw new Error('Missing stats');
    }
  });

  await runTest('Issues: List with filters', async () => {
    const response = await fetch(
      `http://localhost:3000/api/issues?projectId=${testProjectId}&status=ny&type=avvik`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.issues)) {
      throw new Error('Invalid response format');
    }
  });

  await runTest('Issues: Error handling - missing required fields', async () => {
    const response = await fetch('http://localhost:3000/api/issues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        project_id: testProjectId
        // Missing type and title
      })
    });

    if (response.status !== 400) {
      throw new Error(`Expected 400, got ${response.status}`);
    }
  });
}

// ============================================================================
// ISSUE DETAILS API TESTS
// ============================================================================

async function testIssueDetailsAPI() {
  log('\n📝 Testing Issue Details API...', 'info');

  if (!testIssueId) {
    log('⚠️  Skipping Issue Details tests - no test issue created', 'warn');
    return;
  }

  await runTest('Issue Details: Get issue', async () => {
    const response = await fetch(
      `http://localhost:3000/api/issues/${testIssueId}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.id !== testIssueId) {
      throw new Error('Wrong issue returned');
    }
  });

  await runTest('Issue Details: Update issue', async () => {
    const response = await fetch(
      `http://localhost:3000/api/issues/${testIssueId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          status: 'under_behandling',
          priority: 'medium'
        })
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.status !== 'under_behandling') {
      throw new Error('Status not updated');
    }
  });
}

// ============================================================================
// ISSUE COMMENTS API TESTS
// ============================================================================

async function testIssueCommentsAPI() {
  log('\n💬 Testing Issue Comments API...', 'info');

  if (!testIssueId) {
    log('⚠️  Skipping Comments tests - no test issue created', 'warn');
    return;
  }

  await runTest('Comments: Create comment', async () => {
    const response = await fetch(
      `http://localhost:3000/api/issues/${testIssueId}/comments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          comment: 'Dette er en test-kommentar fra automated test'
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!data.id) {
      throw new Error('No comment ID returned');
    }
  });

  await runTest('Comments: List comments', async () => {
    const response = await fetch(
      `http://localhost:3000/api/issues/${testIssueId}/comments`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.comments)) {
      throw new Error('Invalid response format');
    }
    if (data.comments.length === 0) {
      throw new Error('No comments returned');
    }
  });

  await runTest('Comments: Error handling - empty comment', async () => {
    const response = await fetch(
      `http://localhost:3000/api/issues/${testIssueId}/comments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          comment: ''
        })
      }
    );

    if (response.status !== 400) {
      throw new Error(`Expected 400, got ${response.status}`);
    }
  });
}

// ============================================================================
// CLEANUP
// ============================================================================

async function cleanup() {
  log('\n🧹 Cleaning up...', 'info');

  if (testIssueId) {
    await runTest('Cleanup: Delete test issue', async () => {
      const response = await fetch(
        `http://localhost:3000/api/issues/${testIssueId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    });
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(60));
  log('🧪 BOB Platform - Automated API Tests', 'info');
  console.log('='.repeat(60));

  try {
    // Setup
    await setup();

    // Run tests
    await testDatabaseTables();
    await testIFCSearchAPI();
    await testIssuesAPI();
    await testIssueDetailsAPI();
    await testIssueCommentsAPI();

    // Cleanup
    await cleanup();

    // Summary
    console.log('\n' + '='.repeat(60));
    log('📊 Test Summary', 'info');
    console.log('='.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    log(`\nTotal: ${total} tests`, 'info');
    log(`Passed: ${passed} ✅`, 'success');
    if (failed > 0) {
      log(`Failed: ${failed} ❌`, 'error');
    }
    log(`Duration: ${totalDuration}ms\n`, 'info');

    if (failed > 0) {
      log('\nFailed tests:', 'error');
      results.filter(r => !r.passed).forEach(r => {
        log(`  ❌ ${r.name}`, 'error');
        log(`     ${r.error}`, 'error');
      });
    }

    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    log(`\n❌ Fatal error: ${error}`, 'error');
    process.exit(1);
  }
}

// Run tests
main();
