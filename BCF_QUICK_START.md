# BCF Quick Start Guide

This guide will help you get started with BCF (BIM Collaboration Format) in BOB.

## What is BCF?

BCF (BIM Collaboration Format) is an open standard for communicating issues found in BIM models. It allows you to:
- Document problems or questions about specific building elements
- Share viewpoints (camera positions) showing exactly where issues are
- Add comments and track status through resolution
- Export/import issues to/from other BIM software (Catenda, Solibri, Revit, etc.)

## Quick Start (5 minutes)

### 1. Navigate to BCF
From the main menu, click **"BCF Topics"** or navigate to:
```
/app/bcf?project_id=YOUR_PROJECT_ID
```

### 2. Create Your First Topic

1. Click the **"Ny"** (New) button in the top-right
2. Fill in the form:
   - **Tittel** (Title): Short description, e.g., "Manglende isolasjon i yttervegg"
   - **Beskrivelse** (Description): Detailed explanation
   - **Status**: Choose from Open, In Progress, Resolved, Closed
   - **Prioritet** (Priority): Lav, Medium, Høy, or Kritisk
   - **Fag** (Discipline): e.g., ARK, RIB, VVS, EL
   - **Fase** (Stage): e.g., Prosjektering, Utførelse
3. Click **"Opprett BCF Topic"**

### 3. View Topic Details

- Click on any topic in the list to view details
- You'll see:
  - Full metadata (status, priority, assigned user, etc.)
  - Comment thread
  - Viewpoints (if any)
  - Linked IFC elements

### 4. Add Comments

1. Scroll to the bottom of the topic detail panel
2. Type your comment in the text area
3. Click **"Send kommentar"**
4. The assigned user will receive a notification

### 5. Change Status

- Use the status dropdown at the top of the detail panel
- Changing status automatically creates a system comment

## Common Workflows

### Workflow 1: Report an Issue

**Scenario**: You found missing insulation in a wall during model review.

1. Navigate to BCF page
2. Click "Ny"
3. Set:
   - Title: "Manglende isolasjon i vegg E-1234"
   - Description: "Yttervegg mangler 200mm isolasjon iht. TEK17"
   - Priority: Høy
   - Discipline: ARK
   - Status: Open
4. If you know the IFC element GUID, you can add it manually
5. Click "Opprett BCF Topic"
6. Assign to the architect responsible

### Workflow 2: Track Issue to Resolution

1. Find the topic in the list
2. Click to open details
3. Add comment: "Isolasjon er lagt til i modell versjon 2.1"
4. Change status to "Resolved"
5. Reviewer verifies and changes to "Closed"

### Workflow 3: Filter Topics

Use the search and filter options:
- **Search**: Type keywords to search in title and description
- **Status filter**: Show only open issues
- **Priority filter**: Show only high and critical priority
- **Discipline**: Filter by ARK, RIB, etc.

## Tips & Best Practices

### Writing Good Titles
✅ **Good**: "Dør D-101 åpner feil vei (brannvei)"  
❌ **Bad**: "Problem med dør"

### Adding Context
- Always add a description explaining the issue
- Include relevant codes/regulations (TEK17, NS-EN, etc.)
- Mention which model version you're reviewing
- Add tags/labels for easy filtering later

### Using Priority
- **Kritisk**: Blocks construction, safety hazard
- **Høy**: Must be fixed before next milestone
- **Medium**: Should be fixed, but not blocking
- **Lav**: Nice to have, cosmetic issues

### Using Status
- **Open**: Newly created, not yet addressed
- **In Progress**: Someone is actively working on it
- **Resolved**: Fix is completed, waiting for verification
- **Closed**: Verified and approved, no further action needed

### Assigning Topics
- Assign to the person responsible for fixing
- They'll receive a notification
- They'll also be notified of new comments

## Keyboard Shortcuts

Currently no keyboard shortcuts, but you can navigate with:
- Click topic → View details
- Scroll in list → See more topics
- Tab → Move between form fields

## Integration with IFC Viewer (Coming Soon)

Soon you'll be able to:
- Select elements in the 3D viewer → Create BCF topic
- Click "Open in Viewer" from viewpoint → Zoom to elements
- Automatic snapshot capture from viewer
- Camera position saved with viewpoint

## Export/Import (Coming Soon)

BCF topics can be exported to BCFZIP format and imported to:
- Catenda Hub
- Solibri
- BIMcollab
- Autodesk BIM 360
- Any BCF-compatible software

And vice versa - import topics from those tools into BOB.

## API Usage

For developers, all BCF functionality is available via REST API:

```bash
# List topics
GET /api/bcf/topics?project_id=xxx&status=open

# Create topic
POST /api/bcf/topics
{
  "project_id": "xxx",
  "title": "Issue title",
  "status": "open",
  "priority": "høy"
}

# Add comment
POST /api/bcf/topics/{id}/comments
{
  "comment": "This is a comment"
}
```

See `BCF_IMPLEMENTATION.md` for complete API documentation.

## Troubleshooting

### "No topics found"
- Make sure you've selected a project (check URL has `?project_id=...`)
- Try clearing filters
- Check if you have access to the project

### "Cannot create topic"
- You need write access to the project
- Check that all required fields are filled (title is required)
- Verify you're connected to the internet

### "Cannot add comment"
- You need write access to the project
- Check that comment is not empty
- Refresh the page and try again

## Getting Help

- Read the full implementation guide: `BCF_IMPLEMENTATION.md`
- Check the API documentation: `API_ENDPOINTS.md`
- Ask in BOB Chat (AI can help with BCF questions)

## What's Next?

Future enhancements planned:
- Import/export BCFZIP files
- Create topics from IFC viewer selection
- Link to chat threads
- Bulk operations
- Advanced filtering
- Configurable status workflows
- BCF 3.0 support

---

**Need help?** Contact support or check the documentation in `BCF_IMPLEMENTATION.md`.
