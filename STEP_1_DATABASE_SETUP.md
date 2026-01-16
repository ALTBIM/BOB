# Steg 1: Database-oppsett og migrering
**Estimert tid: 30-60 minutter**

---

## 🎯 Mål

Kjøre alle database-migreringer og verifisere at:
1. Alle 14 nye tabeller er opprettet
2. RLS policies fungerer
3. Ingen data-lekkasje mellom organisasjoner
4. Alle indekser er på plass

---

## 📋 Sjekkliste

- [ ] Koble til Supabase-database
- [ ] Kjøre DATABASE_MIGRATIONS.sql
- [ ] Verifisere at tabeller er opprettet
- [ ] Teste RLS policies
- [ ] Opprette test-data
- [ ] Verifisere tenant-isolasjon

---

## 1. Forberedelser (5 min)

### 1.1 Sjekk at du har tilgang til Supabase

```bash
# Test tilkobling
psql -h db.your-project.supabase.co -U postgres -d postgres -c "SELECT version();"
```

**Forventet output:**
```
PostgreSQL 15.x on x86_64-pc-linux-gnu...
```

### 1.2 Backup eksisterende database (VIKTIG!)

```bash
# Lag backup før migrering
pg_dump -h db.your-project.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 2. Kjør migreringer (10 min)

### 2.1 Kjør DATABASE_MIGRATIONS.sql

```bash
# Metode 1: Via psql
psql -h db.your-project.supabase.co -U postgres -d postgres -f DATABASE_MIGRATIONS.sql

# Metode 2: Via Supabase Dashboard
# 1. Gå til Supabase Dashboard
# 2. Velg prosjektet ditt
# 3. Gå til SQL Editor
# 4. Kopier innholdet fra DATABASE_MIGRATIONS.sql
# 5. Kjør SQL
```

**Forventet output:**
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
...
ALTER TABLE
CREATE POLICY
CREATE POLICY
...
```

### 2.2 Verifiser at alle tabeller er opprettet

```sql
-- Kjør denne SQL-en i Supabase SQL Editor eller psql
SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
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
```

**Forventet resultat: 14 rader**

| schemaname | tablename | RLS Enabled |
|------------|-----------|-------------|
| public | activity_log | t |
| public | control_findings | t |
| public | control_runs | t |
| public | controls | t |
| public | cutlist_items | t |
| public | drawing_snippets | t |
| public | file_versions | t |
| public | ifc_elements | t |
| public | issue_comments | t |
| public | issue_history | t |
| public | issues | t |
| public | meeting_packages | t |
| public | meetings | t |
| public | notifications | t |

✅ **Alle tabeller skal ha RLS Enabled = t (true)**

---

## 3. Test RLS Policies (15 min)

### 3.1 Opprett test-organisasjoner og brukere

```sql
-- Opprett test-organisasjon A
INSERT INTO organizations (id, name, created_by)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Test Org A', auth.uid())
RETURNING *;

-- Opprett test-organisasjon B
INSERT INTO organizations (id, name, created_by)
VALUES 
  ('00000000-0000-0000-0000-000000000002', 'Test Org B', auth.uid())
RETURNING *;

-- Legg til deg selv som medlem i Org A
INSERT INTO organization_members (org_id, user_id, org_role)
VALUES 
  ('00000000-0000-0000-0000-000000000001', auth.uid(), 'org_admin');

-- Opprett test-prosjekt i Org A
INSERT INTO projects (id, name, org_id, created_by)
VALUES 
  ('00000000-0000-0000-0000-000000000011', 'Test Prosjekt A', '00000000-0000-0000-0000-000000000001', auth.uid())
RETURNING *;

-- Opprett test-prosjekt i Org B
INSERT INTO projects (id, name, org_id, created_by)
VALUES 
  ('00000000-0000-0000-0000-000000000022', 'Test Prosjekt B', '00000000-0000-0000-0000-000000000002', auth.uid())
RETURNING *;
```

### 3.2 Test at du kun ser dine organisasjoner

```sql
-- Dette skal returnere kun Org A (siden du er medlem der)
SELECT * FROM organizations;
```

**Forventet resultat:** Kun 1 rad (Org A)

### 3.3 Test at du kun ser prosjekter i din organisasjon

```sql
-- Dette skal returnere kun prosjekter i Org A
SELECT * FROM projects;
```

**Forventet resultat:** Kun prosjekter fra Org A

### 3.4 Test IFC-elementer isolasjon

```sql
-- Opprett test IFC-element i Prosjekt A
INSERT INTO ifc_elements (
  project_id,
  model_id,
  guid,
  element_type,
  name,
  floor,
  zone
)
VALUES (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000111',
  'test-guid-001',
  'IfcWall',
  'Test Vegg',
  '1. etasje',
  'A'
);

-- Prøv å lese IFC-elementer
SELECT * FROM ifc_elements;
```

**Forventet resultat:** Kun elementer fra prosjekter du har tilgang til

### 3.5 Test Issues isolasjon

```sql
-- Opprett test-issue i Prosjekt A
INSERT INTO issues (
  project_id,
  type,
  title,
  description,
  priority,
  status,
  created_by
)
VALUES (
  '00000000-0000-0000-0000-000000000011',
  'avvik',
  'Test Avvik',
  'Dette er et test-avvik',
  'høy',
  'ny',
  auth.uid()
);

-- Les issues
SELECT * FROM issues;
```

**Forventet resultat:** Kun issues fra prosjekter du har tilgang til

---

## 4. Test Activity Log (5 min)

### 4.1 Opprett test-aktivitet

```sql
-- Logg en aktivitet
INSERT INTO activity_log (
  user_id,
  project_id,
  action,
  entity_type,
  entity_id,
  details
)
VALUES (
  auth.uid(),
  '00000000-0000-0000-0000-000000000011',
  'test.action',
  'test',
  'test-id',
  '{"test": true}'::jsonb
);

-- Les aktivitetslogg
SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10;
```

**Forventet resultat:** Din test-aktivitet vises

---

## 5. Test Notifications (5 min)

### 5.1 Opprett test-varsel

```sql
-- Opprett varsel
INSERT INTO notifications (
  user_id,
  project_id,
  type,
  title,
  message,
  link
)
VALUES (
  auth.uid(),
  '00000000-0000-0000-0000-000000000011',
  'test',
  'Test Varsel',
  'Dette er et test-varsel',
  '/test'
);

-- Les varsler
SELECT * FROM notifications WHERE user_id = auth.uid();
```

**Forventet resultat:** Ditt test-varsel vises

---

## 6. Verifiser indekser (5 min)

```sql
-- Sjekk at alle indekser er opprettet
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'ifc_elements',
    'issues',
    'controls',
    'cutlist_items'
  )
ORDER BY tablename, indexname;
```

**Forventet resultat:** Mange indekser (minst 30+)

Viktige indekser å sjekke:
- `idx_ifc_elements_project` ✅
- `idx_ifc_elements_type` ✅
- `idx_ifc_elements_floor` ✅
- `idx_ifc_elements_search` (GIN index for full-text search) ✅
- `idx_issues_project` ✅
- `idx_issues_status` ✅

---

## 7. Performance-test (5 min)

### 7.1 Test søkehastighet

```sql
-- Opprett mange test-elementer (valgfritt)
INSERT INTO ifc_elements (
  project_id,
  model_id,
  guid,
  element_type,
  name,
  floor,
  zone
)
SELECT 
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000111',
  'test-guid-' || generate_series,
  'IfcWall',
  'Test Vegg ' || generate_series,
  '1. etasje',
  'A'
FROM generate_series(1, 1000);

-- Test søkehastighet
EXPLAIN ANALYZE
SELECT * FROM ifc_elements
WHERE project_id = '00000000-0000-0000-0000-000000000011'
  AND element_type = 'IfcWall'
  AND floor = '1. etasje';
```

**Forventet resultat:** Execution time < 10ms

---

## 8. Rydd opp test-data (5 min)

```sql
-- Slett test-data (valgfritt)
DELETE FROM ifc_elements WHERE guid LIKE 'test-guid-%';
DELETE FROM issues WHERE title = 'Test Avvik';
DELETE FROM activity_log WHERE action = 'test.action';
DELETE FROM notifications WHERE type = 'test';

-- Eller behold test-data for videre testing
```

---

## ✅ Sjekkliste - Verifiser at alt fungerer

Gå gjennom denne sjekklisten og kryss av:

### Database-struktur
- [ ] Alle 14 tabeller er opprettet
- [ ] Alle tabeller har RLS enabled
- [ ] Alle indekser er opprettet
- [ ] Full-text search index på ifc_elements fungerer

### RLS Policies
- [ ] Kan kun se egne organisasjoner
- [ ] Kan kun se prosjekter i egne organisasjoner
- [ ] Kan kun se IFC-elementer i tilgjengelige prosjekter
- [ ] Kan kun se issues i tilgjengelige prosjekter
- [ ] Activity log viser kun relevant aktivitet
- [ ] Notifications viser kun egne varsler

### Performance
- [ ] Søk i ifc_elements < 10ms
- [ ] Søk i issues < 10ms
- [ ] Full-text search fungerer

### Sikkerhet
- [ ] Ingen data-lekkasje mellom organisasjoner
- [ ] Ingen data-lekkasje mellom prosjekter
- [ ] RLS policies håndhever tilgangskontroll

---

## 🚨 Feilsøking

### Problem: "relation does not exist"
**Løsning:** Tabellen er ikke opprettet. Kjør DATABASE_MIGRATIONS.sql på nytt.

### Problem: "permission denied"
**Løsning:** RLS policy blokkerer tilgang. Sjekk at du er medlem av organisasjonen/prosjektet.

### Problem: "duplicate key value"
**Løsning:** Data eksisterer allerede. Bruk UPDATE i stedet for INSERT, eller slett eksisterende data først.

### Problem: Treg ytelse
**Løsning:** Sjekk at indekser er opprettet. Kjør `ANALYZE` på tabellene.

```sql
ANALYZE ifc_elements;
ANALYZE issues;
ANALYZE controls;
```

---

## 📊 Resultat

Når du er ferdig med dette steget, skal du ha:

✅ **14 nye tabeller** opprettet med RLS  
✅ **30+ indekser** for rask søk  
✅ **RLS policies** som fungerer  
✅ **Test-data** for videre utvikling  
✅ **Verifisert sikkerhet** (ingen data-lekkasje)  

---

## 🎉 Neste steg

Når database-oppsettet er ferdig, kan du gå videre til:

**Steg 2: IFC-søk API** (kommer snart)
- Implementere `/api/ifc/search`
- Teste søk med filtre
- Verifisere ytelse

---

## 📝 Notater

Bruk dette området til å notere:
- Problemer du møtte
- Løsninger du fant
- Spørsmål til teamet
- Forbedringsforslag

---

**Opprettet:** 11. desember 2025  
**Estimert tid:** 30-60 minutter  
**Status:** Klar til bruk ✅
