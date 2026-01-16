# Start her - databaseoppsett for BOB
Tid: 2-3 minutter

## 1) Kjør migreringer
- Åpne Supabase SQL Editor:
  https://supabase.com/dashboard/project/uofsfpvtgxlkbeysvtkk/sql/new
- Kjør `DATABASE_MIGRATIONS.sql` (evt. `DATABASE_MIGRATIONS_SIMPLE.sql` hvis full script feiler).
- Se `RUN_MIGRATIONS_GUIDE.md` for detaljer.

## 2) Hjelpefunksjoner + RLS
- Kjør `CREATE_HELPER_FUNCTIONS.sql`
- Kjør `ADD_RLS_POLICIES.sql`
- Se `FINAL_SETUP_STEPS.md`

## 3) Verifiser
- Kjør `test-database-setup.sql` (valider tabeller + RLS)
- Hvis alt ser bra ut, fortsett med `RUN_TESTS.md`

Når dette er gjort: skriv "Ferdig" så går vi videre.
