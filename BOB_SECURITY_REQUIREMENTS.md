# BOB Platform - Security Requirements & Implementation Guide

**Version:** 1.0  
**Date:** February 16, 2026  
**Classification:** Internal - Development Team  
**Status:** Mandatory Requirements

---

## Executive Summary

This document outlines the **mandatory security requirements** for the BOB platform. All requirements in this document must be implemented before the platform can be considered production-ready. Security is not optional and cannot be deferred to later phases.

**Key Principle:** BOB handles sensitive construction project data. Any security breach could expose confidential designs, financial information, or competitive intelligence. Security must be built into every layer of the application.

---

## Table of Contents

1. [Multi-Tenant Isolation](#1-multi-tenant-isolation)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Row Level Security (RLS)](#3-row-level-security-rls)
4. [API Security](#4-api-security)
5. [File Storage Security](#5-file-storage-security)
6. [AI Context Security](#6-ai-context-security)
7. [Audit Logging](#7-audit-logging)
8. [Data Privacy](#8-data-privacy)
9. [Network Security](#9-network-security)
10. [Incident Response](#10-incident-response)

---

## 1. Multi-Tenant Isolation

### 1.1 Organization-Level Isolation

**Requirement:** Each organization's data must be completely isolated from all other organizations.

**Implementation:**

```sql
-- All project-related tables must have org_id or reference to project with org_id
ALTER TABLE projects ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Ensure every query filters by organization
CREATE POLICY "organization_isolation" ON projects FOR ALL
USING (
  org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
);
```

**Validation:**
- [ ] No query can return data from organizations user is not part of
- [ ] Cross-organization joins are prevented
- [ ] Direct table access bypassing RLS is blocked
- [ ] Application code cannot override RLS policies

### 1.2 Project-Level Isolation

**Requirement:** Within an organization, users only see projects they are members of.

**Implementation:**

```sql
CREATE POLICY "project_membership_required" ON projects FOR SELECT
USING (
  id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  )
  OR org_id IN (
    SELECT org_id FROM organization_members 
    WHERE user_id = auth.uid() AND org_role = 'admin'
  )
  OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
);
```

**Validation:**
- [ ] Users cannot see projects they're not members of
- [ ] Project invitations are properly validated
- [ ] Removed members lose access immediately
- [ ] No caching of unauthorized project data

### 1.3 Testing Multi-Tenant Isolation

**Required Tests:**

```typescript
describe('Multi-Tenant Isolation', () => {
  it('should prevent cross-organization data access', async () => {
    const org1User = await createUser('org1');
    const org2User = await createUser('org2');
    
    const org1Project = await createProject(org1User, org1);
    
    // Attempt to access org1 project as org2 user
    const result = await getProject(org2User, org1Project.id);
    
    expect(result).toBeNull();
  });
  
  it('should prevent cross-project file access', async () => {
    const user1 = await createUser('org1');
    const user2 = await createUser('org1'); // Same org
    
    const project1 = await createProject(user1, org1);
    const file1 = await uploadFile(user1, project1);
    
    // User2 not member of project1
    const result = await getFile(user2, file1.id);
    
    expect(result).toBeNull();
  });
});
```

---

## 2. Authentication & Authorization

### 2.1 Authentication Requirements

**Requirements:**
- Multi-factor authentication (MFA) for all users
- Session timeout after 30 minutes of inactivity
- Password requirements: 12+ characters, mixed case, numbers, symbols
- Account lockout after 5 failed login attempts
- Password reset via secure email link (expires in 1 hour)

**Implementation:**

```typescript
// Use Supabase Auth with MFA enabled
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // More secure than implicit flow
  }
});

// Password validation
function validatePassword(password: string): boolean {
  const minLength = 12;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSymbols = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  return password.length >= minLength 
    && hasUpperCase 
    && hasLowerCase 
    && hasNumbers 
    && hasSymbols;
}
```

### 2.2 Authorization Levels

**Three-tier authorization:**

1. **Platform Admin** - Full system access
2. **Organization Admin** - Full access within organization
3. **Project Member** - Access based on access_level (read/write/admin)

**Implementation:**

```typescript
enum AccessLevel {
  READ = 'read',
  WRITE = 'write', 
  ADMIN = 'admin'
}

async function checkProjectAccess(
  userId: string, 
  projectId: string, 
  requiredLevel: AccessLevel
): Promise<boolean> {
  // Check platform admin
  const isPlatformAdmin = await db.app_admins.findOne({ user_id: userId });
  if (isPlatformAdmin) return true;
  
  // Check project membership
  const membership = await db.project_members.findOne({
    user_id: userId,
    project_id: projectId
  });
  
  if (!membership) return false;
  
  // Check access level hierarchy
  const levelHierarchy = { read: 1, write: 2, admin: 3 };
  return levelHierarchy[membership.access_level] >= levelHierarchy[requiredLevel];
}
```

---

## 3. Row Level Security (RLS)

### 3.1 Enable RLS on All Tables

**Requirement:** Every table containing user or project data must have RLS enabled.

**Implementation:**

```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE ifc_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE cut_lists ENABLE ROW LEVEL SECURITY;
-- ... all other tables
```

### 3.2 RLS Policies Template

**Standard policies for project-scoped tables:**

```sql
-- SELECT policy
CREATE POLICY "{table}_select_policy" ON {table} FOR SELECT
USING (
  project_id IN (
    SELECT project_id FROM project_members WHERE user_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
);

-- INSERT policy
CREATE POLICY "{table}_insert_policy" ON {table} FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT project_id FROM project_members 
    WHERE user_id = auth.uid() 
    AND access_level IN ('write', 'admin')
  )
  OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
);

-- UPDATE policy
CREATE POLICY "{table}_update_policy" ON {table} FOR UPDATE
USING (
  project_id IN (
    SELECT project_id FROM project_members 
    WHERE user_id = auth.uid() 
    AND access_level IN ('write', 'admin')
  )
  OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
);

-- DELETE policy
CREATE POLICY "{table}_delete_policy" ON {table} FOR DELETE
USING (
  project_id IN (
    SELECT project_id FROM project_members 
    WHERE user_id = auth.uid() 
    AND access_level = 'admin'
  )
  OR EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())
);
```

### 3.3 RLS Testing

**Required tests:**

```sql
-- Test file: test/security/rls_test.sql

-- Test 1: User can only see their own organization
SET LOCAL auth.user_id = 'user1-uuid';
SELECT COUNT(*) FROM organizations; -- Should only return user1's orgs

-- Test 2: User cannot see other project's files
SET LOCAL auth.user_id = 'user2-uuid';
SELECT COUNT(*) FROM files WHERE project_id = 'project1-uuid'; -- Should return 0

-- Test 3: Platform admin can see everything
SET LOCAL auth.user_id = 'admin-uuid';
SELECT COUNT(*) FROM organizations; -- Should return all orgs
```

---

## 4. API Security

### 4.1 API Authentication

**Requirements:**
- All API endpoints require authentication
- Use JWT tokens with short expiration (1 hour)
- Refresh tokens for session extension
- API keys for service-to-service communication (separate from user auth)

**Implementation:**

```typescript
// Middleware for all API routes
export async function authenticateRequest(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

// Use in API route
export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // ... rest of handler
}
```

### 4.2 Rate Limiting

**Requirements:**
- 100 requests per minute per user for standard endpoints
- 10 requests per minute for AI chat endpoints
- 5 requests per minute for file upload endpoints
- Burst allowance: 20 requests in 10 seconds

**Implementation:**

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
});

export async function checkRateLimit(identifier: string): Promise<boolean> {
  const { success } = await ratelimit.limit(identifier);
  return success;
}
```

### 4.3 Input Validation

**Requirements:**
- Validate all input against schema
- Sanitize HTML input to prevent XSS
- Validate file types and sizes
- Validate UUIDs format
- Validate JSON structure

**Implementation:**

```typescript
import { z } from 'zod';

const ProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  org_id: z.string().uuid(),
  client: z.string().max(200).optional(),
  location: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  
  // Validate input
  const result = ProjectSchema.safeParse(body);
  
  if (!result.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid input', details: result.error }),
      { status: 400 }
    );
  }
  
  // Use validated data
  const project = await createProject(result.data);
  // ...
}
```

---

## 5. File Storage Security

### 5.1 File Upload Security

**Requirements:**
- Virus scanning for all uploaded files
- File type validation (whitelist approach)
- Maximum file size: 500MB per file
- Files stored with random UUIDs (not original names)
- No executable files allowed (.exe, .bat, .sh, etc.)

**Implementation:**

```typescript
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp',
  'model/ifc', // IFC files
];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

async function validateUpload(file: File, projectId: string, userId: string): Promise<boolean> {
  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    throw new Error('File type not allowed');
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large');
  }
  
  // Check user has write access to project
  const hasAccess = await checkProjectAccess(userId, projectId, AccessLevel.WRITE);
  if (!hasAccess) {
    throw new Error('Unauthorized');
  }
  
  // Scan for viruses (integrate with ClamAV or similar)
  const isSafe = await scanFileForViruses(file);
  if (!isSafe) {
    throw new Error('File contains malware');
  }
  
  return true;
}
```

### 5.2 File Download Security

**Requirements:**
- Downloads require authentication
- Access control checks before serving file
- Signed URLs with expiration (15 minutes)
- Log all downloads
- Rate limiting on downloads

**Implementation:**

```typescript
async function generateSignedDownloadUrl(
  fileId: string, 
  userId: string
): Promise<string | null> {
  // Check access
  const file = await db.files.findOne({ id: fileId });
  if (!file) return null;
  
  const hasAccess = await checkProjectAccess(userId, file.project_id, AccessLevel.READ);
  if (!hasAccess) return null;
  
  // Generate signed URL (expires in 15 minutes)
  const signedUrl = await storage.createSignedUrl(file.path, {
    expiresIn: 15 * 60, // 15 minutes
  });
  
  // Log download
  await logActivity({
    user_id: userId,
    project_id: file.project_id,
    action: 'file.download',
    entity_type: 'file',
    entity_id: fileId,
  });
  
  return signedUrl;
}
```

---

## 6. AI Context Security

### 6.1 Project-Scoped AI Context

**Requirement:** AI must only access data from the current project and only data the user has access to.

**Implementation:**

```typescript
async function buildAIContext(
  userId: string, 
  projectId: string
): Promise<AIContext> {
  // Verify user access
  const accessLevel = await getProjectAccessLevel(userId, projectId);
  if (!accessLevel) {
    throw new Error('User does not have access to this project');
  }
  
  // Build context from project-specific data only
  const context: AIContext = {
    project: await getProject(projectId),
    files: await getProjectFiles(projectId, userId), // Respects RLS
    ifcElements: await getIFCElements(projectId, userId),
    issues: await getIssues(projectId, userId),
    controls: await getControls(projectId, userId),
    chatHistory: await getChatHistory(projectId, userId),
  };
  
  // Log AI context building
  await logActivity({
    user_id: userId,
    project_id: projectId,
    action: 'ai.context.build',
    entity_type: 'project',
    entity_id: projectId,
  });
  
  return context;
}
```

### 6.2 AI Response Filtering

**Requirement:** AI responses must not leak information from other projects or users.

**Implementation:**

```typescript
async function filterAIResponse(
  response: string,
  userId: string,
  projectId: string
): Promise<string> {
  // Check for potential project ID leaks
  const projectIdPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const foundIds = response.match(projectIdPattern) || [];
  
  for (const id of foundIds) {
    // Verify this ID belongs to current project or accessible resources
    const isAuthorized = await verifyResourceAccess(userId, id);
    if (!isAuthorized) {
      // Redact unauthorized reference
      response = response.replace(id, '[REDACTED]');
    }
  }
  
  return response;
}
```

### 6.3 AI Audit Logging

**Requirement:** All AI interactions must be logged for audit purposes.

**Implementation:**

```sql
CREATE TABLE ai_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  context_size INT, -- Number of documents/chunks used
  tokens_used INT,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ai_audit_log_user_idx ON ai_audit_log(user_id);
CREATE INDEX ai_audit_log_project_idx ON ai_audit_log(project_id);
CREATE INDEX ai_audit_log_created_idx ON ai_audit_log(created_at DESC);
```

---

## 7. Audit Logging

### 7.1 What to Log

**Required logging:**
- All authentication events (login, logout, failed attempts)
- All authorization failures
- All data modifications (create, update, delete)
- All file operations (upload, download, delete)
- All AI interactions
- All admin actions
- All permission changes
- All project membership changes

### 7.2 Audit Log Schema

```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  org_id UUID REFERENCES organizations(id),
  project_id UUID REFERENCES projects(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX activity_log_user_idx ON activity_log(user_id);
CREATE INDEX activity_log_org_idx ON activity_log(org_id);
CREATE INDEX activity_log_project_idx ON activity_log(project_id);
CREATE INDEX activity_log_action_idx ON activity_log(action);
CREATE INDEX activity_log_created_idx ON activity_log(created_at DESC);
```

### 7.3 Audit Log Retention

**Requirements:**
- Keep audit logs for minimum 2 years
- Audit logs cannot be deleted by users (including admins)
- Audit logs stored separately from application database
- Regular backups of audit logs
- Tamper-evident logging (cryptographic hash chain)

---

## 8. Data Privacy

### 8.1 GDPR Compliance

**Requirements:**
- Right to access (export user data)
- Right to be forgotten (delete user data)
- Data portability (export in standard format)
- Consent management
- Privacy policy acceptance required

**Implementation:**

```typescript
// Export user data
async function exportUserData(userId: string): Promise<UserDataExport> {
  return {
    personal_info: await getUserProfile(userId),
    projects: await getUserProjects(userId),
    files: await getUserFiles(userId),
    chat_messages: await getUserChatMessages(userId),
    activity_log: await getUserActivityLog(userId),
  };
}

// Delete user data
async function deleteUserData(userId: string): Promise<void> {
  // Anonymize audit logs (keep for compliance)
  await anonymizeActivityLog(userId);
  
  // Delete or transfer ownership of created resources
  await handleUserDeletion(userId);
  
  // Delete auth account
  await supabase.auth.admin.deleteUser(userId);
}
```

### 8.2 Data Encryption

**Requirements:**
- All data encrypted at rest
- All data encrypted in transit (TLS 1.3+)
- File storage encryption
- Database encryption
- Backup encryption

---

## 9. Network Security

### 9.1 HTTPS Enforcement

**Requirements:**
- All traffic over HTTPS
- HSTS enabled
- Redirect HTTP to HTTPS
- Valid SSL certificates

**Implementation:**

```typescript
// Next.js configuration
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
        ],
      },
    ];
  },
};
```

### 9.2 CORS Configuration

**Requirements:**
- Strict CORS policy
- Whitelist specific origins only
- No wildcards in production

```typescript
const allowedOrigins = [
  'https://bob.altbim.no',
  'https://app.bob.altbim.no',
];

function checkCORS(origin: string): boolean {
  return allowedOrigins.includes(origin);
}
```

---

## 10. Incident Response

### 10.1 Security Incident Procedure

**Steps:**
1. **Detect** - Monitor for suspicious activity
2. **Contain** - Isolate affected systems
3. **Investigate** - Analyze logs and determine scope
4. **Remediate** - Fix vulnerabilities
5. **Notify** - Inform affected users (if required)
6. **Review** - Post-mortem and improvements

### 10.2 Monitoring & Alerts

**Required monitoring:**
- Failed login attempts (> 5 in 5 minutes)
- Unusual data access patterns
- High API request rates
- Large file downloads
- Cross-project access attempts
- RLS policy violations

---

## Security Checklist

Before production deployment:

### Infrastructure
- [ ] All tables have RLS enabled
- [ ] All RLS policies tested
- [ ] Database backups configured
- [ ] SSL certificates installed
- [ ] HTTPS enforced
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] DDoS protection active

### Application
- [ ] All API endpoints authenticated
- [ ] All API endpoints authorized
- [ ] Input validation on all endpoints
- [ ] File upload validation working
- [ ] Virus scanning enabled
- [ ] XSS prevention implemented
- [ ] SQL injection prevention verified
- [ ] CSRF protection enabled

### Monitoring
- [ ] Audit logging enabled
- [ ] Security monitoring active
- [ ] Alert system configured
- [ ] Incident response plan documented
- [ ] Regular security scans scheduled

### Compliance
- [ ] GDPR compliance verified
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Data retention policy documented
- [ ] User consent mechanisms working

---

**Document prepared by:** GitHub Copilot  
**Classification:** Internal - Development Team  
**For:** ALTBIM/BOB Platform  
**Last updated:** February 16, 2026
