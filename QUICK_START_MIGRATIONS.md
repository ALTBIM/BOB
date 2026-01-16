# Rask migrering (2 minutter)

1) Åpne Supabase SQL Editor:
https://supabase.com/dashboard/project/uofsfpvtgxlkbeysvtkk/sql/new

2) Kjør `DATABASE_MIGRATIONS.sql`
- Kopier hele filen inn i SQL Editor og trykk Run.
- Hvis det feiler, kjør `DATABASE_MIGRATIONS_SIMPLE.sql` først.

3) Kjør siste steg
- `CREATE_HELPER_FUNCTIONS.sql`
- `ADD_RLS_POLICIES.sql`

4) Verifiser
- Kjør `test-database-setup.sql`

Detaljer: se `RUN_MIGRATIONS_GUIDE.md` og `FINAL_SETUP_STEPS.md`.
