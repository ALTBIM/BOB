# Siste steg etter migreringer (2 minutter)

Du har allerede kjørt `DATABASE_MIGRATIONS.sql` eller `DATABASE_MIGRATIONS_SIMPLE.sql`.
Nå gjenstår to korte steg:

## Steg 1: Hjelpefunksjoner
1. Åpne Supabase SQL Editor:
   https://supabase.com/dashboard/project/uofsfpvtgxlkbeysvtkk/sql/new
2. Åpne `CREATE_HELPER_FUNCTIONS.sql`
3. Kopier alt og kjør

Forventet output: `CREATE FUNCTION` x5

## Steg 2: RLS policies
1. Åpne ny SQL query i Supabase
2. Åpne `ADD_RLS_POLICIES.sql`
3. Kopier alt og kjør

Forventet output: `ALTER TABLE` og `CREATE POLICY` for alle tabeller.

## Verifisering
Kjør `test-database-setup.sql`.

Hvis noe feiler, si fra med feilmeldingen.
