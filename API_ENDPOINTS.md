# BOB Platform - Komplette API-endepunkter
**Basert på full spesifikasjon**

---

## 🔐 Autentisering

Alle API-endepunkter krever autentisering via Supabase Auth.

```typescript
// Headers for alle requests:
{
  "Authorization": "Bearer <supabase_jwt_token>",
  "Content-Type": "application/json"
}
```

---

## 📁 Organisasjoner (Multi-tenant)

### `POST /api/organizations`
**Beskrivelse:** Opprett ny organisasjon (kun platform admin)  
**Tilgang:** Platform admin  
**Body:**
```json
{
  "name": "Byggfirma AS",
  "created_by": "user-uuid"
}
```
**Response:**
```json
{
  "id": "org-uuid",
  "name": "Byggfirma AS",
  "created_by": "user-uuid",
  "created_at": "2025-12-11T10:00:00Z"
}
```

### `GET /api/organizations`
**Beskrivelse:** List brukerens organisasjoner  
**Tilgang:** Autentisert bruker  
**Response:**
```json
{
  "organizations": [
    {
      "id": "org-uuid",
      "name": "Byggfirma AS",
      "role": "org_admin",
      "member_count": 15,
      "project_count": 8
    }
  ]
}
```

### `GET /api/organizations/:id`
**Beskrivelse:** Hent organisasjonsdetaljer  
**Tilgang:** Org medlem eller platform admin  
**Response:**
```json
{
  "id": "org-uuid",
  "name": "Byggfirma AS",
  "created_by": "user-uuid",
  "created_at": "2025-12-11T10:00:00Z",
  "member_count": 15,
  "project_count": 8
}
```

### `PATCH /api/organizations/:id`
**Beskrivelse:** Oppdater organisasjon  
**Tilgang:** Org admin eller platform admin  
**Body:**
```json
{
  "name": "Nytt Byggfirma AS"
}
```

### `DELETE /api/organizations/:id`
**Beskrivelse:** Slett organisasjon  
**Tilgang:** Platform admin  

---

## 👥 Organisasjonsmedlemmer

### `GET /api/organizations/:id/members`
**Beskrivelse:** List organisasjonsmedlemmer  
**Tilgang:** Org medlem eller platform admin  
**Response:**
```json
{
  "members": [
    {
      "id": "member-uuid",
      "user_id": "user-uuid",
      "email": "user@example.com",
      "org_role": "org_admin",
      "joined_at": "2025-12-11T10:00:00Z"
    }
  ]
}
```

### `POST /api/organizations/:id/members`
**Beskrivelse:** Legg til medlem i organisasjon  
**Tilgang:** Org admin eller platform admin  
**Body:**
```json
{
  "user_id": "user-uuid",
  "org_role": "member"
}
```

### `PATCH /api/organizations/:id/members/:userId`
**Beskrivelse:** Oppdater medlemsrolle  
**Tilgang:** Org admin eller platform admin  
**Body:**
```json
{
  "org_role": "org_admin"
}
```

### `DELETE /api/organizations/:id/members/:userId`
**Beskrivelse:** Fjern medlem fra organisasjon  
**Tilgang:** Org admin eller platform admin  

---

## 📊 Prosjekter

### `POST /api/projects`
**Beskrivelse:** Opprett nytt prosjekt  
**Tilgang:** Org admin eller platform admin  
**Body:**
```json
{
  "name": "Boligblokk Sentrum",
  "description": "50 leiligheter i sentrum",
  "org_id": "org-uuid",
  "client": "Boligutvikling AS",
  "location": "Oslo",
  "type": "residential",
  "status": "active"
}
```
**Response:**
```json
{
  "project": {
    "id": "project-uuid",
    "name": "Boligblokk Sentrum",
    "org_id": "org-uuid",
    "created_by": "user-uuid",
    "created_at": "2025-12-11T10:00:00Z"
  },
  "membership": {
    "role": "byggherre",
    "access_level": "admin"
  }
}
```

### `GET /api/projects`
**Beskrivelse:** List brukerens prosjekter  
**Query params:**
- `org_id` (optional): Filtrer på organisasjon
- `status` (optional): active | archived
**Response:**
```json
{
  "projects": [
    {
      "id": "project-uuid",
      "name": "Boligblokk Sentrum",
      "org_id": "org-uuid",
      "status": "active",
      "progress": 45,
      "active_issues_count": 12,
      "member_count": 8
    }
  ]
}
```

### `GET /api/projects/:id`
**Beskrivelse:** Hent prosjektdetaljer  
**Tilgang:** Prosjektmedlem  
**Response:**
```json
{
  "id": "project-uuid",
  "name": "Boligblokk Sentrum",
  "description": "50 leiligheter i sentrum",
  "org_id": "org-uuid",
  "client": "Boligutvikling AS",
  "location": "Oslo",
  "type": "residential",
  "status": "active",
  "progress": 45,
  "created_by": "user-uuid",
  "created_at": "2025-12-11T10:00:00Z",
  "stats": {
    "active_issues": 12,
    "total_files": 45,
    "ifc_models": 3,
    "members": 8
  }
}
```

### `PATCH /api/projects/:id`
**Beskrivelse:** Oppdater prosjekt  
**Tilgang:** Prosjekt admin  

### `DELETE /api/projects/:id`
**Beskrivelse:** Slett prosjekt  
**Tilgang:** Prosjekt admin  

---

## 👤 Prosjektmedlemmer

### `GET /api/projects/:id/members`
**Beskrivelse:** List prosjektmedlemmer  
**Tilgang:** Prosjektmedlem  
**Response:**
```json
{
  "members": [
    {
      "id": "member-uuid",
      "user_id": "user-uuid",
      "email": "user@example.com",
      "role": "prosjektleder",
      "access_level": "admin",
      "company": "Byggfirma AS",
      "responsibility": "Koordinering",
      "permissions": ["read", "write", "manage_users"]
    }
  ]
}
```

### `POST /api/projects/:id/members`
**Beskrivelse:** Inviter medlem til prosjekt  
**Tilgang:** Prosjekt admin  
**Body:**
```json
{
  "user_id": "user-uuid",
  "role": "prosjekterende",
  "access_level": "write",
  "company": "Arkitektfirma AS",
  "responsibility": "Arkitektur"
}
```

### `PATCH /api/projects/:id/members/:userId`
**Beskrivelse:** Oppdater medlemstilgang  
**Tilgang:** Prosjekt admin  

### `DELETE /api/projects/:id/members/:userId`
**Beskrivelse:** Fjern medlem fra prosjekt  
**Tilgang:** Prosjekt admin  

---

## 👥 Teams

### `GET /api/teams?projectId=:id`
**Beskrivelse:** List teams i prosjekt  
**Tilgang:** Prosjektmedlem  

### `POST /api/teams`
**Beskrivelse:** Opprett team  
**Tilgang:** Prosjekt admin  
**Body:**
```json
{
  "project_id": "project-uuid",
  "name": "Arkitektteam",
  "description": "Ansvarlig for arkitektur"
}
```

### `POST /api/teams/:id/members`
**Beskrivelse:** Legg til medlem i team  
**Tilgang:** Prosjekt admin  

---

## 📄 Filer

### `POST /api/files/upload`
**Beskrivelse:** Last opp fil  
**Tilgang:** Prosjektmedlem med write-tilgang  
**Body:** FormData
```typescript
{
  file: File,
  project_id: string,
  category: 'contract' | 'drawing' | 'fdv' | 'description' | 'supplier' | 'control' | 'minutes',
  tags: string[],
  description?: string
}
```

### `GET /api/files?projectId=:id`
**Beskrivelse:** List filer i prosjekt  
**Query params:**
- `category` (optional)
- `tags` (optional)
**Response:**
```json
{
  "files": [
    {
      "id": "file-uuid",
      "name": "Arkitekttegning.pdf",
      "category": "drawing",
      "tags": ["arkitektur", "fasade"],
      "version": 2,
      "size": 5242880,
      "uploaded_by": "user-uuid",
      "uploaded_at": "2025-12-11T10:00:00Z",
      "has_changes": true
    }
  ]
}
```

### `GET /api/files/:id`
**Beskrivelse:** Hent fildetaljer  
**Tilgang:** Prosjektmedlem  

### `GET /api/files/:id/versions`
**Beskrivelse:** Hent filversjoner  
**Tilgang:** Prosjektmedlem  

### `GET /api/files/:id/download`
**Beskrivelse:** Last ned fil  
**Tilgang:** Prosjektmedlem  

---

## 🏗️ IFC-modeller

### `POST /api/ifc/upload`
**Beskrivelse:** Last opp IFC-fil  
**Tilgang:** Prosjektmedlem med write-tilgang  
**Body:** FormData

### `GET /api/ifc/models?projectId=:id`
**Beskrivelse:** List IFC-modeller i prosjekt  

### `GET /api/ifc/models/:id`
**Beskrivelse:** Hent IFC-modelldetaljer  

---

## 🔍 IFC-søk (KRITISK FUNKSJON!)

### `POST /api/ifc/search`
**Beskrivelse:** Søk i IFC-elementer med fasetter (SearchResultsPage-opplevelse)  
**Tilgang:** Prosjektmedlem  
**Body:**
```json
{
  "project_id": "project-uuid",
  "model_id": "model-uuid",
  "text": "søkeord",
  "filters": {
    "floor": ["1. etasje", "2. etasje"],
    "zone": ["A", "B"],
    "room": ["101", "102"],
    "element_type": ["vegg", "dør", "vindu"],
    "material": ["betong", "tre"],
    "fire_rating": ["EI60", "EI90"],
    "status": ["ok", "avvik"],
    "supplier": ["Leverandør AS"],
    "responsible": ["user-uuid"]
  },
  "limit": 50,
  "offset": 0
}
```
**Response:**
```json
{
  "results": [
    {
      "guid": "2O2Fr$t4X7Zf8NOew3FLOH",
      "name": "Yttervegg 200mm",
      "type": "IfcWall",
      "location": {
        "floor": "1. etasje",
        "zone": "A",
        "room": "101"
      },
      "properties": {
        "material": "betong",
        "fire_rating": "EI60",
        "thickness": 200
      },
      "status": "ok",
      "supplier": "Leverandør AS",
      "responsible": "user-uuid",
      "related_issues": ["issue-uuid"],
      "related_documents": ["doc-uuid"]
    }
  ],
  "total": 145,
  "facets": {
    "element_types": [
      { "value": "vegg", "count": 45 },
      { "value": "dør", "count": 23 }
    ],
    "floors": [
      { "value": "1. etasje", "count": 67 },
      { "value": "2. etasje", "count": 78 }
    ],
    "materials": [
      { "value": "betong", "count": 89 },
      { "value": "tre", "count": 34 }
    ]
  }
}
```

### `GET /api/ifc/elements/:guid`
**Beskrivelse:** Hent IFC-elementdetaljer  
**Query params:**
- `project_id`: required
- `model_id`: required
**Response:**
```json
{
  "guid": "2O2Fr$t4X7Zf8NOew3FLOH",
  "name": "Yttervegg 200mm",
  "type": "IfcWall",
  "properties": { /* alle properties */ },
  "geometry": { /* geometri-data */ },
  "location": {
    "floor": "1. etasje",
    "zone": "A",
    "room": "101"
  },
  "related_elements": ["guid1", "guid2"],
  "related_issues": [
    {
      "id": "issue-uuid",
      "title": "Manglende isolasjon",
      "status": "ny"
    }
  ]
}
```

### `GET /api/ifc/facets`
**Beskrivelse:** Hent tilgjengelige filterverdier  
**Query params:**
- `project_id`: required
- `model_id`: required
- `current_filters`: optional (JSON)

---

## 🚨 Avvik/RFI/Endringsforespørsler

### `POST /api/issues`
**Beskrivelse:** Opprett avvik/RFI  
**Tilgang:** Prosjektmedlem med write-tilgang  
**Body:**
```json
{
  "project_id": "project-uuid",
  "type": "avvik",
  "title": "Manglende isolasjon i yttervegg",
  "description": "Detaljert beskrivelse...",
  "priority": "høy",
  "category": "isolasjon",
  "assigned_to": "user-uuid",
  "due_date": "2025-12-20T00:00:00Z",
  "ifc_element_guids": ["2O2Fr$t4X7Zf8NOew3FLOH"],
  "attachments": [
    {
      "type": "image",
      "url": "https://...",
      "name": "bilde.jpg"
    }
  ]
}
```
**Response:**
```json
{
  "id": "issue-uuid",
  "project_id": "project-uuid",
  "type": "avvik",
  "title": "Manglende isolasjon i yttervegg",
  "status": "ny",
  "priority": "høy",
  "created_by": "user-uuid",
  "created_at": "2025-12-11T10:00:00Z"
}
```

### `GET /api/issues?projectId=:id`
**Beskrivelse:** List avvik/RFI  
**Query params:**
- `status`: ny | under_behandling | avklart | lukket
- `type`: avvik | rfi | endringsforespørsel
- `priority`: lav | medium | høy | kritisk
- `assigned_to`: user-uuid
- `created_by`: user-uuid
**Response:**
```json
{
  "issues": [
    {
      "id": "issue-uuid",
      "type": "avvik",
      "title": "Manglende isolasjon",
      "status": "ny",
      "priority": "høy",
      "assigned_to": {
        "id": "user-uuid",
        "email": "user@example.com"
      },
      "due_date": "2025-12-20T00:00:00Z",
      "created_at": "2025-12-11T10:00:00Z",
      "comment_count": 3
    }
  ],
  "total": 45,
  "stats": {
    "by_status": {
      "ny": 12,
      "under_behandling": 20,
      "avklart": 10,
      "lukket": 3
    },
    "by_priority": {
      "kritisk": 2,
      "høy": 8,
      "medium": 25,
      "lav": 10
    }
  }
}
```

### `GET /api/issues/:id`
**Beskrivelse:** Hent avvik/RFI-detaljer  
**Tilgang:** Prosjektmedlem  

### `PATCH /api/issues/:id`
**Beskrivelse:** Oppdater avvik/RFI  
**Tilgang:** Prosjektmedlem med write-tilgang  
**Body:**
```json
{
  "status": "under_behandling",
  "assigned_to": "user-uuid",
  "priority": "kritisk"
}
```

### `DELETE /api/issues/:id`
**Beskrivelse:** Slett avvik/RFI  
**Tilgang:** Prosjekt admin  

---

## 💬 Avvik-kommentarer

### `POST /api/issues/:id/comments`
**Beskrivelse:** Legg til kommentar  
**Tilgang:** Prosjektmedlem  
**Body:**
```json
{
  "comment": "Dette er løst nå",
  "attachments": [
    {
      "type": "image",
      "url": "https://...",
      "name": "løsning.jpg"
    }
  ]
}
```

### `GET /api/issues/:id/comments`
**Beskrivelse:** Hent kommentarer  
**Tilgang:** Prosjektmedlem  

### `GET /api/issues/:id/history`
**Beskrivelse:** Hent endringshistorikk  
**Tilgang:** Prosjektmedlem  

---

## ✅ Kvalitetskontroller

### `POST /api/controls`
**Beskrivelse:** Opprett kontroll  
**Tilgang:** Prosjektmedlem med write-tilgang  
**Body:**
```json
{
  "project_id": "project-uuid",
  "name": "TEK17-kontroll",
  "description": "Kontroll av TEK17-krav",
  "type": "kravkontroll",
  "ruleset": {
    "rules": [
      {
        "id": "tek17-1",
        "name": "Brannkrav",
        "condition": "fire_rating >= 'EI60'",
        "severity": "kritisk"
      }
    ]
  }
}
```

### `GET /api/controls?projectId=:id`
**Beskrivelse:** List kontroller  
**Tilgang:** Prosjektmedlem  

### `GET /api/controls/:id`
**Beskrivelse:** Hent kontrolldetaljer  
**Tilgang:** Prosjektmedlem  

### `POST /api/controls/:id/run`
**Beskrivelse:** Kjør kontroll  
**Tilgang:** Prosjektmedlem med write-tilgang  
**Body:**
```json
{
  "model_id": "model-uuid",
  "scope": {
    "floors": ["1. etasje"],
    "zones": ["A", "B"]
  }
}
```
**Response:**
```json
{
  "run_id": "run-uuid",
  "status": "kjører",
  "started_at": "2025-12-11T10:00:00Z"
}
```

### `GET /api/controls/runs/:id`
**Beskrivelse:** Hent kontrollkjøring-status  
**Tilgang:** Prosjektmedlem  
**Response:**
```json
{
  "id": "run-uuid",
  "control_id": "control-uuid",
  "status": "fullført",
  "run_at": "2025-12-11T10:00:00Z",
  "completed_at": "2025-12-11T10:05:00Z",
  "duration_ms": 300000,
  "findings_count": 12
}
```

### `GET /api/controls/runs/:id/findings`
**Beskrivelse:** Hent funn fra kontroll  
**Tilgang:** Prosjektmedlem  
**Response:**
```json
{
  "findings": [
    {
      "id": "finding-uuid",
      "severity": "kritisk",
      "title": "Manglende brannklassifisering",
      "description": "Vegg mangler EI60-klassifisering",
      "element_guid": "2O2Fr$t4X7Zf8NOew3FLOH",
      "element_type": "IfcWall",
      "location": {
        "floor": "1. etasje",
        "zone": "A"
      },
      "recommended_action": "Oppgrader til EI60-vegg",
      "auto_created_issue_id": "issue-uuid"
    }
  ],
  "total": 12,
  "by_severity": {
    "kritisk": 2,
    "feil": 5,
    "advarsel": 3,
    "info": 2
  }
}
```

---

## 📋 Kapplister (NØKKELFUNKSJON!)

### `POST /api/cutlists/generate`
**Beskrivelse:** Generer kappliste fra IFC  
**Tilgang:** Prosjektmedlem med write-tilgang  
**Body:**
```json
{
  "project_id": "project-uuid",
  "model_id": "model-uuid",
  "name": "Kappliste Sone A",
  "zone": "A",
  "room": "101",
  "material_type": "tre",
  "options": {
    "include_drawing_snippets": true,
    "snippet_types": ["plan", "snitt"]
  }
}
```
**Response:**
```json
{
  "id": "cutlist-uuid",
  "name": "Kappliste Sone A",
  "status": "genererer",
  "estimated_time_seconds": 60
}
```

### `GET /api/cutlists/:id`
**Beskrivelse:** Hent kappliste  
**Tilgang:** Prosjektmedlem  
**Response:**
```json
{
  "id": "cutlist-uuid",
  "project_id": "project-uuid",
  "name": "Kappliste Sone A",
  "zone": "A",
  "material_type": "tre",
  "generated_at": "2025-12-11T10:00:00Z",
  "items": [
    {
      "position_number": "P001",
      "quantity": 12,
      "length": 2400,
      "width": 100,
      "height": 50,
      "cut_length": 2350,
      "material": "Tre",
      "material_spec": "C24 konstruksjonstrevirke",
      "zone": "A",
      "room": "101",
      "comment": "Monter med 50mm avstand",
      "drawing_snippet_id": "snippet-uuid"
    }
  ],
  "total_items": 45,
  "drawing_snippets": [
    {
      "id": "snippet-uuid",
      "position_number": "P001",
      "snippet_type": "plan",
      "image_url": "https://...",
      "thumbnail_url": "https://..."
    }
  ]
}
```

### `GET /api/cutlists/:id/export/pdf`
**Beskrivelse:** Eksporter kappliste til PDF  
**Tilgang:** Prosjektmedlem  
**Response:** PDF-fil med:
- Forside med prosjektinfo
- Kappliste-tabell
- Tegningsutsnitt med pos.nr-markering

### `GET /api/cutlists/:id/export/xlsx`
**Beskrivelse:** Eksporter kappliste til XLSX  
**Tilgang:** Prosjektmedlem  
**Response:** XLSX-fil med kolonner:
- Pos.nr | Antall | L | B | H | Kappelengde | Materiale | Materialspesifikasjon | Sone | Rom | Kommentar

### `GET /api/cutlists?projectId=:id`
**Beskrivelse:** List kapplister  
**Tilgang:** Prosjektmedlem  

---

## 🤖 AI-assistent (Prosjekt-bevisst)

### `POST /api/ai/chat`
**Beskrivelse:** Send melding til AI  
**Tilgang:** Prosjektmedlem  
**Body:**
```json
{
  "project_id": "project-uuid",
  "message": "Hva er status på avvik i sone A?",
  "context": {
    "include_documents": true,
    "include_ifc": true,
    "include_issues": true
  }
}
```
**Response:**
```json
{
  "message": "I sone A er det 5 aktive avvik...",
  "sources": [
    {
      "type": "issue",
      "id": "issue-uuid",
      "title": "Manglende isolasjon",
      "snippet": "..."
    },
    {
      "type": "document",
      "id": "doc-uuid",
      "title": "Arkitekttegning",
      "page": 12,
      "snippet": "..."
    }
  ],
  "suggested_actions": [
    "Opprett møte med ansvarlige",
    "Generer funnrapport"
  ]
}
```

### `POST /api/ai/generate-text`
**Beskrivelse:** Generer standardtekst  
**Tilgang:** Prosjektmedlem  
**Body:**
```json
{
  "project_id": "project-uuid",
  "type": "rfi" | "avvik" | "møtereferat" | "sjekkliste",
  "context": {
    "issue_id": "issue-uuid",
    "control_run_id": "run-uuid"
  }
}
```

### `POST /api/ai/suggest-meeting`
**Beskrivelse:** Foreslå møte basert på funn  
**Tilgang:** Prosjektmedlem  
**Body:**
```json
{
  "project_id": "project-uuid",
  "control_run_id": "run-uuid"
}
```
**Response:**
```json
{
  "suggested_title": "Oppfølgingsmøte - TEK17-kontroll",
  "suggested_participants": [
    {
      "user_id": "user-uuid",
      "role": "prosjektleder",
      "reason": "Ansvarlig for 8 funn"
    }
  ],
  "agenda": [
    {
      "topic": "Kritiske funn",
      "items": ["Manglende brannklassifisering", "..."]
    }
  ],
  "decision_points": [
    "Godkjenne tiltak for kritiske funn",
    "Sette frister for utbedring"
  ]
}
```

---

## 📅 Møter

### `POST /api/meetings`
**Beskrivelse:** Opprett møte  
**Tilgang:** Prosjektmedlem med write-tilgang  
**Body:**
```json
{
  "project_id": "project-uuid",
  "title": "Oppfølgingsmøte - TEK17-kontroll",
  "description": "Gjennomgang av funn",
  "scheduled_at": "2025-12-15T10:00:00Z",
  "duration_minutes": 60,
  "location": "Møterom A",
  "control_run_id": "run-uuid",
  "participants": [
    {
      "user_id": "user-uuid",
      "role": "prosjektleder"
    }
  ],
  "agenda": [
    {
      "topic": "Kritiske funn",
      "duration_minutes": 20
    }
  ]
}
```

### `GET /api/meetings?projectId=:id`
**Beskrivelse:** List møter  
**Tilgang:** Prosjektmedlem  

### `GET /api/meetings/:id`
**Beskrivelse:** Hent møtedetaljer  
**Tilgang:** Prosjektmedlem  

### `POST /api/meetings/:id/package`
**Beskrivelse:** Generer møtepakke  
**Tilgang:** Prosjektmedlem  
**Response:**
```json
{
  "id": "package-uuid",
  "meeting_id": "meeting-uuid",
  "pdf_url": "https://...",
  "summary": "Møte om oppfølging av TEK17-kontroll...",
  "top_risks": [
    {
      "title": "Manglende brannklassifisering",
      "severity": "kritisk",
      "affected_elements": 12
    }
  ],
  "findings": [ /* liste over funn */ ],
  "action_items": [
    {
      "title": "Oppgrader vegger til EI60",
      "responsible": "user-uuid",
      "due_date": "2025-12-20T00:00:00Z"
    }
  ]
}
```

---

## 🔔 Varsler

### `GET /api/notifications`
**Beskrivelse:** Hent brukerens varsler  
**Tilgang:** Autentisert bruker  
**Query params:**
- `read`: true | false
- `type`: avvik | rfi | file_change | mention | etc.
**Response:**
```json
{
  "notifications": [
    {
      "id": "notif-uuid",
      "type": "avvik",
      "title": "Nytt avvik tildelt deg",
      "message": "Du har blitt tildelt avvik: Manglende isolasjon",
      "link": "/projects/project-uuid/issues/issue-uuid",
      "read": false,
      "created_at": "2025-12-11T10:00:00Z"
    }
  ],
  "unread_
