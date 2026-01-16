# Kjør database-migreringer (Supabase)
Estimert tid: 5 minutter

## Metode A (anbefalt) - SQL Editor
1. Åpne Supabase Dashboard: https://supabase.com/dashboard
2. Velg prosjektet ditt (uofsfpvtgxlkbeysvtkk)
3. Åpne SQL Editor -> New query
4. Åpne `DATABASE_MIGRATIONS.sql` i VSCode
5. Kopier alt (Ctrl+A, Ctrl+C)
6. Lim inn i SQL Editor og trykk Run (Ctrl+Enter)

Hvis SQL Editor timer ut:
- Kjør i tre deler: tabeller -> indekser -> RLS policies.

## Metode B (forenklet)
Hvis full script feiler, kjør først `DATABASE_MIGRATIONS_SIMPLE.sql`, og fullfør med
`FINAL_SETUP_STEPS.md`.

## Verifisering
Kjør denne SQL-en i en ny query:

```sql
SELECT
  tablename,
  CASE WHEN rowsecurity THEN 'enabled' ELSE 'disabled' END AS rls
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'ifc_elements','issues','issue_comments','issue_history','controls','control_runs',
    'control_findings','cutlist_items','drawing_snippets','activity_log',
    'notifications','file_versions','meetings','meeting_packages'
  )
ORDER BY tablename;
```

Forventet: 14 rader og `enabled` på alle.

## Etterpå
- Kjør `test-database-setup.sql` for en enkel sjekk.
- Se `RUN_TESTS.md` for API-tester.

Hvis noe feiler, si fra med feilmeldingen, så fikser vi neste steg.
