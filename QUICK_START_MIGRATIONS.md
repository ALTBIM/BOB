# 🚀 Kjør Database-migreringer - Rask guide

**Tid:** 2 minutter

---

## Steg 1: Åpne Supabase Dashboard

1. Gå til: https://supabase.com/dashboard/project/uofsfpvtgxlkbeysvtkk/sql/new
2. Dette åpner SQL Editor direkte

---

## Steg 2: Kopier og kjør SQL

### Alternativ A: Kjør alt på én gang (anbefalt)

1. Åpne `DATABASE_MIGRATIONS.sql` i VSCode
2. Trykk `Ctrl+A` (velg alt)
3. Trykk `Ctrl+C` (kopier)
4. Gå til Supabase SQL Editor
5. Trykk `Ctrl+V` (lim inn)
6. Klikk "Run" eller trykk `Ctrl+Enter`

**Forventet tid:** 10-30 sekunder

### Alternativ B: Kjør i deler (hvis Alternativ A feiler)

Hvis SQL Editor timer ut, kjør i 3 deler:

**Del 1: Tabeller (linjer 1-400)**
```sql
-- Kopier fra DATABASE_MIGRATIONS.sql:
-- Fra starten til og med alle CREATE TABLE statements
```

**Del 2: Indekser (linjer 400-600)**
```sql
-- Kopier alle CREATE INDEX statements
```

**Del 3: RLS Policies (linjer 600-slutt)**
```sql
-- Kopier alle ALTER TABLE ... ENABLE ROW LEVEL SECURITY
-- og CREATE POLICY statements
```

---

## Steg 3: Verifiser

Kjør denne SQL-en i en ny query:

```sql
-- Sjekk at alle 14 tabeller er opprettet
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✅ Enabled' ELSE '❌ Disabled' END as "RLS Status"
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

**Forventet resultat:** 14 rader, alle med "✅ Enabled"

---

## Steg 4: Test at det fungerer

Kjør denne SQL-en:

```sql
-- Test at ifc_elements tabell eksisterer og har riktig struktur
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ifc_elements' 
ORDER BY ordinal_position;
```

**Forventet resultat:** Liste over kolonner (id, model_id, project_id, guid, element_type, etc.)

---

## ✅ Ferdig!

Når du ser at alle 14 tabeller er opprettet med RLS enabled, er du klar til å:

1. **Teste API-endepunktene** jeg har laget
2. **Implementere frontend-komponenter**
3. **Bygge resten av BOB-plattformen**

---

## 🆘 Problemer?

### "relation already exists"
✅ **Dette er OK!** Noen tabeller eksisterer allerede. Scriptet bruker `IF NOT EXISTS`.

### "permission denied"
❌ **Løsning:** Sørg for at du er logget inn som database-eier i Supabase.

### Timeout
❌ **Løsning:** Bruk Alternativ B (kjør i deler)

---

## 📞 Si fra når du er ferdig!

Når migreringen er fullført, si fra så fortsetter jeg med:
- Testing av API-endepunkter
- Implementering av frontend-komponenter
- Eller hva du ønsker å fokusere på

---

**Opprettet:** 16. januar 2026  
**Status:** Klar til bruk ✅
