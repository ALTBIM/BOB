# 🎯 Siste 2 steg - 2 minutter!

Du har allerede kjørt `DATABASE_MIGRATIONS_SIMPLE.sql` ✅

Nå mangler bare 2 ting:

---

## Steg 1: Opprett hjelpefunksjoner (30 sekunder)

1. Gå til: https://supabase.com/dashboard/project/uofsfpvtgxlkbeysvtkk/sql/new
2. Åpne `CREATE_HELPER_FUNCTIONS.sql` i VSCode
3. Ctrl+A (velg alt), Ctrl+C (kopier)
4. Lim inn i Supabase SQL Editor
5. Klikk "Run"

**Forventet output:**
```
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION
CREATE FUNCTION

(5 rows)
can_project_admin    ✅ Created
can_project_read     ✅ Created
can_project_write    ✅ Created
is_app_admin         ✅ Created
is_org_admin         ✅ Created
```

---

## Steg 2: Legg til RLS policies (30 sekunder)

1. Åpne ny SQL query: https://supabase.com/dashboard/project/uofsfpvtgxlkbeysvtkk/sql/new
2. Åpne `ADD_RLS_POLICIES.sql` i VSCode
3. Ctrl+A, Ctrl+C
4. Lim inn i Supabase SQL Editor
5. Klikk "Run"

**Forventet output:**
```
ALTER TABLE
CREATE POLICY
CREATE POLICY
...
(mange linjer)
...

(14 rows)
activity_log         ✅ Enabled
control_findings     ✅ Enabled
control_runs         ✅ Enabled
controls             ✅ Enabled
cutlist_items        ✅ Enabled
drawing_snippets     ✅ Enabled
file_versions        ✅ Enabled
ifc_elements         ✅ Enabled
issue_comments       ✅ Enabled
issue_history        ✅ Enabled
issues               ✅ Enabled
meeting_packages     ✅ Enabled
meetings             ✅ Enabled
notifications        ✅ Enabled
```

---

## ✅ Ferdig!

Når du ser "✅ Enabled" på alle 14 tabeller, er databasen klar!

**Si "Ferdig" så starter jeg testing av API-endepunktene! 🧪**

---

## 🆘 Hvis noe går galt:

**Feil: "function does not exist"**
- Sørg for at du kjørte Steg 1 først

**Feil: "already exists"**
- Det er OK! Bare fortsett

**Annet:**
- Si fra, så hjelper jeg!
