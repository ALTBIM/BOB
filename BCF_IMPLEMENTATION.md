# BCF (BIM Collaboration Format) Implementation

This document describes the BCF implementation in BOB.

## Overview

BCF (BIM Collaboration Format) is an open file format for issue tracking in BIM projects. This implementation provides full support for creating, managing, and exchanging BCF topics with other BIM applications.

## Features

### Core Functionality ✅
- **Create BCF Topics**: Create issues directly in BOB or from IFC viewer selections
- **View & Manage Topics**: List, filter, search, and manage all BCF topics in a project
- **Comments**: Add threaded comments to topics with automatic notifications
- **Viewpoints**: Store camera positions and element selections from the 3D viewer
- **Status Workflow**: Track topics through their lifecycle (Open → In Progress → Resolved → Closed)
- **Access Control**: Full RBAC integration with project-level permissions

### Data Model

#### BCF Topics (extends `issues` table)
- **Standard Fields**: title, description, status, priority, due date
- **BCF-Specific**: bcf_guid, stage, discipline, labels
- **Relationships**: assigned user, created by, project
- **Element Links**: Array of IFC element GUIDs

#### BCF Viewpoints
- **Camera Data**: position, direction, up vector, field of view
- **Snapshots**: PNG/JPG images of the 3D view
- **Element Selection**: Lists of selected, visible, and hidden IFC elements
- **Clipping Planes**: Optional clipping plane definitions (P2)

#### BCF Comments
- Full comment threading with user attribution
- Attachment support (images, PDFs)
- Automatic system comments for status changes
- @mentions support (planned)

#### BCF Labels
- Project-specific tags/labels
- Color-coded for visual distinction
- Used for categorization and filtering

## API Endpoints

### Topics
```
GET    /api/bcf/topics              - List topics with filters
POST   /api/bcf/topics              - Create new topic
GET    /api/bcf/topics/[id]         - Get topic details
PATCH  /api/bcf/topics/[id]         - Update topic
DELETE /api/bcf/topics/[id]         - Delete topic (admin only)
```

### Viewpoints
```
POST   /api/bcf/topics/[id]/viewpoints  - Add viewpoint to topic
```

### Comments
```
POST   /api/bcf/topics/[id]/comments    - Add comment to topic
```

### Import/Export (Planned)
```
POST   /api/bcf/import              - Import BCFZIP file
POST   /api/bcf/export              - Export topics to BCFZIP
```

## UI Components

### BCFTopicList
Left panel component showing:
- List of all topics in the project
- Search and filtering capabilities
- Status, priority, and label badges
- Quick navigation to topic details

### BCFTopicDetail
Main panel component showing:
- Topic metadata (title, description, status, priority, etc.)
- Assigned user, due date, created/updated timestamps
- Stage, discipline, and labels
- Viewpoint snapshots with "Open in Viewer" functionality
- Comment thread with reply capability
- Linked IFC elements

### CreateBCFTopicDialog
Modal dialog for creating new topics with:
- Title and description fields
- Status, priority, stage, discipline selection
- Label management
- Support for prefilled data from viewer

## Database Schema

### Extended `issues` Table
```sql
ALTER TABLE issues ADD COLUMN bcf_guid TEXT UNIQUE;
ALTER TABLE issues ADD COLUMN stage TEXT;
ALTER TABLE issues ADD COLUMN discipline TEXT;
ALTER TABLE issues ADD COLUMN labels TEXT[];
```

### New Tables
- `bcf_viewpoints`: Camera and snapshot data
- `bcf_labels`: Project-specific tags
- `bcf_topic_links`: Links to IFC elements, files, chat threads

### Helper Functions
- `create_bcf_topic()`: Creates a topic with automatic BCF GUID
- `add_bcf_viewpoint()`: Adds viewpoint with proper indexing

### Triggers
- Status change automatically creates a system comment
- Updated_at timestamp maintained automatically

## Integration Points

### Project Access Control
- Full RLS (Row Level Security) integration
- Respects project membership and access levels
- Read/Write/Admin permissions enforced

### Activity Logging
All BCF actions are logged:
- Topic created/updated/deleted
- Comments added
- Viewpoints added
- Status changes

### Notifications
Automatic notifications sent when:
- User is assigned to a topic
- New comment is added to assigned topic
- Status changes on assigned topic

### IFC Viewer (Planned)
- Create topic from selected elements
- Capture snapshot with camera position
- Open viewpoint and zoom to elements
- Highlight selected elements in viewer

### Chat Integration (Planned)
- Convert chat thread to BCF topic
- Link BCF topic to chat discussion
- Carry over context and attachments

## Usage Examples

### Creating a Topic from Code
```typescript
const response = await fetch('/api/bcf/topics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    project_id: projectId,
    title: 'Missing insulation in wall',
    description: 'Wall element #12345 is missing insulation layer',
    status: 'open',
    priority: 'høy',
    discipline: 'ARK',
    stage: 'Detaljprosjektering',
    labels: ['isolasjon', 'yttervegg'],
    ifc_element_guids: ['2O2Fr$t4X7Zf8NOew3FLOH'],
  }),
});
```

### Filtering Topics
```typescript
const params = new URLSearchParams({
  project_id: projectId,
  status: 'open,in_progress',
  priority: 'høy,kritisk',
  discipline: 'ARK',
  search: 'vegg',
});

const response = await fetch(`/api/bcf/topics?${params}`);
```

### Adding a Comment
```typescript
await fetch(`/api/bcf/topics/${topicId}/comments`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    comment: 'Isolasjonen er nå lagt til. Klar for kontroll.',
  }),
});
```

## BCF Standard Compliance

This implementation is based on **BCF 2.x** specification:
- ✅ Topics with GUID, title, description, status, priority
- ✅ Comments with GUID and threading
- ✅ Viewpoints with camera and snapshot
- ✅ Element references via IFC GUIDs
- ⏳ BCFZIP import/export (planned)
- ⏳ Full BCF 3.0 evaluation (P2)

## Roadmap

### Phase 1: MVP ✅
- [x] Database schema
- [x] Core API endpoints
- [x] UI components
- [x] Topic list and detail views
- [x] Comment system
- [x] Basic viewpoint support

### Phase 2: P1 (Next)
- [ ] BCFZIP import/export
- [ ] Viewer integration (create from selection)
- [ ] Viewer integration (open viewpoint)
- [ ] Chat to BCF conversion
- [ ] Dashboard counters

### Phase 3: P2 (Future)
- [ ] Clipping planes support
- [ ] Advanced filtering (facets)
- [ ] Configurable status workflows
- [ ] BCF 3.0 features
- [ ] Bulk operations
- [ ] Advanced conflict resolution on import

## Security Considerations

- All BCF data is project-isolated via RLS
- Only users with project access can view topics
- Write access required to create/comment
- Admin access required to delete topics
- BCF GUIDs are treated as public within project context
- Snapshots should be stored with proper access control

## Performance

- Indexed fields: project_id, status, priority, assigned_to, labels, discipline, stage
- Full-text search on title and description
- Pagination support (default 30 per page)
- Optimized queries with proper joins

## Testing

To test the BCF implementation:

1. Navigate to `/app/bcf?project_id=YOUR_PROJECT_ID`
2. Click "Ny" to create a topic
3. Fill in the form and submit
4. Click on the created topic to view details
5. Add comments
6. Change status
7. Verify notifications are sent

## Migration

To apply the BCF schema to your database:

```bash
psql -h YOUR_DB_HOST -U postgres -d YOUR_DB -f supabase/migrations/bcf_implementation.sql
```

Or using Supabase CLI:
```bash
supabase db push
```

## Support

For questions or issues with BCF implementation:
- Check the API documentation in `/API_ENDPOINTS.md`
- Review the TypeScript types in `/src/types/bcf.ts`
- See implementation guide in `/IMPLEMENTATION_GUIDE.md`
