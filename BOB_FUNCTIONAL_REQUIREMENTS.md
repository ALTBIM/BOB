# BOB (ALTBIM) – Functional Requirements Specification

**Version:** 1.0  
**Date:** February 16, 2026  
**Status:** Complete Requirements Document  
**Language:** English (translated from Norwegian specification)

---

## Table of Contents

1. [Overall Goal and Product Vision](#1-overall-goal-and-product-vision)
2. [Multi-Project Platform with Long-term Storage](#2-multi-project-platform-with-long-term-storage)
3. [Administration and RBAC](#3-administration-and-rbac)
4. [File Upload → Auto-Analysis → Persistent Knowledge Base](#4-file-upload--auto-analysis--persistent-knowledge-base)
5. [IFC Viewer: Search + Filtering + Results List](#5-ifc-viewer-search--filtering--results-list)
6. [Dashboard After Login](#6-dashboard-after-login)
7. [Quality Control: Meeting Suggestions](#7-quality-control-meeting-suggestions)
8. [Production: Cut Lists + Drawing Snippets](#8-production-cut-lists--drawing-snippets)
9. [Simplebim Command Line API Integration](#9-simplebim-command-line-api-integration)
10. [Public Website Structure](#10-public-website-structure)
11. [BOB Chat Requirements](#11-bob-chat-requirements)
12. [Critical Security Requirements](#12-critical-security-requirements)

---

## 1) Overall Goal and Product Vision

BOB is a **project-based BIM assistant platform** designed to make construction projects more efficient by bringing together:

- Project-controlled access (multi-tenant)
- Project files and IFC models
- Automatic analysis/indexing into a persistent project knowledge base
- Chat/Q&A to find answers across project content
- Controls and findings (quality/requirements)
- Production and logistics functions (cut lists + drawing snippets)

**BOB shall function as a "single source of truth" per project** – where communication, documentation, model, control, and follow-up are interconnected.

---

## 2) Multi-Project Platform with Long-term Storage

### 2.1 Multiple Projects with Separate File Repository per Project

**Requirements:**

- BOB shall support **multiple projects**
- Each project has its own files/documents stored **long-term** and accessible at the project level
- This means documents are not just "uploads" but the project's permanent knowledge foundation

**Why:**

- Users should be able to work over time, track changes, and reuse project content throughout the entire project period

### 2.2 Project-Isolated Access (No Leakage Between Projects)

**Requirements:**

- Access to project files shall be **access-controlled per project**
- Only users granted access to a project should be able to see and use files/documents from that project

**Why:**

- Prevent spread of sensitive information and ensure projects are fully isolated

---

## 3) Administration and RBAC (Access at Multiple Levels)

### 3.1 Platform Admin / Superadmin (Global)

**Requirements:**

- Introduce **Platform Admin/Superadmin** (global "god-mode") that can administer the entire solution:
  - All companies/organizations (tenants)
  - Projects
  - Users
  - Roles
  - Teams
- Platform admin shall be able to designate multiple superadmins

**Why:**

- To make BOB production-ready as a platform that can be used by many organizations and projects

### 3.2 Organization (Tenant) with Org-Admin

**Requirements:**

- Introduce **Organization/Company (tenant)**
- **Org-admin** shall be able to:
  - Administer users/roles within their own company
  - Assign project access for their users

**Why:**

- Multi-tenant operation requires that each company can administer their people without seeing/changing other companies

### 3.3 Project-RBAC with access_level + role

**Requirements:**

- Maintain project-level RBAC:
  - `access_level`: read / write / admin
  - Role per project
- Project creation shall always give creator project membership as **admin**

**Why:**

- To control who can read, contribute, and administer in each project, and ensure the project always gets a responsible admin

### 3.4 Admin-UI Gating (Show Only the Right Admin Interface)

**Requirements:**

- Admin-UI shall be "gated":
  - Only platform admins see platform admin interface
  - Only org-admins see org admin interface
  - Only project-admins see project admin interface

**Why:**

- Reduce complexity for regular users and ensure administrative functions are not exposed incorrectly

---

## 4) File Upload → Auto-Analysis → Persistent Knowledge Base

### 4.1 Auto-Analysis on Upload

**Requirements:**

- When files are uploaded to a project, they shall be **auto-analyzed** and built into a **persistent project-specific knowledge base** (indexing/embeddings/metadata)

**Why:**

- Users should not have to search files manually. BOB should be able to find relevant content automatically

### 4.2 Ask Across All Project Files (Without Selecting File)

**Requirements:**

- Users shall be able to ask "like ChatGPT" without specifying a file
- BOB shall find answers across all project files in the project (e.g., IFC requirements, documentation, descriptions)

**Why:**

- The goal is quick, accurate answers based on the project's actual content

### 4.3 Export to Word/Excel

**Requirements:**

- Chat/Q&A and project content shall be **exportable to Word/Excel** (for reporting and sharing)

**Why:**

- Construction projects need documentation and deliverables in standard formats

---

## 5) IFC Viewer: Search + Filtering + Results List

### 5.1 SearchResultsPage-Like Experience in IFC Viewer

**Requirements:**

- The IFC viewer shall have a **SearchResultsPage-like experience**:
  - Search + filtering/facets
  - Clear results list of relevant elements/hits
  - Ability to open/zoom to hits in the model

**Why:**

- Users must be able to find objects quickly and experience this as a structured search experience – not just "highlight in model"

---

## 6) Dashboard After Login

### 6.1 Project Overview (Cards)

**Requirements:**

- Project overview with cards for all projects the user is part of:
  - Show 3 most recent if more
  - Counter for active submitted errors/deviations
  - Indicator for changes in project files (and click to see which ones)
  - % progress + alert if actual progress doesn't match the project's progress plan

**Why:**

- User should quickly understand "what's happening now" in the projects

### 6.2 Calendar/Plan for Construction Project

**Requirements:**

- Calendar/plan shall gather:
  - Meetings
  - Daily construction site activities from progress plan
  - Deliveries/installations (e.g., "windows arrive today; installed by work team X")
  - Other relevant project events

**Why:**

- Provides operational value and connects project management to actual production

### 6.3 Suggested Additional Dashboard Content (Wishlist)

**Requirements/Ideas:**

- Notification center/inbox (deviations, RFI, changes, approvals)
- Recent activity/change log
- Quick actions (new project, upload IFC, create deviation/RFI, invite user)
- Upcoming deadlines/milestones
- Risk overview (top risks/measures)
- HSE checks/inspections
- Quality controls/test protocols
- Budget vs forecast
- Weather/conditions at construction site
- Delivery and logistics status
- Model health (IFC/BIM controls, clash/rule violations)
- Cross-project/document search

**Why:**

- Shows direction for further development and what provides most value in operation

---

## 7) Quality Control: Meeting Suggestions

### 7.1 Meeting Suggestion After Control Findings

**Requirements:**

- After BOB has performed a control (requirement check, model/logistics check), it should be able to:
  - Suggest and facilitate calling a meeting with relevant roles/people (designer, construction manager, supplier, etc.)
  - Based on the findings in the control and the user's wishes

**Why:**

- The goal is that findings don't just become lists but actually lead to coordination and decision-making

---

## 8) Production: Cut Lists + Drawing Snippets

### 8.1 Cut Lists from Model (IFC) with Material + Zone/Room

**Requirements:**

- BOB shall be able to generate **cut lists for production** based on:
  - Specification of materials
  - Zone/room
  - Retrieved from model (e.g., IFC)

**Why:**

- Makes the model directly production-useful and reduces manual work

### 8.2 Drawing Snippets Linked to Cut List

**Requirements:**

- When generating cut lists, BOB shall also:
  1. Retrieve and display/export snippets of relevant working drawings (plan/section cutouts) for the area/zone
  2. Create numbered working drawing snippets (plan and/or section) where each cut element/group gets a position number that corresponds to pos.nr. in the cut list

**Why:**

- Ensures production/installation sees what goes where, without interpretation and extra coordination

---

## 9) Simplebim Command Line API Integration

### 9.1 Support for Simplebim CLI Operations

**Requirements:**

- BOB shall integrate support for Simplebim Command Line API for automated IFC processing, including:
  - Import
  - Import + Dataflow/Template
  - Export
  - Export Silent (Close)
  - Batch processing via script (.sbs) / dataflows
  - Variables: `%MODEL_FILE%`, `%MODEL_PATH%`, `%MODEL_NAME%`, `%MODEL_EXT%`, `%SCRIPT_PATH%`
  - Merge config (MERGE_TYPE etc.)
  - Log control (StartLog/SaveLog)
  - Temp folder setting
  - Headless/minimized execution
  - Job log and error handling

**Why:**

- Automates repeatable IFC routines (clean, classification, property mapping, export) and provides consistent deliverables

### 9.2 Wizard for Creating Script/Template/Dataflow (Guided Process)

**Requirements:**

- When the user asks BOB to create a Simplebim script or template, BOB shall start a guided wizard that:
  - Asks for necessary files and goals (what it should do)
  - Validates input step by step
  - Suggests defaults
  - Finally generates the artifact (script/template/dataflow)
  - And can run test/preview if desired

**Why:**

- Lowers the threshold for using Simplebim and makes automation accessible to more people

---

## 10) Public Website Structure

**Requirements/Idea:**

- When publishing BOB's public website, the top section shall be structured horizontally with:
  1. Logo on the left
  2. Main homepage/hero with slogan next to it
  3. Services/products to the right of hero
  4. "This is me"/info about Andreas all the way to the right

**Why:**

- Clear visual structure and clear ownership/personal profiling

---

## 11) BOB Chat Requirements

BOB Chat is the project's communication and follow-up hub, tightly integrated with IFC, files, findings, and issues.

### 11.1 Channels and Structure

**Requirements:**

- Project channels (e.g., general, design, construction site, logistics, deviations, meetings)
- Private channels (invitation-based)
- Channel archiving
- Pin important messages/threads

### 11.2 Threads and Status

**Requirements:**

- All messages can have a thread
- Thread status: `Open`, `Resolved`, `Blocked`
- "Mark as decision" and have decisions easily retrievable

### 11.3 Object-Based Chat (Context Binding)

**Requirements:**

- Chat must be able to be linked to:
  - IFC element
  - Issue/Deviation/RFI
  - Control finding
  - File/file version
  - (Later) cutlist item / drawing snippet / meeting package
- When you are on an object, you should be able to see relevant dialogue and start a new thread with the object as context

### 11.4 Search and Filtering (SearchResultsPage-Like)

**Requirements:**

- Full-text search in chat
- Filtering: channel, person, date, object type, status (open/resolved)

### 11.5 From Chat to Action (Conversion)

**Requirements:**

- Convert message/thread to:
  - Issue (deviation)
  - RFI
  - Task
- Prefill with title/description + link back to chat thread + context object

### 11.6 Notifications and "Follow" Function

**Requirements:**

- Notification at @mentions
- Notification at replies in threads you follow
- Mute channel/thread
- Watch objects and get notifications when they are discussed/changed

### 11.7 Attachments

**Requirements:**

- Attachments (images/PDF/snippets) in chat
- Attachments follow access (you cannot download something you don't have access to)

### 11.8 AI in Chat

**Requirements:**

- AI assistant shall be able to:
  - Summarize threads ("clarified", "remains", "next steps")
  - Suggest actions (create issue/RFI/meeting), but with user confirmation
  - Answer based on project context (files, IFC data, findings, issues, previous threads), access-controlled

---

## 12) Critical Security Requirements

BOB must always enforce:

- **Project isolation** - No data leakage between projects
- **Role-based access** (platform/org/project) - Users only see what they have access to
- **Channel/object access** - Private channels and sensitive objects must be protected
- **Traceability on follow-up** - Who did what when, especially for:
  - Conversion of thread → issue/RFI/task
  - Status changes on findings/deviations
  - Decision marking

### Security Implementation Requirements:

1. **Row Level Security (RLS)** on all database tables
2. **Organization-level isolation** - No user can access data from organizations they are not part of
3. **Project-level isolation** - No user can access project data without explicit project membership
4. **File access control** - Files are only accessible to users with project membership
5. **AI context isolation** - AI must only have access to data from the current project and respect user permissions
6. **Audit logging** - All critical operations must be logged with user ID, timestamp, and action details
7. **Permission validation** - All API endpoints must validate user permissions before returning data
8. **Secure file storage** - Files must be stored with proper access controls and encryption

---

## Implementation Priority

### Phase 1: Foundation (Must Have - Weeks 1-4)
1. Multi-tenant architecture with organizations
2. Platform admin, org admin, project admin roles
3. Enhanced RBAC with access levels
4. Row Level Security policies
5. Admin UI gating

### Phase 2: Core Features (Must Have - Weeks 5-10)
6. Auto-analysis and persistent knowledge base
7. Cross-project file search
8. IFC viewer with SearchResultsPage experience
9. Dashboard with project overview
10. Basic quality controls

### Phase 3: Advanced Features (Should Have - Weeks 11-14)
11. Meeting suggestions from control findings
12. Cut lists from IFC
13. Drawing snippets with position numbers
14. Chat channels and threads
15. Object-based chat

### Phase 4: Integration & Polish (Nice to Have - Weeks 15-16)
16. Simplebim CLI integration
17. Simplebim wizard
18. AI chat assistant
19. Export to Word/Excel
20. Public website updates

---

## Success Criteria

### Technical Success Criteria:
- [ ] Zero critical security vulnerabilities
- [ ] All projects fully isolated (no data leakage)
- [ ] All files access-controlled by project membership
- [ ] AI respects project boundaries and user permissions
- [ ] <500ms API response time (p95)
- [ ] <2s IFC search response time
- [ ] 99.9% uptime

### Functional Success Criteria:
- [ ] Platform admin can manage all organizations
- [ ] Org admin can manage their organization users
- [ ] Project admin can manage project members
- [ ] Users can search across all project files
- [ ] IFC viewer shows search results with zoom capability
- [ ] Dashboard shows project status at a glance
- [ ] Quality controls generate meeting suggestions
- [ ] Cut lists link to drawing snippets with position numbers
- [ ] Chat integrates with IFC elements and issues
- [ ] AI provides project-aware assistance

### Business Success Criteria:
- [ ] 5 pilot projects onboarded
- [ ] 20+ active users
- [ ] 100+ IFC files processed
- [ ] 500+ issues tracked
- [ ] Positive user feedback (NPS > 40)

---

**Document prepared by:** GitHub Copilot  
**Based on:** Norwegian functional requirements specification  
**For:** ALTBIM/BOB Platform  
**Last updated:** February 16, 2026
