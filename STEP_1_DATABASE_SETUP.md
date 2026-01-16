# Steg 1: Database-oppsett og migrering
Estimert tid: 30-60 minutter

## Mål
- Opprette alle tabeller
- Aktivere RLS
- Verifisere at prosjektisolasjon fungerer

## Sjekkliste
- Kjør `DATABASE_MIGRATIONS.sql` (eller SIMPLE)
- Kjør hjelpefunksjoner + RLS policies
- Verifiser tabeller og RLS

## 1) Kjør migreringer
**Anbefalt:** Supabase SQL Editor
1. Åpne: https://supabase.com/dashboard/project/uofsfpvtgxlkbeysvtkk/sql/new
2. Åpne `DATABASE_MIGRATIONS.sql`
3. Kopier alt og kjør

Hvis det feiler:
- Kjør `DATABASE_MIGRATIONS_SIMPLE.sql`
- Fullfør med `FINAL_SETUP_STEPS.md`

## 2) Verifiser tabeller + RLS
Kjør:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'ifc_elements','issues','issue_comments','issue_history','controls','control_runs',
    'control_findings','cutlist_items','drawing_snippets','activity_log',
    'notifications','file_versions','meetings','meeting_packages'
  )
ORDER BY tablename;
```

Forventet: 14 rader, `rowsecurity = t`.

## 3) (Valgfritt) RLS sanity-test
Hvis du har `organizations` og `projects` på plass:

```sql
SELECT count(*) FROM projects;
SELECT count(*) FROM project_members;
```

## 4) Siste steg
- Kjør `test-database-setup.sql`
- Se `RUN_TESTS.md` for API-tester

Hvis du får feil, send feilmeldingen, så rydder vi det.
