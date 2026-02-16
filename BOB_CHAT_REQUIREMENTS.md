# BOB Chat - Comprehensive Requirements

**Version:** 1.0  
**Date:** February 16, 2026  
**Status:** Complete Chat Specification  

---

## Overview

BOB Chat is the project's communication and follow-up hub, tightly integrated with IFC models, files, findings, and issues. It serves as the central place for team collaboration, decision-making, and action tracking within construction projects.

---

## 1. Channels and Structure

### 1.1 Project Channels

**Requirements:**
- Each project must have default channels:
  - **General** - Project-wide discussions
  - **Design** - Design team coordination
  - **Construction Site** - On-site coordination
  - **Logistics** - Deliveries and material management
  - **Deviations** - Issue tracking discussions
  - **Meetings** - Meeting preparation and follow-up

**Implementation:**
```sql
CREATE TABLE chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'project', 'private'
  is_default BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.2 Private Channels

**Requirements:**
- Users can create private channels
- Access is invitation-based only
- Private channels are hidden from non-members
- Channel creator is automatically an admin

**Features:**
- Invite/remove members
- Set channel permissions
- Archive/delete channel

### 1.3 Channel Archiving

**Requirements:**
- Channels can be archived (not deleted)
- Archived channels are read-only
- Archived channels are hidden by default but searchable
- Only channel admins can archive channels

### 1.4 Pin Important Messages

**Requirements:**
- Messages/threads can be pinned in a channel
- Pinned messages appear at the top of the channel
- Maximum 10 pinned messages per channel
- Only channel admins can pin/unpin

**Implementation:**
```sql
ALTER TABLE chat_messages ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_messages ADD COLUMN pinned_by UUID;
ALTER TABLE chat_messages ADD COLUMN pinned_at TIMESTAMPTZ;
```

---

## 2. Threads and Status

### 2.1 Thread Support

**Requirements:**
- Every message can spawn a thread
- Threads are collapsible/expandable
- Thread participants are tracked
- Unread thread indicators

**Implementation:**
```sql
CREATE TABLE chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  parent_message_id UUID NOT NULL,
  status TEXT DEFAULT 'open', -- 'open', 'resolved', 'blocked'
  is_decision BOOLEAN DEFAULT FALSE,
  participants UUID[],
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.2 Thread Status

**Requirements:**
- Threads have three statuses:
  - **Open** - Active discussion
  - **Resolved** - Decision made or question answered
  - **Blocked** - Waiting on external dependency

**Status transitions:**
```
Open → Resolved (when decision/answer reached)
Open → Blocked (when waiting on something)
Blocked → Open (when blocker removed)
Blocked → Resolved (when resolved despite blocker)
```

### 2.3 Mark as Decision

**Requirements:**
- Any thread can be marked as a decision
- Decisions are easily searchable and filterable
- Decision summary is required when marking
- Decisions are prominently displayed in UI

**Implementation:**
```sql
CREATE TABLE chat_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  decision_maker UUID,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  impact TEXT, -- 'high', 'medium', 'low'
  tags TEXT[]
);
```

**UI Features:**
- "Decisions" tab in project
- Decision timeline
- Export decisions to PDF/Word

---

## 3. Object-Based Chat (Context Binding)

### 3.1 Linkable Objects

**Requirements:**
Chat must support linking to:
1. **IFC elements** - Specific building components
2. **Issues/Deviations/RFI** - Problem tracking
3. **Control findings** - Quality control results
4. **Files/File versions** - Documents and models
5. **Cut list items** (later phase)
6. **Drawing snippets** (later phase)
7. **Meeting packages** (later phase)

**Implementation:**
```sql
CREATE TABLE chat_object_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX chat_object_links_object_idx ON chat_object_links(object_type, object_id);
```

### 3.2 Object Context Display

**Requirements:**
When viewing an object (e.g., IFC element):
- Show all related chat threads
- Display thread status and participant count
- Allow starting new thread with object pre-linked
- Show decision history related to object

**UI Components:**
- `ObjectChatPanel` - Shows chat for current object
- `NewThreadDialog` - Create thread with object context
- `ObjectDecisions` - View all decisions about object

### 3.3 Object Watch/Follow

**Requirements:**
- Users can "watch" objects
- Receive notifications when object is discussed
- Receive notifications when object properties change
- Can unwatch at any time

```sql
CREATE TABLE object_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, object_type, object_id)
);
```

---

## 4. Search and Filtering

### 4.1 Full-Text Search

**Requirements:**
- Search across all message content
- Search in thread titles and summaries
- Search in decision summaries
- Support for Norwegian language

**Implementation:**
```sql
-- Add full-text search index
ALTER TABLE chat_messages ADD COLUMN search_vector tsvector;

CREATE INDEX chat_messages_search_idx ON chat_messages USING gin(search_vector);

-- Update trigger for search vector
CREATE OR REPLACE FUNCTION chat_messages_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('norwegian', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 4.2 Filtering Options

**Requirements:**
Users can filter chat by:
- **Channel** - Specific channels
- **Person** - Messages from/mentioning specific users
- **Date range** - Time-based filtering
- **Object type** - Messages linked to specific object types
- **Status** - Thread status (open/resolved/blocked)
- **Has decision** - Only threads marked as decisions
- **Has attachments** - Messages with files
- **Mentions me** - Messages where I was @mentioned

**UI:**
- Advanced filter panel
- Quick filters (common combinations)
- Save filter presets
- Share filter URLs

---

## 5. From Chat to Action (Conversion)

### 5.1 Convert to Issue

**Requirements:**
- Any message or thread can be converted to an Issue
- Prefill issue form with:
  - Title from thread title or message excerpt
  - Description from message content
  - Link back to originating chat thread
  - Linked objects from thread
  - Participants as watchers

**Implementation:**
```sql
CREATE TABLE chat_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES chat_messages(id),
  thread_id UUID REFERENCES chat_threads(id),
  target_type TEXT NOT NULL, -- 'issue', 'rfi', 'task'
  target_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.2 Convert to RFI (Request for Information)

**Requirements:**
- Similar to issue conversion
- RFI-specific fields:
  - Question/request clearly stated
  - Urgency level
  - Required response date
  - Recipient(s)

### 5.3 Convert to Task

**Requirements:**
- Create actionable task from discussion
- Task fields:
  - Title
  - Description
  - Assignee
  - Due date
  - Priority
  - Linked to original chat

**UI Flow:**
1. User clicks "Convert to..." on message/thread
2. Dialog shows with type selection (Issue/RFI/Task)
3. Form pre-filled with chat content
4. User can edit before creating
5. Success message shows link to created item
6. Badge on original message shows conversion

---

## 6. Notifications and Follow Function

### 6.1 @Mentions

**Requirements:**
- Users can @mention other users in messages
- Mentioned users receive notifications
- @mentions are highlighted in message
- Can @mention teams (e.g., @design-team)

**Implementation:**
```sql
CREATE TABLE chat_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID,
  mentioned_team_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.2 Thread Following

**Requirements:**
- Users automatically follow threads they participate in
- Can manually follow any thread
- Receive notifications for all replies in followed threads
- Can unfollow threads

### 6.3 Mute Channels/Threads

**Requirements:**
- Users can mute channels to stop all notifications
- Users can mute specific threads
- Muted items are visually marked
- Can unmute at any time

```sql
CREATE TABLE chat_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
  muted_until TIMESTAMPTZ, -- NULL = permanent
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.4 Notification Preferences

**Requirements:**
Users can configure:
- In-app notifications (on/off)
- Email notifications (on/off, frequency)
- Desktop notifications (on/off)
- Mobile push notifications (on/off)
- Per-channel notification overrides

---

## 7. Attachments

### 7.1 File Attachments

**Requirements:**
- Users can attach files to messages
- Supported types: Images, PDF, Excel, Word, IFC snippets
- Maximum file size: 50MB per attachment
- Maximum attachments per message: 10
- Files are virus-scanned before upload

**Implementation:**
```sql
CREATE TABLE chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_url TEXT NOT NULL,
  thumbnail_url TEXT,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 7.2 Access Control for Attachments

**Requirements:**
- Attachments inherit channel access permissions
- Users without channel access cannot download attachments
- Download requires authentication
- Audit log for all downloads

**Security:**
```typescript
async function canDownloadAttachment(userId: string, attachmentId: string): Promise<boolean> {
  // Check if user has access to the channel
  // Check if user is not blocked from channel
  // Log download attempt
}
```

### 7.3 Image Preview

**Requirements:**
- Images display inline in chat
- Click to enlarge
- Support for common formats (PNG, JPG, GIF, WebP)
- Lazy loading for performance

### 7.4 PDF Preview

**Requirements:**
- PDF files show preview in chat
- First page thumbnail
- Page count indicator
- Click to open full PDF viewer

---

## 8. AI in Chat

### 8.1 Thread Summarization

**Requirements:**
- AI can summarize long threads
- Summary includes:
  - What was clarified/decided
  - What remains open
  - Suggested next steps
  - Key participants

**Implementation:**
```typescript
async function summarizeThread(threadId: string): Promise<ThreadSummary> {
  // Fetch all messages in thread
  // Build context with project data
  // Call AI to summarize
  // Return structured summary
}
```

### 8.2 Action Suggestions

**Requirements:**
- AI suggests actions based on thread content:
  - "Create issue for this problem"
  - "Schedule meeting with [participants]"
  - "Update project timeline"
  - "Assign task to [person]"
- All suggestions require user confirmation
- No automatic actions without approval

### 8.3 Context-Aware Responses

**Requirements:**
- AI can answer questions in chat
- AI has access to:
  - Project files and documents
  - IFC model data
  - Previous chat history
  - Quality control findings
  - Issues and RFIs
- All AI responses are access-controlled
- AI cannot leak data across projects

**Security:**
```typescript
async function buildAIContext(projectId: string, userId: string): Promise<AIContext> {
  // Only include data user has access to
  // Filter by project_id
  // Respect RLS policies
  // Log context building
}
```

### 8.4 AI Response Attribution

**Requirements:**
- AI responses clearly marked as AI-generated
- AI responses include confidence level when applicable
- AI responses cite sources (files, documents, etc.)
- Users can provide feedback on AI responses

**UI:**
```tsx
<Message isAI={true}>
  <AIBadge />
  <MessageContent>
    {content}
    <SourceCitations sources={sources} />
  </MessageContent>
  <AIFeedback onFeedback={handleFeedback} />
</Message>
```

---

## Database Schema Summary

### Complete Chat Schema

```sql
-- Channels
CREATE TABLE chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'project', 'private'
  is_default BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Channel members (for private channels)
CREATE TABLE chat_channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member', -- 'admin', 'member'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

-- Messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  pinned_by UUID,
  pinned_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  search_vector tsvector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Threads
CREATE TABLE chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  parent_message_id UUID NOT NULL,
  status TEXT DEFAULT 'open',
  is_decision BOOLEAN DEFAULT FALSE,
  participants UUID[],
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Object links
CREATE TABLE chat_object_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Decisions
CREATE TABLE chat_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  decision_maker UUID,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  impact TEXT,
  tags TEXT[]
);

-- Mentions
CREATE TABLE chat_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID,
  mentioned_team_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Object watches
CREATE TABLE object_watches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, object_type, object_id)
);

-- Mutes
CREATE TABLE chat_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
  muted_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attachments
CREATE TABLE chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_url TEXT NOT NULL,
  thumbnail_url TEXT,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversions
CREATE TABLE chat_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES chat_messages(id),
  thread_id UUID REFERENCES chat_threads(id),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## API Endpoints

### Channels
- `GET /api/chat/channels` - List channels for project
- `POST /api/chat/channels` - Create channel
- `GET /api/chat/channels/:id` - Get channel details
- `PATCH /api/chat/channels/:id` - Update channel
- `DELETE /api/chat/channels/:id` - Archive channel
- `POST /api/chat/channels/:id/members` - Add member
- `DELETE /api/chat/channels/:id/members/:userId` - Remove member

### Messages
- `GET /api/chat/channels/:id/messages` - List messages
- `POST /api/chat/channels/:id/messages` - Send message
- `PATCH /api/chat/messages/:id` - Edit message
- `DELETE /api/chat/messages/:id` - Delete message
- `POST /api/chat/messages/:id/pin` - Pin message
- `DELETE /api/chat/messages/:id/pin` - Unpin message

### Threads
- `GET /api/chat/threads/:id` - Get thread
- `POST /api/chat/threads/:id/messages` - Reply to thread
- `PATCH /api/chat/threads/:id/status` - Update thread status
- `POST /api/chat/threads/:id/decision` - Mark as decision

### Search
- `GET /api/chat/search` - Search messages
- `GET /api/chat/filters` - Get available filters

### Actions
- `POST /api/chat/convert` - Convert message/thread to issue/RFI/task
- `POST /api/chat/objects/:type/:id/threads` - Get threads for object
- `POST /api/chat/watch` - Watch object
- `DELETE /api/chat/watch` - Unwatch object

---

## UI Components

### Core Components
- `ChatLayout` - Main chat layout
- `ChannelList` - List of channels
- `MessageList` - List of messages in channel
- `MessageInput` - Compose message
- `ThreadView` - Thread sidebar
- `SearchPanel` - Search interface

### Feature Components
- `ObjectChatPanel` - Chat for specific object
- `DecisionList` - List of decisions
- `ConvertDialog` - Convert to issue/RFI/task
- `ThreadSummary` - AI-generated summary
- `AIResponse` - AI message display
- `AttachmentUpload` - File upload
- `MentionAutocomplete` - @mention suggestions

---

**Document prepared by:** GitHub Copilot  
**Based on:** BOB Functional Requirements Section 11  
**For:** ALTBIM/BOB Platform  
**Last updated:** February 16, 2026
