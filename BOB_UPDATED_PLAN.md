# BOB Platform - Oppdatert Plan basert på Full Spesifikasjon
**Dato:** 11. desember 2025  
**Status:** Klar for implementering  
**Basert på:** Full BOB-spesifikasjon (norsk versjon)

---

## 📋 Sammendrag

Denne planen er basert på den **fullstendige BOB-spesifikasjonen** du har gitt, og tar hensyn til:
- Eksisterende analyse (25-30% ferdig)
- Eksisterende database-schema (supabase/schema.sql)
- ALLE nye krav fra full spesifikasjon

### Viktigste forskjeller fra tidligere analyse:

1. **IFC-viewer med "SearchResultsPage"-opplevelse** - Dette er nå enda mer kritisk
2. **Kapplister med tegningsutsnitt** - Mer detaljert krav om pos.nr og utklipp
3. **Møtepakker basert på funn** - Automatisk generering
4. **Logistikk/3PL/JIT** - Leverandørinvolvering
5. **Offentlig nettside** - Spesifikk layout-krav

---

## 🎯 Nåværende Status vs. Full Spesifikasjon

### ✅ Hva som allerede finnes (fra schema.sql)

**Database-struktur (delvis ferdig):**
- ✅ Organizations & org_members (multi-tenant)
- ✅ Projects med org_id
- ✅ Project_members med access_level
- ✅ Teams & team_members
- ✅ Files med tags og metadata
- ✅ IFC_models
- ✅ Checks & check_findings
- ✅ Tasks
- ✅ Kapplister (grunnstruktur)
- ✅ Meeting_suggestions
- ✅ Documents & document_chunks (RAG)
- ✅ Chat_threads & chat_messages_v2
- ✅ RLS policies (Row Level Security)

**Hva som mangler i database:**
- ❌ IFC_elements tabell (for søk med fasetter)
- ❌ Issues/RFI/Deviation tabell (mer omfattende enn tasks)
- ❌ Controls tabell (mer detaljert enn checks)
- ❌ Cutlist_items tabell (detaljert kappliste-struktur)
- ❌ Drawing_snippets tabell (tegningsutsnitt med pos.nr)
- ❌ Activity_log tabell (full revisjonslogg)
- ❌ Notifications tabell
- ❌ File_versions tabell (bedre versjonshåndtering)

---

## 🚀 Oppdatert MVP-plan (16 uker)

### Fase 1: Sikkerhet & Fundament (Uke 1-4)

#### ✅ Allerede på plass:
- Multi-tenant arkitektur (organizations)
- RLS policies
- RBAC med access_level

#### 🔧 Må fullføres:

**Uke 1-2: Forbedre eksisterende sikkerhet**

1. **Verifiser og test RLS policies**
   - Test at ingen data lekker mellom organisasjoner
   - Test at access_level fungerer korrekt
   - Test at platform_admins har full tilgang

2. **Implementer "gated admin UI"**
   ```typescript
   // Krav: Admin-UI skal være "gated"
   // - Kun platform admins ser platform-admin
   // - Kun org-admin ser org-admin
   // - Kun prosjekt-admin ser prosjekt-admin
   ```

3. **Legg til manglende kolonner i project_members**
   ```sql
   -- Allerede har: access_level
   -- Mangler:
   ALTER TABLE project_members ADD COLUMN IF NOT EXISTS company TEXT;
   ALTER TABLE project_members ADD COLUMN IF NOT EXISTS responsibility TEXT;
   ALTER TABLE project_members ADD COLUMN IF NOT EXISTS permissions TEXT[];
   ```

**Uke 3-4: Activity logging & File management**

4. **Implementer full revisjonslogg**
   ```sql
   CREATE TABLE activity_log (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES auth.users(id),
     org_id UUID REFERENCES organizations(id),
     project_id UUID REFERENCES projects(id),
     action TEXT NOT NULL,
     entity_type TEXT,
     entity_id TEXT,
     details JSONB,
     ip_address TEXT,
     user_agent TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

5. **Forbedre file management**
   ```sql
   -- Legg til i files tabell:
   ALTER TABLE files ADD COLUMN IF NOT EXISTS category TEXT;
   ALTER TABLE files ADD COLUMN IF NOT EXISTS extracted_text TEXT;
   ALTER TABLE files ADD COLUMN IF NOT EXISTS change_summary TEXT;
   ALTER TABLE files ADD COLUMN IF NOT EXISTS annotations JSONB;
   
   -- Opprett file_versions tabell:
   CREATE TABLE file_versions (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     file_id UUID REFERENCES files(id) ON DELETE CASCADE,
     version INTEGER NOT NULL,
     size BIGINT,
     storage_url TEXT,
     uploaded_by UUID REFERENCES auth.users(id),
     uploaded_at TIMESTAMP DEFAULT NOW(),
     change_summary TEXT,
     UNIQUE(file_id, version)
   );
   ```

---

### Fase 2: Kjernefunksjonalitet (Uke 5-10)

#### Uke 5-6: IFC-viewer med "SearchResultsPage"-opplevelse (KRITISK!)

**Dette er en nøkkelfunksjon i spesifikasjonen!**

6. **Opprett ifc_elements tabell**
   ```sql
   CREATE TABLE ifc_elements (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     model_id UUID REFERENCES ifc_models(id) ON DELETE CASCADE,
     project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
     guid TEXT NOT NULL,
     element_type TEXT NOT NULL,
     name TEXT,
     description TEXT,
     properties JSONB DEFAULT '{}'::jsonb,
     geometry JSONB,
     material TEXT,
     fire_rating TEXT,
     floor TEXT,
     zone TEXT,
     room TEXT,
     status TEXT DEFAULT 'ok',
     supplier TEXT,
     responsible TEXT,
     created_at TIMESTAMP DEFAULT NOW(),
     UNIQUE(model_id, guid)
   );
   
   -- Indekser for rask søk:
   CREATE INDEX idx_ifc_elements_model ON ifc_elements(model_id);
   CREATE INDEX idx_ifc_elements_project ON ifc_elements(project_id);
   CREATE INDEX idx_ifc_elements_type ON ifc_elements(element_type);
   CREATE INDEX idx_ifc_elements_floor ON ifc_elements(floor);
   CREATE INDEX idx_ifc_elements_zone ON ifc_elements(zone);
   CREATE INDEX idx_ifc_elements_material ON ifc_elements(material);
   
   -- Full-text search:
   CREATE INDEX idx_ifc_elements_search ON ifc_elements 
   USING GIN (to_tsvector('english', 
     COALESCE(name, '') || ' ' || 
     COALESCE(description, '') || ' ' || 
     COALESCE(element_type, '')
   ));
   ```

7. **Implementer IFC Search API**
   ```typescript
   // POST /api/ifc/search
   interface IFCSearchQuery {
     text?: string;
     filters: {
       floor?: string[];
       zone?: string[];
       room?: string[];
       elementType?: string[]; // vegg, dør, vindu, dekke, søyle, bjelke
       material?: string[];
       fireRating?: string[];
       status?: 'ok' | 'avvik' | 'til_kontroll';
       supplier?: string[];
       responsible?: string[];
     };
     projectId: string;
     limit?: number;
     offset?: number;
   }
   
   interface IFCSearchResult {
     guid: string;
     name: string;
     type: string;
     location: { floor: string; room?: string; zone?: string };
     properties: Record<string, any>;
     relatedDeviations?: string[];
     relatedDocuments?: string[];
   }
   ```

8. **Bygg IFC Search UI - "SearchResultsPage"-opplevelse**
   ```typescript
   // Krav fra spesifikasjon:
   // - Søkefelt + avansert filtrering/fasetter
   // - Tydelig resultatliste med treff
   // - Klikk på resultat => zoom/marker element i modellen
   // - Filtre: etasje, bygg, sone, rom, elementtype, materiale, 
   //   brannkrav, status, leverandør, ansvarlig
   // - Resultatkort viser: GUID, navn, type, plassering, properties,
   //   linker til avvik/dokumenter
   
   <IFCSearch>
     <SearchInput /> {/* Med debounce */}
     <FilterPanel>
       <FilterAccordion>
         <FilterSection title="Elementtype">
           <Checkbox>Vegg</Checkbox>
           <Checkbox>Dør</Checkbox>
           <Checkbox>Vindu</Checkbox>
           {/* ... */}
         </FilterSection>
         <FilterSection title="Etasje">
           {/* Dynamisk fra data */}
         </FilterSection>
         {/* ... flere filtre */}
       </FilterAccordion>
     </FilterPanel>
     <ResultsList>
       {results.map(element => (
         <ElementCard
           key={element.guid}
           element={element}
           onClick={() => zoomToElement(element.guid)}
         />
       ))}
     </ResultsList>
   </IFCSearch>
   ```

#### Uke 7-8: Avvik/RFI/Kontroller

9. **Opprett issues tabell (mer omfattende enn tasks)**
   ```sql
   CREATE TABLE issues (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
     type TEXT NOT NULL CHECK (type IN ('avvik', 'rfi', 'endringsforespørsel')),
     title TEXT NOT NULL,
     description TEXT,
     status TEXT NOT NULL CHECK (status IN ('ny', 'under_behandling', 'avklart', 'lukket')),
     priority TEXT NOT NULL CHECK (priority IN ('lav', 'medium', 'høy', 'kritisk')),
     category TEXT,
     assigned_to UUID REFERENCES auth.users(id),
     due_date TIMESTAMP,
     created_by UUID REFERENCES auth.users(id),
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW(),
     resolved_at TIMESTAMP,
     ifc_element_guids TEXT[], -- Kobling til IFC-elementer
     attachments JSONB DEFAULT '[]'::jsonb
   );
   
   CREATE TABLE issue_comments (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
     user_id UUID REFERENCES auth.users(id),
     comment TEXT NOT NULL,
     created_at TIMESTAMP DEFAULT NOW()
   );
   
   CREATE TABLE issue_history (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
     user_id UUID REFERENCES auth.users(id),
     action TEXT NOT NULL,
     changes JSONB,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

10. **Opprett controls tabell (mer detaljert enn checks)**
    ```sql
    CREATE TABLE controls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL CHECK (type IN ('kravkontroll', 'modellhelse', 'logistikk')),
      ruleset JSONB NOT NULL, -- Regelbasert: TEK, Svanemerket, prosjektspesifikke
      created_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE control_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      control_id UUID REFERENCES controls(id) ON DELETE CASCADE,
      run_by UUID REFERENCES auth.users(id),
      run_at TIMESTAMP DEFAULT NOW(),
      status TEXT NOT NULL CHECK (status IN ('kjører', 'fullført', 'feilet')),
      findings_count INTEGER DEFAULT 0
    );
    
    CREATE TABLE control_findings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      control_run_id UUID REFERENCES control_runs(id) ON DELETE CASCADE,
      severity TEXT NOT NULL CHECK (severity IN ('info', 'advarsel', 'feil', 'kritisk')),
      description TEXT NOT NULL,
      element_guid TEXT,
      recommended_action TEXT,
      auto_created_issue_id UUID REFERENCES issues(id),
      created_at TIMESTAMP DEFAULT NOW()
    );
    ```

#### Uke 9-10: Prosjekt-bevisst AI

11. **Implementer prosjekt-bevisst AI**
    ```typescript
    // KRITISK KRAV: AI skal aldri lekke data mellom prosjekter/tenants
    
    async function buildAIContext(
      userId: string,
      projectId: string,
      query: string
    ): Promise<AIContext> {
      // 1. Verifiser tilgang
      const hasAccess = await verifyProjectAccess(userId, projectId);
      if (!hasAccess) {
        throw new Error('Ingen tilgang til prosjekt');
      }
      
      // 2. Hent relevante dokumenter (RAG)
      const docs = await searchDocuments(projectId, query);
      
      // 3. Hent relevante IFC-elementer
      const ifcElements = await searchIFCElements(projectId, query);
      
      // 4. Hent avvik/issues
      const issues = await getRecentIssues(projectId);
      
      // 5. Bygg kontekst (kun data fra DETTE prosjektet)
      return {
        projectId,
        userId,
        documents: docs,
        ifcElements,
        issues,
        projectMetadata: await getProjectMetadata(projectId)
      };
    }
    
    // AI-funksjoner fra spesifikasjon:
    // - Spørsmål/svar basert på prosjektets dokumenter + IFC + avvik
    // - Generere forslag til tiltak
    // - Standardtekster (RFI, avvik, møtereferat)
    // - Sjekklister
    // - Møteagenda og deltakere basert på funn
    // - Forklare funn: "Hvorfor er dette et problem?" + "Hva må gjøres?"
    ```

12. **Implementer notifications system**
    ```sql
    CREATE TABLE notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id),
      project_id UUID REFERENCES projects(id),
      type TEXT NOT NULL,
      title TEXT,
      message TEXT,
      link TEXT,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    ```

---

### Fase 3: Produksjonsfunksjoner (Uke 11-14)

#### Uke 11-12: Kapplister med tegningsutsnitt (NØKKELFUNKSJON!)

**Dette er en kritisk funksjon i spesifikasjonen!**

13. **Opprett detaljert cutlist-struktur**
    ```sql
    -- Allerede har: kapplister tabell
    -- Må legge til:
    
    CREATE TABLE cutlist_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cutlist_id UUID REFERENCES kapplister(id) ON DELETE CASCADE,
      position_number TEXT NOT NULL, -- Pos.nr
      quantity INTEGER NOT NULL,
      length NUMERIC,
      width NUMERIC,
      height NUMERIC,
      cut_length NUMERIC, -- Kappelengde
      material TEXT,
      material_spec TEXT, -- Materialspesifikasjon
      zone TEXT,
      room TEXT,
      comment TEXT, -- Monteringsinfo
      ifc_element_guids TEXT[],
      drawing_snippet_id UUID, -- Kobling til tegningsutsnitt
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE drawing_snippets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      cutlist_id UUID REFERENCES kapplister(id) ON DELETE CASCADE,
      position_number TEXT NOT NULL, -- Matcher pos.nr i cutlist_items
      snippet_type TEXT, -- 'plan' | 'snitt' | 'detalj'
      image_url TEXT, -- URL til utsnitt-bilde
      coordinates JSONB, -- Koordinater for utsnitt i modell
      annotations JSONB, -- Markeringer/nummerering på utsnitt
      created_at TIMESTAMP DEFAULT NOW()
    );
    ```

14. **Implementer kappliste-generator**
    ```typescript
    // Krav fra spesifikasjon:
    // - Generere kapplister basert på: materialtype, sone/rom/område, IFC-elementer
    // - Output: Pos.nr, Antall, Dimensjon (L×B×H), Lengde (kappelengde),
    //   Materialspesifikasjon, Prosjekt/sone/rom, Kommentar/monteringsinfo
    // - Eksport: PDF + XLSX/CSV
    // - Tegnings-/modellutsnitt: hente ut relevante arbeidstegningsutsnitt
    // - Nummererte utsnitt der hvert kappe-element får pos.nr som matcher kapplisten
    
    async function generateCutList(params: {
      projectId: string;
      modelId: string;
      zone?: string;
      room?: string;
      materialType?: string;
    }): Promise<CutList> {
      // 1. Query IFC-elementer
      const elements = await queryIFCElements(params);
      
      // 2. Grupper etter materiale og dimensjoner
      const grouped = groupByMaterialAndDimensions(elements);
      
      // 3. Generer pos.nr
      const items = grouped.map((group, index) => ({
        positionNumber: `P${String(index + 1).padStart(3, '0')}`,
        quantity: group.count,
        dimensions: extractDimensions(group.elements),
        cutLength: calculateCutLength(group.elements),
        material: group.material,
        materialSpec: group.materialSpec,
        zone: params.zone,
        room: params.room,
        comment: generateMountingInfo(group.elements),
        ifcElementGuids: group.elements.map(e => e.guid)
      }));
      
      // 4. Generer tegningsutsnitt
      const snippets = await generateDrawingSnippets(items, params.modelId);
      
      // 5. Lagre i database
      return await saveCutList({ ...params, items, snippets });
    }
    
    async function generateDrawingSnippets(
      items: CutListItem[],
      modelId: string
    ): Promise<DrawingSnippet[]> {
      // For hvert område/sone:
      // 1. Hent ut plan-utsnitt
      // 2. Marker elementer med pos.nr
      // 3. Generer snitt-utsnitt hvis nødvendig
      // 4. Lagre som bilder med annotasjoner
    }
    ```

15. **Implementer eksport til PDF/XLSX**
    ```typescript
    // PDF: Kappliste med tegningsutsnitt
    async function exportCutListToPDF(cutlistId: string): Promise<Buffer> {
      const cutlist = await getCutList(cutlistId);
      const items = await getCutListItems(cutlistId);
      const snippets = await getDrawingSnippets(cutlistId);
      
      // Generer PDF med:
      // - Forside med prosjektinfo
      // - Kappliste-tabell
      // - Tegningsutsnitt med pos.nr-markering
      // - Monteringsinstruksjoner
    }
    
    // XLSX: Kappliste for produksjon
    async function exportCutListToXLSX(cutlistId: string): Promise<Buffer> {
      const items = await getCutListItems(cutlistId);
      
      // Generer XLSX med kolonner:
      // Pos.nr | Antall | L | B | H | Kappelengde | Materiale | 
      // Materialspesifikasjon | Sone | Rom | Kommentar
    }
    ```

#### Uke 13-14: Møtepakker og kontroller

16. **Implementer møtepakke-generator**
    ```typescript
    // Krav fra spesifikasjon:
    // Etter kontroll skal BOB kunne foreslå møte med:
    // - Hvem bør delta (roller/personer basert på ansvar på funn)
    // - Agenda generert fra funn
    // - Beslutningspunkter
    // - Vedlegg (funnrapport, lenker til avvik, dokumenter, IFC-lenker)
    
    async function suggestMeeting(controlRunId: string): Promise<MeetingSuggestion> {
      const findings = await getControlFindings(controlRunId);
      
      // 1. Analyser funn og identifiser ansvarlige
      const responsibleParties = identifyResponsibleParties(findings);
      
      // 2. Generer agenda
      const agenda = generateAgenda(findings);
      
      // 3. Identifiser beslutningspunkter
      const decisionPoints = identifyDecisionPoints(findings);
      
      // 4. Samle vedlegg
      const attachments = await gatherAttachments(findings);
      
      return {
        participants: responsibleParties,
        agenda,
        decisionPoints,
        attachments,
        suggestedDate: suggestMeetingDate(),
        priority: calculateMeetingPriority(findings)
      };
    }
    
    async function generateMeetingPackage(meetingId: string): Promise<Buffer> {
      // Generer PDF med:
      // - Sammendrag
      // - Topprisikoer
      // - Funnliste
      // - Ansvarlig + forslag tiltak
      // - Lenker til avvik, dokumenter, IFC-elementer
    }
    ```

---

### Fase 4: Polering & Lansering (Uke 15-16)

#### Uke 15: Dashboard & UX

17. **Forbedret dashboard**
    ```typescript
    // Krav fra spesifikasjon:
    // (1) Prosjektoversikt:
    //     - Kort for alle prosjekter (vis 3 nyeste hvis mange)
    //     - Teller på aktive avvik/RFI
    //     - Indikator for endringer i prosjektfiler
    //     - Fremdrifts-% + varsling hvis avvik fra plan
    // (2) Kalender/plan:
    //     - Møter + daglige byggeplassaktiviteter
    //     - Leveranser/montering
    // (3) Varslingssenter:
    //     - Inbox: avvik, RFI, endringer, godkjenninger
    //     - Siste aktivitet/endringslogg
    //     - Quick actions
    //     - Kommende frister/milepæler
    //     - Risikobilde
    //     - HMS-sjekk/inspeksjoner
    //     - Leveranse-/logistikkstatus
    //     - Modellhelse (clash/regelbrudd)
    ```

18. **Offentlig nettside**
    ```typescript
    // Krav fra spesifikasjon:
    // Toppseksjon på forsiden (horisontal struktur):
    // 1. Logo til venstre
    // 2. Hero/slogan ved siden av
    // 3. Tjenester/produkter til høyre for hero
    // 4. "Dette er meg" / info om Andreas helt til høyre
    
    <PublicLandingPage>
      <TopSection className="flex items-center justify-between">
        <Logo />
        <HeroSection>
          <h1>BOB - Bygg Uten Bekymringer</h1>
          <p>Produksjonsklar plattform for byggeprosjekter</p>
        </HeroSection>
        <ServicesSection>
          <ServiceCard>Prosjektstyring</ServiceCard>
          <ServiceCard>IFC/BIM-håndtering</ServiceCard>
          <ServiceCard>Kvalitetskontroll</ServiceCard>
        </ServicesSection>
        <AboutSection>
          <h3>Andreas Thorsen</h3>
          <p>Grunnlegger & Utvikler</p>
        </AboutSection>
      </TopSection>
      {/* Resten av siden */}
    </PublicLandingPage>
    ```

#### Uke 16: Testing & Deployment

19. **Omfattende testing**
    - Unit tests (80%+ coverage)
    - Integration tests
    - E2E tests for kritiske flows
    - Sikkerhetstesting (RLS, tenant isolation)
    - Performance testing (store IFC-filer)
    - Cross-browser testing

20. **Dokumentasjon & Deployment**
    - Brukermanual
    - Admin-guide
    - API-dokumentasjon
    - Video-tutorials
    - Production deployment
    - Monitoring setup

---

## 📊 Manglende funksjoner fra spesifikasjon (Post-MVP)

Disse funksjonene er i spesifikasjonen, men kan vente til etter MVP:

### Logistikk & 3PL/JIT (Post-MVP)
```sql
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  supplier TEXT,
  delivery_date DATE,
  items JSONB,
  status TEXT,
  jit_window JSONB -- Just-in-time vindu
);

CREATE TABLE logistics_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  delivery_id UUID REFERENCES deliveries(id),
  check_type TEXT, -- '3PL' | 'JIT' | 'quality'
  status TEXT,
  findings JSONB
);
```

### Budsjett & Prognose (Post-MVP)
```sql
CREATE TABLE project_budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  category TEXT,
  budgeted_amount NUMERIC,
  actual_amount NUMERIC,
  forecast_amount NUMERIC
);
```

### HMS & Sikkerhet (Post-MVP)
```sql
CREATE TABLE hms_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  inspection_type TEXT,
  inspector UUID REFERENCES auth.users(id),
  findings JSONB,
  status TEXT
);
```

---

## 🔒 Sikkerhetskrav (KRITISK!)

### Absolutte krav fra spesifikasjon:

1. **Full tenant-isolasjon (org/tenant)**
   - ✅ Allerede implementert i schema.sql
   - ⚠️ Må testes grundig

2. **Prosjektisolasjon innen tenant**
   - ✅ RLS policies på plass
   - ⚠️ Må verifiseres

3. **AI må bare kunne bruke data som brukeren har tilgang til**
   - ❌ Må implementeres i AI-kontekst-bygging
   - 🔴 KRITISK: Ingen data-lekkasje mellom prosjekter

4. **Audit-logg for admin-handlinger**
   - ❌ Må implementeres (activity_log tabell)

5. **Filtilgang må være tilgangsstyrt per prosjekt**
   - ✅ RLS policy på files tabell
   - ⚠️ Må testes

---

## 📈 Suksesskriterier for MVP

### Tekniske krav:
- [ ] Zero kritiske sikkerhetssårbarheter
- [ ] 80%+ test coverage
- [ ] <500ms API responstid (p95)
- [ ] <2s IFC-søk responstid
- [ ] 99.9% uptime
- [ ] Alle TypeScript-feil fikset
- [ ] Alle ESLint-advarsler fikset

### Funksjonelle krav:
- [ ] Multi-tenant isolasjon fungerer
- [ ] RBAC fullt implementert
- [ ] IFC-søk med fasetter fungerer (SearchResultsPage-opplevelse)
- [ ] Avvik/RFI-tracking fungerer
- [ ] AI-chat fungerer
